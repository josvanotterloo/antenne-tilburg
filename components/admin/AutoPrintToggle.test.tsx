import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AutoPrintToggle, AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

beforeEach(() => localStorage.clear());

describe("AutoPrintToggle", () => {
  it("starts unchecked when nothing is stored", () => {
    render(<AutoPrintToggle />);
    expect(screen.getByRole("checkbox", { name: /auto-print/i })).not.toBeChecked();
  });

  it("reflects a previously stored true value", async () => {
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    render(<AutoPrintToggle />);
    expect(await screen.findByRole("checkbox", { name: /auto-print/i })).toBeChecked();
  });

  it("persists a change to localStorage", async () => {
    const user = userEvent.setup();
    render(<AutoPrintToggle />);
    await user.click(screen.getByRole("checkbox", { name: /auto-print/i }));
    expect(localStorage.getItem(AUTO_PRINT_STORAGE_KEY)).toBe("true");
  });
});
