// @vitest-environment node
import { describe, it, expect } from "vitest";

import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/upload-input";

describe("validateUpload", () => {
  it("accepts the allowed image types and returns the extension", () => {
    expect(validateUpload({ type: "image/jpeg", size: 1000 })).toEqual({
      ok: true,
      ext: "jpg",
    });
    expect(validateUpload({ type: "image/png", size: 1000 })).toEqual({
      ok: true,
      ext: "png",
    });
    expect(validateUpload({ type: "image/webp", size: 1000 })).toEqual({
      ok: true,
      ext: "webp",
    });
    expect(validateUpload({ type: "image/gif", size: 1000 })).toEqual({
      ok: true,
      ext: "gif",
    });
  });

  it("rejects other content types", () => {
    for (const type of ["application/pdf", "text/plain", "image/svg+xml", ""]) {
      expect(validateUpload({ type, size: 1000 }).ok).toBe(false);
    }
  });

  it("rejects files larger than 5MB", () => {
    expect(
      validateUpload({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }).ok,
    ).toBe(false);
    expect(
      validateUpload({ type: "image/png", size: MAX_UPLOAD_BYTES }).ok,
    ).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ type: "image/png", size: 0 }).ok).toBe(false);
  });
});
