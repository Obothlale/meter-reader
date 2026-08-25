/** Reads a Blob and resolves with its content as a plain (non data-URL) base64 string. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob.'));
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma !== -1 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Converts standard base64 to the base64url form the Gmail API's `raw` field requires. */
export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
