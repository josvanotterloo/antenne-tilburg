import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { prismaErrorResponse } from "@/lib/prisma-error";
import { parsePostInput } from "@/lib/post-input";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const posts = await db.post.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parsePostInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await db.post.create({
      data: {
        ...parsed.data,
        publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const response = prismaErrorResponse(error, {
      P2002: { status: 409, body: { error: `Slug "${parsed.data.slug}" already exists` } },
    });
    if (response) return response;
    throw error;
  }
}
