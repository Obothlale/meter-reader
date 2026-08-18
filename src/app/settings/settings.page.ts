import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { DEFAULT_METER_SETTINGS, MeterSettings } from '../models/meter-settings.model';
import { SettingsService } from '../services/settings';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  settings: MeterSettings = { ...DEFAULT_METER_SETTINGS };

  constructor(
    private settingsService: SettingsService,
    private toastController: ToastController
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
}
