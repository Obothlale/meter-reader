import { TestBed } from '@angular/core/testing';
import { GmailSendService } from './gmail-send';

describe('GmailSendService', () => {
  let service: GmailSendService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GmailSendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('POSTs a base64url-encoded raw message with a Bearer auth header', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo({ ok: true } as Response);

    await service.sendEmail('tok-1', {
      to: 'recipient@example.com',
      subject: 'Meter readings',
      body: 'Here is the reading',
      attachments: [{ filename: 'a.jpg', mimeType: 'image/jpeg', blob: new Blob(['x']) }],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok-1');
    const body = JSON.parse(init?.body as string) as { raw: string };
    expect(body.raw).not.toMatch(/[+/=]/);
  });

  it('throws with the Gmail API error message on a non-OK response', async () => {
    spyOn(window, 'fetch').and.resolveTo({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'Insufficient permission' } }),
    } as Response);

    await expectAsync(
      service.sendEmail('tok-1', { to: 'r@example.com', subject: 's', body: 'b', attachments: [] })
    ).toBeRejectedWithError('Insufficient permission');
  });
});
