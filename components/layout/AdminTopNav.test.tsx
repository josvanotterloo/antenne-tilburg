import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the Next.js + next-auth bits the nav depends on so it renders in jsdom.
const pathname = { current: "/admin/catalog" };
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ refresh: mockRefresh }),
}));
const mockUpdate = vi.fn();
const session: { current: { user: { locale: "NL" | "EN" } } } = {
  current: { user: { locale: "NL" } },
};
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
  useSession: () => ({ data: session.current, update: mockUpdate }),
}));

const originalFetch = global.fetch;
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

import { AdminTopNav } from "@/components/layout/AdminTopNav";

describe("AdminTopNav", () => {
  beforeEach(() => {
    pathname.current = "/admin/catalog";
    session.current = { user: { locale: "NL" } };
    mockUpdate.mockClear();
    mockRefresh.mockClear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders the wordmark linking to /admin/catalog", () => {
    render(<AdminTopNav />);
    const wordmark = screen.getByRole("link", { name: /antenne tilburg/i });
    expect(wordmark).toHaveAttribute("href", "/admin/catalog");
  });

  it("renders the four section nav items with correct targets (Dutch labels)", () => {
    render(<AdminTopNav />);
    expect(screen.getByRole("link", { name: "Catalogus" })).toHaveAttribute(
      "href",
      "/admin/catalog",
    );
    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "href",
      "/admin/content/posts",
    );
    expect(
      screen.getByRole("link", { name: "Klantbestellingen" }),
    ).toHaveAttribute("href", "/admin/orders/customers");
    expect(screen.getByRole("link", { name: "Instellingen" })).toHaveAttribute(
      "href",
      "/admin/settings/hours",
    );
  });

  it("marks the active section based on the current path", () => {
    pathname.current = "/admin/content/posts";
    render(<AdminTopNav />);
    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Catalogus" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders a sign out control", () => {
    render(<AdminTopNav />);
    expect(
      screen.getByRole("button", { name: /uitloggen/i }),
    ).toBeInTheDocument();
  });

  it("renders English section labels and sign out when locale is EN", () => {
    session.current = { user: { locale: "EN" } };
    render(<AdminTopNav />);
    expect(screen.getByRole("link", { name: "Catalog" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Content" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Customer Orders" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("renders nothing on the login page", () => {
    pathname.current = "/admin/login";
    const { container } = render(<AdminTopNav />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  describe("language switch", () => {
    it("highlights the current locale", () => {
      render(<AdminTopNav />);
      expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(screen.getByRole("button", { name: "EN" })).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("switches to English: PATCHes the endpoint then refreshes the session", async () => {
      const user = userEvent.setup();
      render(<AdminTopNav />);

      await user.click(screen.getByRole("button", { name: "EN" }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/me/locale",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ locale: "EN" }),
          }),
        );
      });
      expect(mockUpdate).toHaveBeenCalledWith({ user: { locale: "EN" } });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("does not refresh the router when the PATCH fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Something went wrong" }),
      }) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<AdminTopNav />);

      await user.click(screen.getByRole("button", { name: "EN" }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});
