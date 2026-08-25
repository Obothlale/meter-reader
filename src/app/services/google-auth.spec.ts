import { TestBed } from '@angular/core/testing';
import { GoogleAuthService, NotSignedInError } from './google-auth';
import type { GoogleTokenClientConfig, GoogleTokenResponse } from '../../types/google-identity';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let capturedConfig: GoogleTokenClientConfig | undefined;
  let requestAccessTokenSpy: jasmine.Spy;

  function respondWith(response: GoogleTokenResponse): void {
    capturedConfig!.callback(response);
  }

  const STORAGE_KEY = 'meter-reader.google-auth';

  beforeEach(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    capturedConfig = undefined;
    requestAccessTokenSpy = jasmine.createSpy('requestAccessToken');

    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            capturedConfig = config;
            return { requestAccessToken: requestAccessTokenSpy };
          },
          revoke: jasmine.createSpy('revoke'),
        },
      },
    };

    TestBed.configureTestingModule({});
    service = TestBed.inject(GoogleAuthService);
  });

  afterEach(() => {
    delete window.google;
    sessionStorage.removeItem(STORAGE_KEY);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('restores a still-valid token from sessionStorage on construction, without re-prompting', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'restored-tok',
        tokenExpiresAt: Date.now() + 60_000,
        email: 'restored@example.com',
      })
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restored = TestBed.inject(GoogleAuthService);

    expect(restored.signedInEmail()).toBe('restored@example.com');
    await expectAsync(restored.ensureAccessToken()).toBeResolvedTo('restored-tok');
    expect(requestAccessTokenSpy).not.toHaveBeenCalled();
  });

  it('ignores an already-expired token found in sessionStorage', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stale-tok',
        tokenExpiresAt: Date.now() - 1000,
        email: 'stale@example.com',
      })
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restored = TestBed.inject(GoogleAuthService);

    expect(restored.signedInEmail()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('throws NotSignedInError from ensureAccessToken when the dialog fails', async () => {
    requestAccessTokenSpy.and.callFake(() => {
      respondWith({
        access_token: '',
        expires_in: 0,
        scope: '',
        token_type: '',
        error: 'access_denied',
      });
    });

    await expectAsync(service.ensureAccessToken()).toBeRejectedWithError(NotSignedInError);
    expect(requestAccessTokenSpy.calls.mostRecent().args).toEqual([]);
  });

  it('stores the token and signed-in email after a successful sign-in', async () => {
    spyOn(window, 'fetch').and.resolveTo({
      ok: true,
      json: () => Promise.resolve({ email: 'user@example.com' }),
    } as Response);
    requestAccessTokenSpy.and.callFake(() => {
      respondWith({ access_token: 'tok-1', expires_in: 3600, scope: '', token_type: 'Bearer' });
    });

    await service.signIn();

    expect(service.signedInEmail()).toBe('user@example.com');
    await expectAsync(service.ensureAccessToken()).toBeResolvedTo('tok-1');
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('signOut clears the persisted session', async () => {
    requestAccessTokenSpy.and.callFake(() => {
      respondWith({ access_token: 'tok-1', expires_in: 3600, scope: '', token_type: 'Bearer' });
    });
    spyOn(window, 'fetch').and.resolveTo({
      ok: true,
      json: () => Promise.resolve({ email: 'user@example.com' }),
    } as Response);

    await service.signIn();
    service.signOut();

    expect(service.signedInEmail()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('propagates an error response from the token endpoint', async () => {
    requestAccessTokenSpy.and.callFake(() => {
      respondWith({
        access_token: '',
        expires_in: 0,
        scope: '',
        token_type: '',
        error: 'access_denied',
      });
    });

    await expectAsync(service.signIn()).toBeRejectedWithError('access_denied');
  });

  it('re-prompts for a fresh token when the cached one has expired', async () => {
    spyOn(window, 'fetch').and.resolveTo({
      ok: true,
      json: () => Promise.resolve({ email: 'user@example.com' }),
    } as Response);
    let callCount = 0;
    requestAccessTokenSpy.and.callFake(() => {
      callCount++;
      // First call grants an already-expired token so the next
      // ensureAccessToken() call is forced to prompt again.
      respondWith({
        access_token: `tok-${callCount}`,
        expires_in: callCount === 1 ? -1 : 3600,
        scope: '',
        token_type: 'Bearer',
      });
    });

    await service.signIn();
    const token = await service.ensureAccessToken();

    expect(token).toBe('tok-2');
    expect(requestAccessTokenSpy).toHaveBeenCalledTimes(2);
  });
});
