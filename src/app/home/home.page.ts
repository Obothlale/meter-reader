import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MeterSettings } from '../models/meter-settings.model';
import { SettingsService } from '../services/settings';
import { DocxTemplateService } from '../services/docx-template';
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

  /**
   * Primary action: sends the reading automatically via the signed-in Google
   * account. ensureAccessToken() is called as the very first async step,
   * right after (synchronous) validation and before anything else - Google's
   * consent dialog must originate from a real, still-fresh user gesture (this
   * click) or the browser's popup blocker kills it silently.
   */
  submit(): Promise<void> {
    return this.withValidatedForm(async (settings, file) => {
      const token = await this.googleAuthService.ensureAccessToken();
      await this.withLoading(async () => {
        const built = await this.buildSubmission(settings, file);
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
    });
  }

  /**
   * Validates the form (synchronously, so no Google dialog is shown for an
   * incomplete one), then hands the already-narrowed settings/file to
   * `action` - shared by both submit paths so neither duplicates validation.
   */
  private async withValidatedForm(
    action: (settings: MeterSettings, file: File) => Promise<void>
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

    try {
      await action(settings, file);
    } catch (err) {
      await this.handleSubmitError(err);
    }
  }

  /** Shows the loading overlay for the duration of `action`, always dismissing it after. */
  private async withLoading<T>(action: () => Promise<T>): Promise<T> {
    const loading = await this.loadingController.create({ message: 'Preparing document…' });
    loading.present();
    this.submitting = true;
    try {
      return await action();
    } finally {
      loading.dismiss();
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
        header: 'Google sign-in needed',
        message: 'The Google sign-in prompt was closed or failed. Tap "Submit reading" to try again.',
        buttons: ['OK'],
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
