// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import {
  collectionHandlers,
  itemHandlers,
  type ReferenceDelegate,
} from "@/lib/reference-crud";

const mockRequireAdmin = vi.mocked(requireAdmin);

function makeDelegate() {
  const fns = {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { fns, delegate: fns as unknown as ReferenceDelegate };
}

function jsonRequest(body: unknown) {
  return new Request("http://test/api/admin/labels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const delReq = () => new Request("http://test", { method: "DELETE" });

describe("collectionHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(null); // allowed by default
  });

  it("GET returns items ordered by name", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findMany.mockResolvedValue([{ id: "1", name: "Techno" }]);
    const { GET } = collectionHandlers(delegate);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "1", name: "Techno" }]);
    expect(fns.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });

  it("GET returns the 401 from requireAdmin without hitting the db", async () => {
    const { fns, delegate } = makeDelegate();
    mockRequireAdmin.mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    const { GET } = collectionHandlers(delegate);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(fns.findMany).not.toHaveBeenCalled();
  });

  it("POST trims and creates a valid name", async () => {
    const { fns, delegate } = makeDelegate();
    fns.create.mockResolvedValue({ id: "1", name: "Techno" });
    const { POST } = collectionHandlers(delegate);

    const res = await POST(jsonRequest({ name: "  Techno  " }));

    expect(res.status).toBe(201);
    expect(fns.create).toHaveBeenCalledWith({ data: { name: "Techno" } });
  });

  it("POST rejects a blank name with 400", async () => {
    const { fns, delegate } = makeDelegate();
    const { POST } = collectionHandlers(delegate);

    const res = await POST(jsonRequest({ name: "   " }));

    expect(res.status).toBe(400);
    expect(fns.create).not.toHaveBeenCalled();
  });
});

describe("itemHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(null);
  });

  it("PATCH updates a valid rename", async () => {
    const { fns, delegate } = makeDelegate();
    fns.update.mockResolvedValue({ id: "1", name: "House" });
    const { PATCH } = itemHandlers(delegate);

    const res = await PATCH(jsonRequest({ name: "House" }), ctx("1"));

    expect(res.status).toBe(200);
    expect(fns.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { name: "House" },
    });
  });

  it("PATCH rejects a blank name with 400", async () => {
    const { fns, delegate } = makeDelegate();
    const { PATCH } = itemHandlers(delegate);

    const res = await PATCH(jsonRequest({ name: "" }), ctx("1"));

    expect(res.status).toBe(400);
    expect(fns.update).not.toHaveBeenCalled();
  });

  it("DELETE returns 404 when the item does not exist", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findUnique.mockResolvedValue(null);
    const { DELETE } = itemHandlers(delegate);

    const res = await DELETE(delReq(), ctx("missing"));

    expect(res.status).toBe(404);
    expect(fns.delete).not.toHaveBeenCalled();
  });

  it("DELETE is guarded (409) when products are attached", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findUnique.mockResolvedValue({
      id: "1",
      name: "Techno",
      _count: { products: 3 },
    });
    const { DELETE } = itemHandlers(delegate);

    const res = await DELETE(delReq(), ctx("1"));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ count: 3 });
    expect(fns.delete).not.toHaveBeenCalled();
  });

  it("DELETE removes the item when no products are attached", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findUnique.mockResolvedValue({
      id: "1",
      name: "Techno",
      _count: { products: 0 },
    });
    const { DELETE } = itemHandlers(delegate);

    const res = await DELETE(delReq(), ctx("1"));

    expect(res.status).toBe(200);
    expect(fns.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });
});
