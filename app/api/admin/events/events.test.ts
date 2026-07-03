// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/events/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/admin/events/[id]/route";

const event = db.event as unknown as {
  findMany: Mock;
  findUnique: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
};

const ROW = { id: "e1", title: "Night", slug: "night" };
const future = "2999-01-01T20:00:00.000Z";
const past = "2000-01-01T20:00:00.000Z";
const validBody = { title: "Label Night", date: future };
const req = (method: string, body: unknown) =>
  new Request("http://t/api/admin/events", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("events API", () => {
  it("GET lists events", async () => {
    event.findMany.mockResolvedValue([ROW]);
    expect((await GET()).status).toBe(200);
    expect(event.findMany).toHaveBeenCalled();
  });

  it("POST derives UPCOMING status from a future date", async () => {
    event.create.mockResolvedValue(ROW);
    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
    expect(event.create.mock.calls[0][0].data.status).toBe("UPCOMING");
  });

  it("POST derives PAST status from a past date", async () => {
    event.create.mockResolvedValue(ROW);
    await POST(req("POST", { ...validBody, date: past }));
    expect(event.create.mock.calls[0][0].data.status).toBe("PAST");
  });

  it("POST rejects invalid input (400)", async () => {
    const res = await POST(req("POST", { title: "x", date: "nope" }));
    expect(res.status).toBe(400);
    expect(event.create).not.toHaveBeenCalled();
  });

  it("POST returns 409 on duplicate slug", async () => {
    event.create.mockRejectedValue({ code: "P2002" });
    expect((await POST(req("POST", validBody))).status).toBe(409);
  });

  it("GET [id] 200/404", async () => {
    event.findUnique.mockResolvedValueOnce(ROW);
    expect((await GET_ONE(req("GET", null), ctx("e1"))).status).toBe(200);
    event.findUnique.mockResolvedValueOnce(null);
    expect((await GET_ONE(req("GET", null), ctx("x"))).status).toBe(404);
  });

  it("PATCH recomputes status from the new date", async () => {
    event.update.mockResolvedValue(ROW);
    await PATCH(req("PATCH", { ...validBody, date: past }), ctx("e1"));
    expect(event.update.mock.calls[0][0].data.status).toBe("PAST");
  });

  it("DELETE 200/404", async () => {
    event.delete.mockResolvedValue(ROW);
    expect((await DELETE(req("DELETE", null), ctx("e1"))).status).toBe(200);
    event.delete.mockRejectedValue({ code: "P2025" });
    expect((await DELETE(req("DELETE", null), ctx("x"))).status).toBe(404);
  });
});
