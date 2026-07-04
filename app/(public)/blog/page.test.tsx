import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/blog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blog")>();
  return { ...actual, getPublishedPosts: vi.fn() };
});

import BlogIndexPage from "@/app/(public)/blog/page";
import { getPublishedPosts } from "@/lib/blog";

const POST = {
  id: "p1",
  title: "Fresh Techno Drop",
  slug: "fresh-techno-drop",
  body: "New Tresor and Clone arrivals landed in the crate today.",
  coverImage: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-07-01T10:00:00.000Z"),
  seoTitle: null,
  seoDescription: null,
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  updatedAt: new Date("2026-07-01T10:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPublishedPosts).mockResolvedValue([POST] as never);
});

describe("/blog index", () => {
  it("renders each published post linking to its slug", async () => {
    render(await BlogIndexPage());
    const link = screen.getByRole("link", { name: /Fresh Techno Drop/ });
    expect(link).toHaveAttribute("href", "/blog/fresh-techno-drop");
  });

  it("shows the formatted publish date and an excerpt", async () => {
    render(await BlogIndexPage());
    expect(screen.getByText("01 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText(/New Tresor and Clone arrivals/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no posts", async () => {
    vi.mocked(getPublishedPosts).mockResolvedValue([] as never);
    render(await BlogIndexPage());
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
  });
});
