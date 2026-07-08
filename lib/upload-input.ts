// Validation for admin image uploads (blog post inline images / cover images).
// The image format is determined by sniffing the actual file bytes (magic
// numbers) — the client-supplied MIME type is trivially spoofable and not trusted.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export type ImageExt = "jpg" | "png" | "webp" | "gif";

export type UploadCheck =
  | { ok: true; ext: ImageExt }
  | { ok: false; error: string };

// Detect the image format from the leading bytes. Returns null if the bytes are
// not one of the allowed formats (SVG is intentionally excluded — it can carry
// script).
export function sniffImageExt(bytes: Uint8Array): ImageExt | null {
  const b = bytes;
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "png";
  }
  // GIF: "GIF87a" or "GIF89a"
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return "gif";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export function validateUpload({
  size,
  bytes,
}: {
  size: number;
  bytes: Uint8Array;
}): UploadCheck {
  if (size <= 0) {
    return { ok: false, error: "The file is empty" };
  }
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller" };
  }
  const ext = sniffImageExt(bytes);
  if (!ext) {
    return { ok: false, error: "Only JPG, PNG, WebP or GIF images are allowed" };
  }
  return { ok: true, ext };
}
