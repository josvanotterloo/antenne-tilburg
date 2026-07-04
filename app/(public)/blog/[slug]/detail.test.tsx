import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/blog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blog")>();
  return { ...actual, getPublishedPostBySlug: vi.fn() };
});

import BlogPostPage, {
  generateMetadata,
} from "@/app/(public)/blog/[slug]/page";
import { getPublishedPostBySlug } from "@/lib/blog";
import { notFound } from "next/navigation";

const POST = {
  id: "p1",
  title: "Fresh Techno Drop",
  slug: "fresh-techno-drop",
  body: "First paragraph about Tresor.\n\nSecond paragraph about Clone.",
  coverImage: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-07-01T10:00:00.000Z"),
  seoTitle: null,
  seoDescription: null,
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  updatedAt: new Date("2026-07-01T10:00:00.000Z"),
};

const call = (slug: string) =>
  BlogPostPage({ params: Promise.resolve({ slug }) });
const meta = (slug: string) =>
  generateMetadata({ params: Promise.resolve({ slug }) });

beforeEach(() => vi.clearAllMocks());

describe("/blog/[slug] detail", () => {
  it("renders the post title, date and body paragraphs", async () => {
    vi.mocked(getPublishedPostBySlug).mockResolvedValue(POST as never);
    render(await call("fresh-techno-drop"));
    expect(
      screen.getByRole("heading", { name: /Fresh Techno Drop/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("01 Jul 2026")).toBeInTheDocument();
    expect(
      screen.getByText("First paragraph about Tresor."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Second paragraph about Clone."),
    ).toBeInTheDocument();
  });

  it("404s when no published post matches the slug", async () => {
    vi.mocked(getPublishedPostBySlug).mockResolvedValue(null as never);
    await expect(call("draft-or-missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

describe("/blog/[slug] generateMetadata", () => {
  it("prefers the post's SEO fields when set", async () => {
    vi.mocked(getPublishedPostBySlug).mockResolvedValue({
      ...POST,
      seoTitle: "Custom SEO Title",
      seoDescription: "Custom SEO description.",
    } as never);
    expect(await meta("fresh-techno-drop")).toMatchObject({
      title: "Custom SEO Title",
      description: "Custom SEO description.",
    });
  });

  it("falls back to the title and a body excerpt", async () => {
    vi.mocked(getPublishedPostBySlug).mockResolvedValue(POST as never);
    const m = await meta("fresh-techno-drop");
    expect(m.title).toBe("Fresh Techno Drop");
    expect(m.description).toMatch(/First paragraph about Tresor/);
  });

  it("returns a Not found title when the post is missing", async () => {
    vi.mocked(getPublishedPostBySlug).mockResolvedValue(null as never);
    expect(await meta("missing")).toMatchObject({ title: "Not found" });
  });
});
