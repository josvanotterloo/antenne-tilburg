import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { NoticeForm } from "@/components/admin/NoticeForm";

describe("NoticeForm labels", () => {
  it("exposes every field by its visible label", () => {
    render(<NoticeForm />);

    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByLabelText(/starts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ends/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });
});
