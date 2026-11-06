import { describe, it, expect } from "vitest";
import { mapApiError } from "./map-api-error";

describe("mapApiError", () => {
  it("translates a known email validation error to Dutch", () => {
    expect(mapApiError("A valid email is required", "NL")).toBe(
      "Een geldig e-mailadres is verplicht",
    );
  });

  it("returns known errors in English when locale is EN", () => {
    expect(mapApiError("That email is already in use", "EN")).toBe(
      "That email is already in use",
    );
  });

  it("translates the current-password-incorrect error", () => {
    expect(mapApiError("Current password is incorrect", "NL")).toBe(
      "Huidig wachtwoord is onjuist",
    );
  });

  it("translates the dynamic password-length message, carrying the number through", () => {
    expect(
      mapApiError("New password must be at least 8 characters", "NL"),
    ).toBe("Nieuw wachtwoord moet minimaal 8 tekens lang zijn");
  });

  it("passes an unrecognized message through unchanged (e.g. an infra error)", () => {
    expect(mapApiError("EMAIL_ENCRYPTION_KEY is missing", "NL")).toBe(
      "EMAIL_ENCRYPTION_KEY is missing",
    );
  });
});
