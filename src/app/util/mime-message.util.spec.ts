import { buildRawEmail } from './mime-message.util';

function fromBase64Url(value: string): string {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

describe('buildRawEmail', () => {
  it('produces base64url output with no +, / or = characters', () => {
    const raw = buildRawEmail({
      to: 'recipient@example.com',
      subject: 'Test',
      body: 'Hello',
      attachments: [],
    });
    expect(raw).not.toMatch(/[+/=]/);
  });

  it('includes To, Subject and body, and omits Bcc when not provided', () => {
    const decoded = fromBase64Url(
      buildRawEmail({
        to: 'recipient@example.com',
        subject: 'Meter readings',
        body: 'Here is the meter readings for today',
        attachments: [],
      })
    );
    expect(decoded).toContain('To: recipient@example.com');
    expect(decoded).toContain('Subject: Meter readings');
    expect(decoded).toContain('Here is the meter readings for today');
    expect(decoded).not.toContain('Bcc:');
  });

  it('includes Bcc when provided', () => {
    const decoded = fromBase64Url(
      buildRawEmail({
        to: 'recipient@example.com',
        bcc: 'me@example.com',
        subject: 'Meter readings',
        body: 'body',
        attachments: [],
      })
    );
    expect(decoded).toContain('Bcc: me@example.com');
  });

  it('adds one multipart section per attachment with matching Content-Disposition', () => {
    const decoded = fromBase64Url(
      buildRawEmail({
        to: 'recipient@example.com',
        subject: 'Meter readings',
        body: 'body',
        attachments: [
          { filename: 'reading.jpg', mimeType: 'image/jpeg', base64: 'aW1hZ2U=' },
          { filename: 'reading.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64: 'ZG9jeA==' },
        ],
      })
    );
    expect(decoded).toContain('Content-Disposition: attachment; filename="reading.jpg"');
    expect(decoded).toContain('aW1hZ2U=');
    expect(decoded).toContain('Content-Disposition: attachment; filename="reading.docx"');
    expect(decoded).toContain('ZG9jeA==');
    expect(decoded.trim()).toMatch(/--$/);
  });
});
