import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import NewArrivalsRedirect from "@/app/(public)/new-arrivals/page";
import { redirect } from "next/navigation";

describe("/new-arrivals", () => {
  it("redirects to /stock", () => {
    expect(() => NewArrivalsRedirect()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/stock");
  });
});
