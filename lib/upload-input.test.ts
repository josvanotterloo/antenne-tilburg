// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  validateUpload,
  sniffImageExt,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-input";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50,
]);
const HTML = new TextEncoder().encode("<script>alert(1)</script>");

describe("sniffImageExt", () => {
  it("recognises real image magic bytes", () => {
    expect(sniffImageExt(PNG)).toBe("png");
    expect(sniffImageExt(JPG)).toBe("jpg");
    expect(sniffImageExt(GIF)).toBe("gif");
    expect(sniffImageExt(WEBP)).toBe("webp");
  });

  it("returns null for non-image bytes", () => {
    expect(sniffImageExt(HTML)).toBeNull();
    expect(sniffImageExt(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(sniffImageExt(new Uint8Array())).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepts a real image by its bytes", () => {
    expect(validateUpload({ size: PNG.length, bytes: PNG })).toEqual({
      ok: true,
      ext: "png",
    });
  });

  it("rejects a non-image regardless of size (magic-byte check)", () => {
    expect(validateUpload({ size: HTML.length, bytes: HTML }).ok).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(validateUpload({ size: 0, bytes: new Uint8Array() }).ok).toBe(false);
    expect(validateUpload({ size: MAX_UPLOAD_BYTES + 1, bytes: PNG }).ok).toBe(
      false,
    );
  });
});
