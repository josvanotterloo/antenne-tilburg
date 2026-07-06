// Validation for admin image uploads (blog post inline images / cover images).

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed content types → file extension.
const TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ALLOWED_UPLOAD_TYPES = Object.keys(TYPE_TO_EXT);

export type UploadCheck =
  | { ok: true; ext: string }
  | { ok: false; error: string };

export function validateUpload(file: {
  type: string;
  size: number;
}): UploadCheck {
  const ext = TYPE_TO_EXT[file.type];
  if (!ext) {
    return { ok: false, error: "Only JPG, PNG, WebP or GIF images are allowed" };
  }
  if (file.size <= 0) {
    return { ok: false, error: "The file is empty" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller" };
  }
  return { ok: true, ext };
}
