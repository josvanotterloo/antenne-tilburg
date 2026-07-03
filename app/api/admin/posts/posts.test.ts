// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    post: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/posts/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/admin/posts/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const post = db.post as unknown as {
  findMany: Mock;
  findUnique: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
};
const mockRequireAdmin = vi.mocked(requireAdmin);

const ROW = { id: "p1", title: "Hello", slug: "hello", status: "DRAFT" };
const validBody = { title: "Hello World", body: "Text" };
const req = (method: string, body: unknown) =>
  new Request("http://t/api/admin/posts", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/posts", () => {
  it("lists posts newest first", async () => {
    post.findMany.mockResolvedValue([ROW]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([ROW]);
    expect(post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("POST /api/admin/posts", () => {
  it("creates a draft with a derived slug and no publishedAt", async () => {
    post.create.mockResolvedValue(ROW);
    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
    expect(post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Hello World",
        slug: "hello-world",
        status: "DRAFT",
        publishedAt: null,
      }),
    });
  });

  it("stamps publishedAt when created as PUBLISHED", async () => {
    post.create.mockResolvedValue(ROW);
    await POST(req("POST", { ...validBody, status: "PUBLISHED" }));
    const data = post.create.mock.calls[0][0].data;
    expect(data.status).toBe("PUBLISHED");
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects invalid input (400)", async () => {
    const res = await POST(req("POST", { title: "", body: "" }));
    expect(res.status).toBe(400);
    expect(post.create).not.toHaveBeenCalled();
  });

  it("returns 409 on a duplicate slug (P2002)", async () => {
    post.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(409);
  });
});

describe("GET/PATCH/DELETE /api/admin/posts/[id]", () => {
  it("GET returns a post, 404 when missing", async () => {
    post.findUnique.mockResolvedValueOnce(ROW);
    expect((await GET_ONE(req("GET", null), ctx("p1"))).status).toBe(200);
    post.findUnique.mockResolvedValueOnce(null);
    expect((await GET_ONE(req("GET", null), ctx("x"))).status).toBe(404);
  });

  it("PATCH stamps publishedAt when publishing a previously-unpublished post", async () => {
    post.findUnique.mockResolvedValue({ ...ROW, publishedAt: null });
    post.update.mockResolvedValue(ROW);
    await PATCH(req("PATCH", { ...validBody, status: "PUBLISHED" }), ctx("p1"));
    const data = post.update.mock.calls[0][0].data;
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("PATCH keeps DRAFT posts' publishedAt null", async () => {
    post.findUnique.mockResolvedValue({ ...ROW, publishedAt: null });
    post.update.mockResolvedValue(ROW);
    await PATCH(req("PATCH", validBody), ctx("p1"));
    expect(post.update.mock.calls[0][0].data.publishedAt).toBeNull();
  });

  it("DELETE removes the post, 404 when missing", async () => {
    post.delete.mockResolvedValue(ROW);
    expect((await DELETE(req("DELETE", null), ctx("p1"))).status).toBe(200);
    post.delete.mockRejectedValue({ code: "P2025" });
    expect((await DELETE(req("DELETE", null), ctx("x"))).status).toBe(404);
  });
});
