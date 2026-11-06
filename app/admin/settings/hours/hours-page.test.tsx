import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({
  db: { openingHours: { findMany: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import AdminOpeningHoursPage from "@/app/admin/settings/hours/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/settings/hours", () => {
  it("renders all 7 weekday rows even when the DB has none", async () => {
    vi.mocked(db.openingHours.findMany).mockResolvedValue([] as never);
    render(await AdminOpeningHoursPage());
    for (const day of [
      "Maandag",
      "Dinsdag",
      "Woensdag",
      "Donderdag",
      "Vrijdag",
      "Zaterdag",
      "Zondag",
    ]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
    expect(screen.getByText("Openingstijden opslaan")).toBeInTheDocument();
  });

  it("reflects a stored closed day", async () => {
    vi.mocked(db.openingHours.findMany).mockResolvedValue([
      { id: "h", dayOfWeek: 1, opensAt: "00:00", closesAt: "00:00", closed: true },
    ] as never);
    render(await AdminOpeningHoursPage());
    // Monday's opens input is disabled when closed
    const mondayOpens = screen.getByLabelText("Maandag opent") as HTMLInputElement;
    expect(mondayOpens.disabled).toBe(true);
  });

  it("renders in English when the admin's locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    vi.mocked(db.openingHours.findMany).mockResolvedValue([] as never);
    render(await AdminOpeningHoursPage());
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByLabelText("Monday opens")).toBeInTheDocument();
    expect(screen.getByText("Save hours")).toBeInTheDocument();
  });
});
