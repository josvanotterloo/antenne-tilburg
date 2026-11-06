import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AutoPrintToggle, AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

beforeEach(() => localStorage.clear());

describe("AutoPrintToggle", () => {
  it("starts unchecked when nothing is stored", () => {
    render(<AutoPrintToggle locale="NL" />);
    expect(
      screen.getByRole("checkbox", { name: /automatisch afdrukken/i }),
    ).not.toBeChecked();
  });

  it("reflects a previously stored true value", async () => {
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    render(<AutoPrintToggle locale="NL" />);
    expect(
      await screen.findByRole("checkbox", { name: /automatisch afdrukken/i }),
    ).toBeChecked();
  });

  it("persists a change to localStorage", async () => {
    const user = userEvent.setup();
    render(<AutoPrintToggle locale="NL" />);
    await user.click(screen.getByRole("checkbox", { name: /automatisch afdrukken/i }));
    expect(localStorage.getItem(AUTO_PRINT_STORAGE_KEY)).toBe("true");
  });

  it("renders the English label when locale is EN", () => {
    render(<AutoPrintToggle locale="EN" />);
    expect(screen.getByRole("checkbox", { name: /auto-print/i })).toBeInTheDocument();
  });
});
