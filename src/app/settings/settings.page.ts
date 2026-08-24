import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { DEFAULT_METER_SETTINGS, MeterSettings } from '../models/meter-settings.model';
import { SettingsService } from '../services/settings';
import { GoogleAuthService } from '../services/google-auth';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  settings: MeterSettings = { ...DEFAULT_METER_SETTINGS };
  signingIn = false;

  constructor(
    private settingsService: SettingsService,
    private toastController: ToastController,
    readonly googleAuth: GoogleAuthService
  ) {}

  ngOnInit() {
    this.settings = this.settingsService.get();
  }

  async save() {
    this.settingsService.save(this.settings);
    const toast = await this.toastController.create({
      message: 'Settings saved.',
      duration: 1500,
      color: 'success',
      position: 'bottom',
    });
    toast.present();
  }

  async signInWithGoogle() {
    this.signingIn = true;
    try {
      await this.googleAuth.signIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      await this.presentToast(message, 'danger');
    } finally {
      this.signingIn = false;
    }
  }

  signOutOfGoogle() {
    this.googleAuth.signOut();
  }

  private async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    toast.present();
  }
}
