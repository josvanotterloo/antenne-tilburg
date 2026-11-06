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
vi.mock("@/lib/db", () => ({ db: { post: { findMany: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import AdminPostsPage from "@/app/admin/content/posts/page";
import { db } from "@/lib/db";

const POST = {
  id: "p1",
  title: "New Arrivals",
  slug: "new-arrivals",
  body: "text",
  coverImage: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-07-01"),
  seoTitle: null,
  seoDescription: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe("/admin/content/posts", () => {
  it("lists posts with title, slug and status", async () => {
    vi.mocked(db.post.findMany).mockResolvedValue([POST] as never);
    render(await AdminPostsPage());
    expect(screen.getByText("New Arrivals")).toBeInTheDocument();
    expect(screen.getByText("new-arrivals")).toBeInTheDocument();
    expect(screen.getByText("Gepubliceerd")).toBeInTheDocument();
    // publish toggle for a published post reads "Depubliceren"
    expect(screen.getByText("Depubliceren")).toBeInTheDocument();
  });

  it("shows an empty state when there are no posts", async () => {
    vi.mocked(db.post.findMany).mockResolvedValue([] as never);
    render(await AdminPostsPage());
    expect(screen.getByText(/Nog geen berichten/)).toBeInTheDocument();
  });

  it("renders in English when the admin's locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    vi.mocked(db.post.findMany).mockResolvedValue([POST] as never);
    render(await AdminPostsPage());
    expect(screen.getByRole("heading", { name: "Blog posts" })).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});
