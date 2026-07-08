import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/upload-input";

// Local storage under public/uploads for now. Swap for Hetzner Object Storage later
// (only this handler changes; the returned URL stays the contract).
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Guard size from metadata before reading the whole file into memory.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller" },
      { status: 400 },
    );
  }

  // Determine the type from the actual bytes, not the client-supplied MIME.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload({ size: file.size, bytes });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const filename = `${randomUUID()}.${check.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, filename), bytes);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}
