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

  beforeEach(() => {
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
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('throws NotSignedInError from ensureAccessToken before any sign-in', async () => {
    await expectAsync(service.ensureAccessToken()).toBeRejectedWithError(NotSignedInError);
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

  it('silently refreshes an expired token instead of throwing, once signed in before', async () => {
    spyOn(window, 'fetch').and.resolveTo({
      ok: true,
      json: () => Promise.resolve({ email: 'user@example.com' }),
    } as Response);
    let callCount = 0;
    requestAccessTokenSpy.and.callFake(() => {
      callCount++;
      // First call (interactive sign-in) grants an already-expired token so the
      // next ensureAccessToken() call is forced down the silent-refresh path.
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
    expect(requestAccessTokenSpy.calls.argsFor(1)).toEqual([{ prompt: '' }]);
  });
});
