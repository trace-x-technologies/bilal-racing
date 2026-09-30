/**
 * Shrink a photo in the browser before it is uploaded: decode, scale to a
 * longest edge (or centre-crop to a square for crew faces), re-encode as WebP
 * (JPEG where the browser can't write WebP), and step the quality down until it
 * fits the byte budget.
 *
 * Re-encoding through a canvas writes pixels only, so EXIF (GPS position,
 * camera, date) never leaves the phone. Safari still wraps its canvas JPEG in a
 * small EXIF block of its own (Apple's encoder adds one to every file), so the
 * encoded file goes through stripMetadata() as well. The server checks too
 * (worker/image.ts) and refuses any file that still carries EXIF or XMP.
 */
export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface PrepareOptions {
  /** Longest edge in px (the side length when `square`). */
  maxEdge: number;
  /** Upper bound for the encoded file. */
  maxBytes: number;
  /** Crop to a square around the upper-middle of the photo (faces). */
  square?: boolean;
}

/** Bigger source files than this aren't worth decoding on a phone. */
const MAX_SOURCE_BYTES = 40_000_000;

export class ImageError extends Error {}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      // `from-image` applies the EXIF rotation, so portrait phone shots stay upright.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall through to <img> (older Safari, odd formats) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError('That file is not a photo this browser can open. Try a JPEG or PNG.');
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/**
 * JPEG: copy every segment up to the image data except APP1 (EXIF, XMP) and
 * APP13 (Photoshop / IPTC). The pixels themselves are copied untouched.
 * Returns the input when it isn't a JPEG this parser understands.
 */
export function stripJpeg(b: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (b[0] !== 0xff || b[1] !== 0xd8) return b;
  const parts: Uint8Array<ArrayBuffer>[] = [b.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return b;
    const marker = b[at + 1] ?? 0;
    // Start of scan: the rest is image data.
    if (marker === 0xda) {
      parts.push(b.subarray(at));
      break;
    }
    const len = ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0);
    if (len < 2 || at + 2 + len > b.length) return b;
    if (marker !== 0xe1 && marker !== 0xed) parts.push(b.subarray(at, at + 2 + len));
    at += 2 + len;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * WebP: drop the EXIF and XMP chunks, clear their flags in the VP8X header and
 * fix the RIFF size. Returns the input when it isn't a WebP this parser understands.
 */
export function stripWebp(b: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (b.length < 20 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return b;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let at = 12;
  while (at + 8 <= b.length) {
    const id = ascii(b, at, 4);
    const size = view.getUint32(at + 4, true);
    // Chunks are padded to an even length.
    const end = at + 8 + size + (size & 1);
    if (end > b.length + 1) return b;
    if (id !== 'EXIF' && id !== 'XMP ') {
      const chunk = b.slice(at, Math.min(end, b.length));
      // VP8X flags: bit 3 = EXIF, bit 2 = XMP.
      if (id === 'VP8X' && chunk.length > 8) chunk[8] = (chunk[8] ?? 0) & ~0x0c;
      parts.push(chunk);
    }
    at = end;
  }
  const out = new Uint8Array(12 + parts.reduce((n, p) => n + p.length, 0));
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  let o = 12;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Whatever metadata the browser's encoder added: gone, before the file leaves the phone. */
async function stripMetadata(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const clean = blob.type === 'image/webp' ? stripWebp(bytes) : blob.type === 'image/jpeg' ? stripJpeg(bytes) : bytes;
  return clean === bytes ? blob : new Blob([clean], { type: blob.type });
}

export async function prepareImage(file: File, { maxEdge, maxBytes, square = false }: PrepareOptions): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new ImageError('Pick a photo (JPEG, PNG or WebP).');
  if (file.size > MAX_SOURCE_BYTES) throw new ImageError('That file is enormous. Pick a smaller photo.');

  const { source, width: sw, height: sh, close } = await decode(file);
  try {
    if (!sw || !sh) throw new ImageError('That photo came out empty. Try another one.');

    // Source rectangle: the whole photo, or a square biased upwards (heads sit high in a portrait).
    const side = Math.min(sw, sh);
    const sx = square ? (sw - side) / 2 : 0;
    const sy = square ? (sh - side) * 0.3 : 0;
    const cw = square ? side : sw;
    const ch = square ? side : sh;

    let scale = Math.min(1, maxEdge / Math.max(cw, ch));
    // A crew face is always exactly maxEdge square (small photos are scaled up a little).
    if (square) scale = maxEdge / side;
    let quality = 0.84;
    let type = 'image/webp';

    const canvas = document.createElement('canvas');
    for (let attempt = 0; attempt < 9; attempt++) {
      const width = Math.max(1, Math.round(cw * scale));
      const height = Math.max(1, Math.round(ch * scale));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ImageError('This browser cannot resize photos.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, sx, sy, cw, ch, 0, 0, width, height);

      let blob = await toBlob(canvas, type, quality);
      // Browsers that can't encode WebP hand back a PNG instead: switch to JPEG for good.
      if (blob && type === 'image/webp' && blob.type !== 'image/webp') {
        type = 'image/jpeg';
        blob = await toBlob(canvas, type, quality);
      }
      if (!blob) throw new ImageError('This browser could not save the photo. Try another one.');
      blob = await stripMetadata(blob);
      if (blob.size <= maxBytes) return { blob, width, height };

      // Too heavy: lower the quality first, then the size (a face keeps its size).
      if (quality > 0.55) quality -= 0.1;
      else if (!square) scale *= 0.85;
      else quality = Math.max(0.3, quality - 0.08);
    }
    throw new ImageError('That photo would not shrink enough. Try a different one.');
  } finally {
    close();
  }
}
