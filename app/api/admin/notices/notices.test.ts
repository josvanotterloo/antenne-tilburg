// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    notice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/notices/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/admin/notices/[id]/route";

const notice = db.notice as unknown as {
  findMany: Mock;
  findUnique: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
};
const ROW = { id: "n1", message: "Hi", active: true };
const req = (method: string, body: unknown) =>
  new Request("http://t/api/admin/notices", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("notices API", () => {
  it("GET lists notices newest first", async () => {
    notice.findMany.mockResolvedValue([ROW]);
    expect((await GET()).status).toBe(200);
    expect(notice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("POST creates a notice (201)", async () => {
    notice.create.mockResolvedValue(ROW);
    const res = await POST(req("POST", { message: "Closed today", active: false }));
    expect(res.status).toBe(201);
    expect(notice.create.mock.calls[0][0].data).toMatchObject({
      message: "Closed today",
      active: false,
    });
  });

  it("POST rejects a blank message (400)", async () => {
    expect((await POST(req("POST", { message: "" }))).status).toBe(400);
    expect(notice.create).not.toHaveBeenCalled();
  });

  it("POST rejects end-before-start (400)", async () => {
    const res = await POST(
      req("POST", {
        message: "x",
        startsAt: "2026-07-12T00:00",
        endsAt: "2026-07-10T00:00",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET [id] 200/404", async () => {
    notice.findUnique.mockResolvedValueOnce(ROW);
    expect((await GET_ONE(req("GET", null), ctx("n1"))).status).toBe(200);
    notice.findUnique.mockResolvedValueOnce(null);
    expect((await GET_ONE(req("GET", null), ctx("x"))).status).toBe(404);
  });

  it("PATCH toggles active (200)", async () => {
    notice.update.mockResolvedValue(ROW);
    const res = await PATCH(req("PATCH", { message: "Hi", active: false }), ctx("n1"));
    expect(res.status).toBe(200);
    expect(notice.update.mock.calls[0][0].data.active).toBe(false);
  });

  it("DELETE 200/404", async () => {
    notice.delete.mockResolvedValue(ROW);
    expect((await DELETE(req("DELETE", null), ctx("n1"))).status).toBe(200);
    notice.delete.mockRejectedValue({ code: "P2025" });
    expect((await DELETE(req("DELETE", null), ctx("x"))).status).toBe(404);
  });
});
