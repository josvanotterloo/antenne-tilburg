// Minimal RFC-4180-ish CSV serializer. Quotes any cell containing a comma,
// quote or newline, doubling embedded quotes. CRLF line endings.

export interface CsvColumn {
  key: string;
  header: string;
}

function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(","),
  );
  return [header, ...lines].join("\r\n");
}
