/**
 * Read an uploaded image's real type and size from its bytes (never trust the
 * browser's word), and refuse anything that still carries EXIF/XMP metadata:
 * the privacy rule is that no photo on the site keeps its GPS tag. The upload
 * form re-encodes through a canvas, which drops metadata, so a file that still
 * has it did not come from the form.
 */
export interface ImageInfo {
  mime: 'image/webp' | 'image/jpeg';
  ext: 'webp' | 'jpg';
  width: number;
  height: number;
}

export type SniffResult = { ok: true; info: ImageInfo } | { ok: false; why: 'type' | 'metadata' | 'corrupt' };

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

function sniffWebp(b: Uint8Array): SniffResult {
  if (b.length < 30) return { ok: false, why: 'corrupt' };
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunk = ascii(b, 12, 4);
  let width = 0;
  let height = 0;
  if (chunk === 'VP8X') {
    const flags = b[20] ?? 0;
    // bit 3 = EXIF, bit 2 = XMP
    if (flags & 0x0c) return { ok: false, why: 'metadata' };
    width = 1 + ((b[24] ?? 0) | ((b[25] ?? 0) << 8) | ((b[26] ?? 0) << 16));
    height = 1 + ((b[27] ?? 0) | ((b[28] ?? 0) << 8) | ((b[29] ?? 0) << 16));
  } else if (chunk === 'VP8 ') {
    // Lossy bitstream: 3-byte frame tag, start code 9d 01 2a, then 14-bit width/height.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return { ok: false, why: 'corrupt' };
    width = view.getUint16(26, true) & 0x3fff;
    height = view.getUint16(28, true) & 0x3fff;
  } else if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return { ok: false, why: 'corrupt' };
    const bits = view.getUint32(21, true);
    width = 1 + (bits & 0x3fff);
    height = 1 + ((bits >> 14) & 0x3fff);
  } else {
    return { ok: false, why: 'corrupt' };
  }
  if (!width || !height) return { ok: false, why: 'corrupt' };
  return { ok: true, info: { mime: 'image/webp', ext: 'webp', width, height } };
}

function sniffJpeg(b: Uint8Array): SniffResult {
  let at = 2;
  let width = 0;
  let height = 0;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return { ok: false, why: 'corrupt' };
    const marker = b[at + 1] ?? 0;
    // Padding / standalone markers carry no length.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    if (marker === 0xd9) break;
    const len = ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0);
    if (len < 2) return { ok: false, why: 'corrupt' };
    // APP1 holds EXIF ("Exif\0\0") or XMP ("http://ns.adobe.com/xap/1.0/").
    if (marker === 0xe1) {
      const head = ascii(b, at + 4, 5);
      if (head.startsWith('Exif') || head.startsWith('http')) return { ok: false, why: 'metadata' };
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      height = ((b[at + 5] ?? 0) << 8) | (b[at + 6] ?? 0);
      width = ((b[at + 7] ?? 0) << 8) | (b[at + 8] ?? 0);
    }
    // Start of scan: pixel data follows, and every header has been seen.
    if (marker === 0xda) break;
    at += 2 + len;
  }
  if (!width || !height) return { ok: false, why: 'corrupt' };
  return { ok: true, info: { mime: 'image/jpeg', ext: 'jpg', width, height } };
}

export function sniffImage(bytes: Uint8Array): SniffResult {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return sniffWebp(bytes);
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return sniffJpeg(bytes);
  return { ok: false, why: 'type' };
}
