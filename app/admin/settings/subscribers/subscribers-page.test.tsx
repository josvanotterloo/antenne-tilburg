import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({
  db: { newsletterSubscriber: { findMany: vi.fn() } },
}));

import AdminSubscribersPage from "@/app/admin/settings/subscribers/page";
import { db } from "@/lib/db";
import { encryptEmail } from "@/lib/email-crypto";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "f".repeat(64));
});

describe("/admin/settings/subscribers", () => {
  it("lists subscribers, decrypting stored emails for display", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      // As stored: ciphertext, not plaintext.
      { id: "s1", name: "Ada", email: encryptEmail("ada@x.com"), createdAt: new Date() },
    ] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("ada@x.com")).toBeInTheDocument();
    const link = screen.getByText("Export CSV");
    expect(link).toHaveAttribute("href", "/api/admin/subscribers/export");
  });

  it("renders a fallback for an undecryptable row instead of crashing the page", async () => {
    const stored = encryptEmail("ada@x.com");
    // Key rotated: the stored row can no longer be decrypted.
    vi.stubEnv("EMAIL_ENCRYPTION_KEY", "0".repeat(64));
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      { id: "s1", name: "Ada", email: stored, createdAt: new Date() },
      { id: "s2", name: "Bo", email: encryptEmail("bo@x.com"), createdAt: new Date() },
    ] as never);
    render(await AdminSubscribersPage());
    // The bad row degrades, the good row still shows.
    expect(screen.getByText(/cannot decrypt/i)).toBeInTheDocument();
    expect(screen.getByText("bo@x.com")).toBeInTheDocument();
  });

  it("shows a legacy (unmigrated) plaintext row as-is", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      { id: "s1", name: "Old", email: "old@x.com", createdAt: new Date() },
    ] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText("old@x.com")).toBeInTheDocument();
  });

  it("shows a status badge per row and counts only confirmed", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      {
        id: "s1",
        name: "Ada",
        email: "ada@x.com",
        status: "CONFIRMED",
        createdAt: new Date(),
        confirmEmailSentAt: new Date(),
      },
      {
        id: "s2",
        name: "Bo",
        email: "bo@x.com",
        status: "PENDING",
        createdAt: new Date(),
        confirmEmailSentAt: new Date(),
      },
    ] as never);
    render(await AdminSubscribersPage());
    // Both rows render...
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bo")).toBeInTheDocument();
    // ...each with a status badge...
    expect(screen.getByText(/^confirmed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^pending$/i)).toBeInTheDocument();
    // ...but the count reflects confirmed only.
    expect(screen.getByText(/1 confirmed subscriber/i)).toBeInTheDocument();
  });

  it("badges a PENDING row with no confirmation email sent, and offers a retry button", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      {
        id: "s1",
        name: "Ada",
        email: "ada@x.com",
        status: "PENDING",
        createdAt: new Date(),
        confirmEmailSentAt: null,
      },
    ] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText(/pending \(no email sent\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry pending emails/i }),
    ).toBeInTheDocument();
  });

  it("does not offer a retry button for an unsent PENDING row past the 48h confirm window (retry would skip it anyway)", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      {
        id: "s1",
        name: "Ada",
        email: "ada@x.com",
        status: "PENDING",
        createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000),
        confirmEmailSentAt: null,
      },
    ] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText(/pending \(no email sent\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry pending emails/i }),
    ).toBeNull();
  });

  it("does not offer a retry button when every PENDING row already got its email", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      {
        id: "s1",
        name: "Ada",
        email: "ada@x.com",
        status: "PENDING",
        createdAt: new Date(),
        confirmEmailSentAt: new Date(),
      },
    ] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText(/^pending$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry pending emails/i }),
    ).toBeNull();
  });

  it("hides the export link and shows an empty state with no subscribers", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText(/No subscribers yet/)).toBeInTheDocument();
    expect(screen.queryByText("Export CSV")).toBeNull();
  });
});
