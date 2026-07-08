// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("fs/promises", () => ({ writeFile: vi.fn(), mkdir: vi.fn() }));

import { POST } from "@/app/api/admin/uploads/route";
import { requireAdmin } from "@/lib/api-auth";
import { writeFile } from "fs/promises";
import { NextResponse } from "next/server";

function upload(file?: File) {
  const form = new FormData();
  if (file) form.set("file", file);
  return POST(
    new Request("http://localhost/api/admin/uploads", {
      method: "POST",
      body: form,
    }),
  );
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (bytes = 10) => {
  const arr = new Uint8Array(Math.max(bytes, PNG_SIG.length));
  arr.set(PNG_SIG); // real PNG magic bytes so the sniffer accepts it
  return new File([arr], "x.png", { type: "image/png" });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(null);
});

describe("POST /api/admin/uploads", () => {
  it("401s when not an admin, without writing", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await upload(png());
    expect(res.status).toBe(401);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("400s when no file is provided", async () => {
    expect((await upload()).status).toBe(400);
  });

  it("400s for a disallowed type, without writing", async () => {
    const res = await upload(
      new File([new Uint8Array(4)], "x.pdf", { type: "application/pdf" }),
    );
    expect(res.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("400s when the bytes are not an image, even if the type claims image/png", async () => {
    const evil = new File(
      [new TextEncoder().encode("<script>alert(1)</script>")],
      "x.png",
      { type: "image/png" },
    );
    const res = await upload(evil);
    expect(res.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("400s for an oversized file", async () => {
    expect((await upload(png(5 * 1024 * 1024 + 1))).status).toBe(400);
  });

  it("stores a valid image and returns its /uploads URL", async () => {
    const res = await upload(png());
    expect(res.status).toBe(201);
    expect((await res.json()).url).toMatch(/^\/uploads\/[\w-]+\.png$/);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });
});
