import { blobToBase64, toBase64Url } from './base64.util';

describe('base64.util', () => {
  describe('blobToBase64', () => {
    it('returns the base64 content without the data-URL prefix', async () => {
      const result = await blobToBase64(new Blob(['hi'], { type: 'text/plain' }));
      expect(result).toBe(btoa('hi'));
    });
  });

  describe('toBase64Url', () => {
    it('replaces + with - and / with _, and strips = padding', () => {
      expect(toBase64Url('a+b/c==')).toBe('a-b_c');
    });

    it('leaves already-safe base64 untouched', () => {
      expect(toBase64Url('abcXYZ019')).toBe('abcXYZ019');
    });
  });
});
