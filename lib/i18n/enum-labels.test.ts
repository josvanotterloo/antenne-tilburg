import { describe, it, expect } from "vitest";
import {
  conditionLabel,
  postStatusLabel,
  stockTransactionTypeLabel,
  supplyOrderStatusLabel,
  subscriberStatusLabel,
} from "./enum-labels";

describe("conditionLabel", () => {
  it("returns Dutch and English labels", () => {
    expect(conditionLabel("NEW", "NL")).toBe("Nieuw");
    expect(conditionLabel("SECONDHAND", "NL")).toBe("Tweedehands");
    expect(conditionLabel("NEW", "EN")).toBe("New");
    expect(conditionLabel("SECONDHAND", "EN")).toBe("Secondhand");
  });
});

describe("postStatusLabel", () => {
  it("returns Dutch and English labels", () => {
    expect(postStatusLabel("DRAFT", "NL")).toBe("Concept");
    expect(postStatusLabel("PUBLISHED", "NL")).toBe("Gepubliceerd");
    expect(postStatusLabel("DRAFT", "EN")).toBe("Draft");
    expect(postStatusLabel("PUBLISHED", "EN")).toBe("Published");
  });
});

describe("stockTransactionTypeLabel", () => {
  it("returns Dutch and English labels", () => {
    expect(stockTransactionTypeLabel("IN", "NL")).toBe("In");
    expect(stockTransactionTypeLabel("OUT", "NL")).toBe("Uit");
    expect(stockTransactionTypeLabel("ADJUSTMENT", "NL")).toBe("Aanpassing");
    expect(stockTransactionTypeLabel("IN", "EN")).toBe("In");
    expect(stockTransactionTypeLabel("OUT", "EN")).toBe("Out");
    expect(stockTransactionTypeLabel("ADJUSTMENT", "EN")).toBe("Adjustment");
  });
});

describe("supplyOrderStatusLabel", () => {
  it("matches OrderLineRow's existing lowercase English wording and its Dutch equivalent", () => {
    expect(supplyOrderStatusLabel("PENDING", "EN")).toBe("pending");
    expect(supplyOrderStatusLabel("PARTIAL", "EN")).toBe("partial");
    expect(supplyOrderStatusLabel("RECEIVED", "EN")).toBe("received");
    expect(supplyOrderStatusLabel("PENDING", "NL")).toBe("in behandeling");
    expect(supplyOrderStatusLabel("PARTIAL", "NL")).toBe("deels ontvangen");
    expect(supplyOrderStatusLabel("RECEIVED", "NL")).toBe("ontvangen");
  });
});

describe("subscriberStatusLabel", () => {
  it("matches the subscribers page's existing three-way English wording and its Dutch equivalent", () => {
    expect(subscriberStatusLabel("CONFIRMED", true, "EN")).toBe("Confirmed");
    expect(subscriberStatusLabel("PENDING", false, "EN")).toBe("Pending (no email sent)");
    expect(subscriberStatusLabel("PENDING", true, "EN")).toBe("Pending");
    expect(subscriberStatusLabel("CONFIRMED", true, "NL")).toBe("Bevestigd");
    expect(subscriberStatusLabel("PENDING", false, "NL")).toBe("In behandeling (geen e-mail verzonden)");
    expect(subscriberStatusLabel("PENDING", true, "NL")).toBe("In behandeling");
  });
});
