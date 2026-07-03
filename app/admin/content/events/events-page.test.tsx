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
vi.mock("@/lib/db", () => ({ db: { event: { findMany: vi.fn() } } }));

import AdminEventsPage from "@/app/admin/content/events/page";
import { db } from "@/lib/db";

const base = {
  id: "e1",
  title: "Label Night",
  slug: "label-night",
  description: null,
  image: null,
  location: "Paradiso",
  seoTitle: null,
  seoDescription: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/content/events", () => {
  it("derives UPCOMING for a future event", async () => {
    vi.mocked(db.event.findMany).mockResolvedValue([
      { ...base, date: new Date("2999-01-01"), status: "UPCOMING" },
    ] as never);
    render(await AdminEventsPage());
    expect(screen.getByText("Label Night")).toBeInTheDocument();
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
  });

  it("derives PAST for a past event regardless of stored status", async () => {
    vi.mocked(db.event.findMany).mockResolvedValue([
      // stored status stale as UPCOMING, but the date is in the past
      { ...base, date: new Date("2000-01-01"), status: "UPCOMING" },
    ] as never);
    render(await AdminEventsPage());
    expect(screen.getByText("PAST")).toBeInTheDocument();
  });
});
