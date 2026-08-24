import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MeterSettings } from '../models/meter-settings.model';
import { SettingsService } from '../services/settings';
import { DocxTemplateService } from '../services/docx-template';
import { ShareService } from '../services/share';
import { GoogleAuthService, NotSignedInError } from '../services/google-auth';
import { GmailSendService } from '../services/gmail-send';
import { extForMime } from '../util/mime.util';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface BuiltSubmission {
  settings: MeterSettings;
  subject: string;
  body: string;
  docxBlob: Blob;
  docxFilename: string;
  imageFilename: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  settings: MeterSettings | null = null;
  readingText = '';
  selectedFile: File | null = null;
  filePreviewUrl: string | null = null;
  submitting = false;

  constructor(
    private settingsService: SettingsService,
    private docxTemplateService: DocxTemplateService,
    private shareService: ShareService,
    private googleAuthService: GoogleAuthService,
    private gmailSendService: GmailSendService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.refreshSettings();
  }

  ionViewWillEnter() {
    this.refreshSettings();
  }

  private refreshSettings() {
    this.settings = this.settingsService.get();
  }

  get digitsOnly(): string {
    return this.readingText.replace(/\D+/g, '');
  }

  get formattedReadingPreview(): string {
    const digits = this.digitsOnly;
    if (digits.length !== 6) {
      return '';
    }
    return digits.slice(0, -1) + '(' + digits.slice(-1) + ')';
  }

  get readingValid(): boolean {
    return this.digitsOnly.length === 6;
  }

  get settingsComplete(): boolean {
    return !!this.settings && this.settingsService.isComplete(this.settings);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setFile(file);
  }

  private setFile(file: File | null) {
    if (this.filePreviewUrl) {
      URL.revokeObjectURL(this.filePreviewUrl);
      this.filePreviewUrl = null;
    }
    this.selectedFile = file;
    if (file && file.type.startsWith('image/')) {
      this.filePreviewUrl = URL.createObjectURL(file);
    }
  }

  clearFile() {
    this.setFile(null);
  }

  goToSettings() {
    this.router.navigateByUrl('/settings');
  }

  /** Primary action: sends the reading automatically via the signed-in Google account. */
  submit(): Promise<void> {
    return this.withBuiltSubmission(async (built, file) => {
      const token = await this.googleAuthService.ensureAccessToken();
      await this.gmailSendService.sendEmail(token, {
        to: built.settings.recipientEmail,
        bcc: built.settings.bccList || undefined,
        subject: built.subject,
        body: built.body,
        attachments: [
          { filename: built.imageFilename, mimeType: file.type, blob: file },
          { filename: built.docxFilename, mimeType: DOCX_MIME, blob: built.docxBlob },
        ],
      });
      await this.presentToast(`Email sent to ${built.settings.recipientEmail}.`, 'success');
      this.resetForm();
    });
  }

  /** Fallback action: hands the files to the OS share sheet, or downloads + opens a mailto: draft. */
  shareOrDownloadInstead(): Promise<void> {
    return this.withBuiltSubmission(async (built, file) => {
      const outcome = await this.shareService.shareOrDownload(
        [
          { blob: file, filename: built.imageFilename, mimeType: file.type },
          { blob: built.docxBlob, filename: built.docxFilename, mimeType: DOCX_MIME },
        ],
        built.subject,
        built.body,
        built.settings.recipientEmail
      );

      if (outcome === 'shared') {
        await this.presentToast('Files handed off to your share sheet.', 'success');
      } else {
        await this.presentToast(
          `Files downloaded. Attach them to an email to ${built.settings.recipientEmail}.`,
          'warning',
          4000
        );
      }
      this.resetForm();
    });
  }

  /**
   * Validates the form, builds the subject/body/docx once, then hands it to
   * `action` - shared by both the Google auto-send and share/download paths
   * so neither duplicates the validation or document-building logic.
   */
  private async withBuiltSubmission(
    action: (built: BuiltSubmission, file: File) => Promise<void>
  ): Promise<void> {
    const settings = this.settings;
    if (!settings) {
      return;
    }

    if (!this.settingsService.isComplete(settings)) {
      const alert = await this.alertController.create({
        header: 'Settings needed',
        message:
          'Please fill in the account number, account holder and recipient email in Settings before submitting a reading.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Go to settings', handler: () => this.goToSettings() },
        ],
      });
      alert.present();
      return;
    }

    if (!this.readingValid) {
      await this.presentToast('Reading must be exactly 6 digits.', 'danger');
      return;
    }

    const file = this.selectedFile;
    if (!file) {
      await this.presentToast('Please attach a photo or PDF of the meter.', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Preparing document…',
    });
    loading.present();
    this.submitting = true;

    try {
      const built = await this.buildSubmission(settings, file);
      loading.dismiss();
      await action(built, file);
    } catch (err) {
      loading.dismiss();
      await this.handleSubmitError(err);
    } finally {
      this.submitting = false;
    }
  }

  private async buildSubmission(settings: MeterSettings, file: File): Promise<BuiltSubmission> {
    const today = formatReadingDate(new Date());
    const formattedReading = this.formattedReadingPreview;

    const body = buildEmailBody({ today, formattedReading, settings });

    const docxBlob = await this.docxTemplateService.fillTemplate({
      DATE: today,
      READING: formattedReading,
      PORTION: settings.portion,
      ACCOUNT_NUMBER: settings.accountNumber,
      CONTACT_NUMBER: settings.contactNumber,
      EMAIL: settings.submitterEmail || '(unavailable)',
      ACCOUNT_HOLDER: settings.accountHolder,
      ADDRESS: settings.homeAddress,
    });

    const docxFilename = `Meter Readings - ${today}.docx`;
    const imageExt = extForMime(file.type) || fallbackExt(file.name);
    const imageFilename = `${settings.accountNumber} - ${today}${imageExt}`;
    const subject = `${settings.accountNumber} - Meter readings ${today}`;

    return { settings, subject, body, docxBlob, docxFilename, imageFilename };
  }

  private async handleSubmitError(err: unknown): Promise<void> {
    if (err instanceof NotSignedInError) {
      const alert = await this.alertController.create({
        header: 'Sign in required',
        message:
          'Sign in with Google in Settings to send readings automatically, or use "Share / Download instead" below.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Go to settings', handler: () => this.goToSettings() },
        ],
      });
      alert.present();
      return;
    }
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    await this.presentToast(message, 'danger');
  }

  private resetForm(): void {
    this.readingText = '';
    this.clearFile();
  }

  private async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger',
    duration = 2500
  ) {
    const toast = await this.toastController.create({ message, color, duration, position: 'bottom' });
    toast.present();
  }
}

function formatReadingDate(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    .replace(',', '');
}

function fallbackExt(filename: string): string {
  const match = /\.[^.]+$/.exec(filename);
  return match ? match[0] : '';
}

function buildEmailBody(args: {
  today: string;
  formattedReading: string;
  settings: MeterSettings;
}): string {
  const { today, formattedReading, settings } = args;
  return `Here is the meter readings for ${today}:

***Please See Attached Document.***

Portion: ${settings.portion}

Account Number: ${settings.accountNumber}

Reading Date: ${today}

Reading: ${formattedReading}

Contact Number: ${settings.contactNumber}

Email: ${settings.submitterEmail || '(unavailable)'}

Initials and Surname: ${settings.accountHolder}

Physical Address: ${settings.homeAddress}
`;
}
