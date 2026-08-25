import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import type { GoogleTokenClient, GoogleTokenResponse } from '../../types/google-identity';

const SCOPE =
  'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
// Treat a token as expired slightly before Google actually invalidates it, so a
// send in progress can't race an expiry mid-request.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;
// sessionStorage (not localStorage): the token still expires on its own within
// ~1 hour and only grants gmail.send + userinfo.email, and this additionally
// clears the moment the tab closes - a deliberately bounded trade of a bit of
// XSS exposure width for not re-prompting on every page reload.
const STORAGE_KEY = 'meter-reader.google-auth';

interface StoredToken {
  accessToken: string;
  tokenExpiresAt: number;
  email: string | null;
}

export class NotSignedInError extends Error {
  constructor(message = 'Not signed in with Google.') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class GoogleAuthService {
  readonly signedInEmail = signal<string | null>(null);

  private tokenClient: GoogleTokenClient | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private pending: { resolve: () => void; reject: (err: Error) => void } | null = null;

  constructor() {
    this.restoreFromSession();
  }

  /**
   * Interactive sign-in - shows the Google consent dialog. Google Identity
   * Services' token client has no silent, no-gesture mode ("due to security
   * concerns, only the dialog UX is supported" - Google's own docs); every
   * call must originate from a real user gesture (e.g. a click), or the
   * browser's popup blocker silently kills it. For a returning, already
   * -authorized user the dialog is brief (no account picker), but it can
   * never be skipped entirely without a server-held refresh token, which
   * this deliberately backend-free design doesn't have.
   */
  async signIn(): Promise<void> {
    await this.requestToken();
    await this.loadSignedInEmail();
  }

  /**
   * Returns a valid access token, prompting via the Google dialog if the
   * cached one is missing or expired. Must be called from within a real
   * user gesture's call chain (e.g. as the first async step of a button
   * click handler) so the resulting dialog isn't blocked as a popup.
   * Throws NotSignedInError if the dialog is dismissed or fails.
   */
  async ensureAccessToken(): Promise<string> {
    if (this.hasValidToken()) {
      return this.accessToken!;
    }
    try {
      await this.requestToken();
      return this.accessToken!;
    } catch {
      throw new NotSignedInError();
    }
  }

  signOut(): void {
    if (this.accessToken) {
      window.google?.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.signedInEmail.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private hasValidToken(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiresAt;
  }

  private restoreFromSession(): void {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const stored = JSON.parse(raw) as StoredToken;
      if (Date.now() >= stored.tokenExpiresAt) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.accessToken = stored.accessToken;
      this.tokenExpiresAt = stored.tokenExpiresAt;
      this.signedInEmail.set(stored.email);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private persistToSession(): void {
    if (!this.accessToken) {
      return;
    }
    const stored: StoredToken = {
      accessToken: this.accessToken,
      tokenExpiresAt: this.tokenExpiresAt,
      email: this.signedInEmail(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  private async requestToken(): Promise<void> {
    const client = await this.getTokenClient();
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
      client.requestAccessToken();
    });
  }

  private async getTokenClient(): Promise<GoogleTokenClient> {
    if (this.tokenClient) {
      return this.tokenClient;
    }
    const google = await this.waitForGoogleIdentity();
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: environment.googleClientId,
      scope: SCOPE,
      callback: (response) => this.handleTokenResponse(response),
    });
    return this.tokenClient;
  }

  private handleTokenResponse(response: GoogleTokenResponse): void {
    const pending = this.pending;
    this.pending = null;
    if (response.error) {
      pending?.reject(new Error(response.error_description || response.error));
      return;
    }
    this.accessToken = response.access_token;
    this.tokenExpiresAt = Date.now() + response.expires_in * 1000 - EXPIRY_SAFETY_MARGIN_MS;
    this.persistToSession();
    pending?.resolve();
  }

  private async loadSignedInEmail(): Promise<void> {
    if (!this.accessToken) {
      return;
    }
    try {
      const response = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!response.ok) {
        return;
      }
      const info = (await response.json()) as { email?: string };
      this.signedInEmail.set(info.email ?? null);
      this.persistToSession();
    } catch {
      // Non-fatal - sign-in already succeeded even if we can't show the email.
    }
  }

  private waitForGoogleIdentity(): Promise<NonNullable<Window['google']>> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10_000;
      const poll = () => {
        if (window.google?.accounts?.oauth2) {
          resolve(window.google);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error('Google Identity Services failed to load.'));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }
}
