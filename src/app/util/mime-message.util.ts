import { toBase64Url } from './base64.util';

export interface MimeAttachment {
  filename: string;
  mimeType: string;
  /** Plain (non-URL-safe) base64 content of the attachment. */
  base64: string;
}

export interface MimeMessageParams {
  to: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments: MimeAttachment[];
}

const CRLF = '\r\n';

/**
 * Builds an RFC 2822 multipart/mixed email and returns it base64url-encoded,
 * ready for the Gmail API's `messages.send` `raw` field. No From header is
 * set - Gmail assigns it to the authenticated account automatically.
 */
export function buildRawEmail(params: MimeMessageParams): string {
  const boundary = `meter-reader-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  const headers = [
    `To: ${params.to}`,
    ...(params.bcc ? [`Bcc: ${params.bcc}`] : []),
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join(CRLF);

  const bodyPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.body,
  ].join(CRLF);

  const attachmentParts = params.attachments.map((attachment) =>
    [
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      attachment.base64,
    ].join(CRLF)
  );

  const message = [headers, '', bodyPart, ...attachmentParts, `--${boundary}--`, ''].join(CRLF);

  // Encode as UTF-8 bytes before base64, so non-ASCII text (addresses, names) survives intact.
  return toBase64Url(btoa(unescape(encodeURIComponent(message))));
}
