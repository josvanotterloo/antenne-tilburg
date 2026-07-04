// @vitest-environment node
import { describe, it, expect } from "vitest";

import { toCsv } from "@/lib/csv";

const columns = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
];

describe("toCsv", () => {
  it("writes a header row and data rows (CRLF)", () => {
    const csv = toCsv(
      [{ name: "Ada", email: "ada@x.com" }],
      columns,
    );
    expect(csv).toBe("Name,Email\r\nAda,ada@x.com");
  });

  it("quotes and escapes cells with commas, quotes or newlines", () => {
    const csv = toCsv(
      [
        { name: "Lovelace, Ada", email: 'a"b@x.com' },
        { name: "line1\nline2", email: "c@x.com" },
      ],
      columns,
    );
    expect(csv).toBe(
      'Name,Email\r\n"Lovelace, Ada","a""b@x.com"\r\n"line1\nline2",c@x.com',
    );
  });

  it("renders null/undefined/missing as empty", () => {
    const csv = toCsv([{ name: null, email: undefined }], columns);
    expect(csv).toBe("Name,Email\r\n,");
  });

  it("stringifies non-string values", () => {
    const csv = toCsv([{ name: "x", email: 42 }], columns);
    expect(csv).toBe("Name,Email\r\nx,42");
  });

  it("neutralizes spreadsheet formula injection", () => {
    const csv = toCsv(
      [
        { name: "=1+1", email: "a@x.com" },
        { name: "+cmd", email: "b@x.com" },
        { name: "-2", email: "c@x.com" },
        { name: "@foo", email: "d@x.com" },
      ],
      columns,
    );
    // each dangerous leading char gets a ' prefix so it is treated as text
    expect(csv).toBe(
      "Name,Email\r\n'=1+1,a@x.com\r\n'+cmd,b@x.com\r\n'-2,c@x.com\r\n'@foo,d@x.com",
    );
  });
});
