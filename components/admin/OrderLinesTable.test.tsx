import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

const LINE: OrderLineRowData = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  orderStatus: "PENDING",
  createdAt: "2026-08-03T10:00:00.000Z",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelName: "Zulema",
  productTypeName: "LP",
  artistNames: "Vril",
};

describe("OrderLinesTable", () => {
  it("renders a header and one row per line", () => {
    render(<OrderLinesTable lines={[LINE]} />);
    expect(screen.getByRole("columnheader", { name: /artist/i })).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });
});
