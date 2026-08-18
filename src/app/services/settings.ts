import { Injectable } from '@angular/core';
import { DEFAULT_METER_SETTINGS, MeterSettings } from '../models/meter-settings.model';

const STORAGE_KEY = 'meter-reader.settings';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  get(): MeterSettings {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_METER_SETTINGS };
    }
    try {
      return { ...DEFAULT_METER_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_METER_SETTINGS };
    }
  }

  save(settings: MeterSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  isComplete(settings: MeterSettings): boolean {
    return !!(
      settings.accountNumber &&
      settings.accountHolder &&
      settings.recipientEmail
    );
  }
}
