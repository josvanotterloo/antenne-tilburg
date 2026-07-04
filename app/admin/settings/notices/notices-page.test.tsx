import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({ db: { notice: { findMany: vi.fn() } } }));

import AdminNoticesPage from "@/app/admin/settings/notices/page";
import { db } from "@/lib/db";

const base = {
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/settings/notices", () => {
  it("shows 'Yes' for an active, in-window notice and its message", async () => {
    vi.mocked(db.notice.findMany).mockResolvedValue([
      { ...base, id: "n1", message: "Open late tonight", active: true, startsAt: null, endsAt: null },
    ] as never);
    render(await AdminNoticesPage());
    expect(screen.getByText("Open late tonight")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Deactivate")).toBeInTheDocument();
  });

  it("shows 'No' for an inactive notice", async () => {
    vi.mocked(db.notice.findMany).mockResolvedValue([
      { ...base, id: "n2", message: "Old notice", active: false, startsAt: null, endsAt: null },
    ] as never);
    render(await AdminNoticesPage());
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Activate")).toBeInTheDocument();
  });
});
