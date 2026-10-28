// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs/promises completely — CUSTOMER_ORDERS_PATH is hardcoded to a real,
// gitignored, operational data file (data/customer-orders.md). No test here
// may touch it.
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
}));

import { readFile, writeFile, mkdir, rename } from "fs/promises";
import {
  readCustomerOrders,
  writeCustomerOrders,
  DEFAULT_CUSTOMER_ORDERS_CONTENT,
  CUSTOMER_ORDERS_PATH,
} from "@/lib/customer-orders";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockRename = vi.mocked(rename);

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined as never);
  mockWriteFile.mockResolvedValue(undefined as never);
  mockRename.mockResolvedValue(undefined as never);
});

describe("readCustomerOrders", () => {
  it("returns the file content when readFile resolves", async () => {
    mockReadFile.mockResolvedValue("## Customer Orders\n- [ ] Vril - Untitled" as never);

    const content = await readCustomerOrders();

    expect(content).toBe("## Customer Orders\n- [ ] Vril - Untitled");
  });

  it("returns the default content when readFile rejects with ENOENT", async () => {
    const enoent = Object.assign(new Error("not found"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoent);

    const content = await readCustomerOrders();

    expect(content).toBe(DEFAULT_CUSTOMER_ORDERS_CONTENT);
  });

  it("re-throws a non-ENOENT error instead of swallowing it", async () => {
    const eacces = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    mockReadFile.mockRejectedValue(eacces);

    await expect(readCustomerOrders()).rejects.toBe(eacces);
  });
});

describe("writeCustomerOrders", () => {
  it("creates the containing directory recursively", async () => {
    await writeCustomerOrders("some content", "u1");

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining("data"),
      { recursive: true },
    );
  });

  it("writes to a temp path distinct from the real path, then renames it over the real path", async () => {
    await writeCustomerOrders("some content", "u1");

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = mockWriteFile.mock.calls[0];
    expect(writtenPath).not.toBe(CUSTOMER_ORDERS_PATH);
    expect(writtenContent).toBe("some content");

    expect(mockRename).toHaveBeenCalledTimes(1);
    const [renameFrom, renameTo] = mockRename.mock.calls[0];
    expect(renameFrom).toBe(writtenPath);
    expect(renameTo).toBe(CUSTOMER_ORDERS_PATH);
  });

  it("never passes the real path directly to writeFile", async () => {
    await writeCustomerOrders("anything", "u1");

    expect(mockWriteFile).not.toHaveBeenCalledWith(
      CUSTOMER_ORDERS_PATH,
      expect.anything(),
      expect.anything(),
    );
  });

  it("renames only after the write has settled (write-then-rename ordering)", async () => {
    const order: string[] = [];
    mockWriteFile.mockImplementation(async () => {
      order.push("write");
    });
    mockRename.mockImplementation(async () => {
      order.push("rename");
    });

    await writeCustomerOrders("content", "u1");

    expect(order).toEqual(["write", "rename"]);
  });

  describe("admin.mutation logging", () => {
    function captureLogs() {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      return { logSpy, errorSpy };
    }

    it("logs admin.mutation ok with the actor id on a successful write", async () => {
      const { logSpy, errorSpy } = captureLogs();

      await writeCustomerOrders("content", "u1");

      expect(errorSpy).not.toHaveBeenCalled();
      const event = JSON.parse(logSpy.mock.calls[0][0]);
      expect(event).toMatchObject({
        event: "admin.mutation",
        outcome: "ok",
        entity: "customer_order",
        action: "update",
        actorUserId: "u1",
      });
      vi.restoreAllMocks();
    });

    it("logs admin.mutation failed and re-throws when the write fails", async () => {
      mockWriteFile.mockRejectedValue(new Error("disk full"));
      const { errorSpy } = captureLogs();

      await expect(writeCustomerOrders("content", "u1")).rejects.toThrow("disk full");

      const event = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(event).toMatchObject({
        event: "admin.mutation",
        outcome: "failed",
        entity: "customer_order",
        action: "update",
        actorUserId: "u1",
      });
      vi.restoreAllMocks();
    });
  });
});
