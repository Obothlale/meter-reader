export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
}

export interface GoogleTokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string }): void;
}

export interface GoogleAccountsOAuth2 {
  initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient;
  revoke(accessToken: string, callback?: () => void): void;
}

export interface GoogleIdentityNamespace {
  accounts: {
    oauth2: GoogleAccountsOAuth2;
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityNamespace;
  }
}
