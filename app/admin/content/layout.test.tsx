import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = { current: "/admin/content/posts" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import ContentLayout from "@/app/admin/content/layout";

describe("ContentLayout nav", () => {
  it("renders the Content sub-nav links in Dutch", async () => {
    render(await ContentLayout({ children: null }));
    expect(
      screen.getByRole("link", { name: "Blogberichten" }),
    ).toHaveAttribute("href", "/admin/content/posts");
    expect(screen.getByRole("link", { name: "Nieuwsbrief" })).toHaveAttribute(
      "href",
      "/admin/content/newsletter/new",
    );
  });

  it("renders English labels when locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    render(await ContentLayout({ children: null }));
    expect(screen.getByRole("link", { name: "Blog posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Newsletter" })).toBeInTheDocument();
  });
});
