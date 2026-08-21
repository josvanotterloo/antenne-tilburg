// Tuple extractor for the legacy Antenne phpMyAdmin/MariaDB dump's
// `INSERT INTO \`table\` (cols...) VALUES (...), (...);` statements. Not a
// general SQL parser — just enough to handle this dump's actual format
// (single-quoted strings with backslash escaping, bare NULL, bare numeric
// literals), quote-aware so commas/parens/semicolons inside text fields
// (blog content, hints, etc.) don't get mistaken for statement structure.
// Used by scripts/migrate-legacy-data.ts.

export type SqlValue = string | number | null;
export type SqlRow = Record<string, SqlValue>;

// Finds every INSERT statement for `table` (there can be more than one) and
// returns one object per row, keyed by the dump's own declared column list
// — not hardcoded positions, so a reordered export doesn't silently
// misalign fields.
export function extractInsertRows(sql: string, table: string): SqlRow[] {
  const rows: SqlRow[] = [];
  const headerRe = new RegExp(`INSERT INTO \`${table}\` \\(([^)]+)\\) VALUES`, "g");
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(sql))) {
    const columns = match[1].split(",").map((c) => c.trim().replace(/`/g, ""));
    const valuesStart = headerRe.lastIndex;
    const valuesEnd = findStatementEnd(sql, valuesStart);
    const valuesBlock = sql.slice(valuesStart, valuesEnd);
    headerRe.lastIndex = valuesEnd;

    for (const tuple of splitTuples(valuesBlock)) {
      const values = parseTuple(tuple);
      if (values.length !== columns.length) continue; // malformed row, skip
      const row: SqlRow = {};
      columns.forEach((col, i) => (row[col] = values[i]));
      rows.push(row);
    }
  }
  return rows;
}

// Index of the semicolon that actually terminates the statement (i.e. one
// outside any quoted string) — a naive `indexOf(';')` would break on any
// text field containing a literal semicolon.
function findStatementEnd(sql: string, from: number): number {
  let inString = false;
  for (let i = from; i < sql.length; i++) {
    const c = sql[i];
    if (inString) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "'") inString = false;
      continue;
    }
    if (c === "'") {
      inString = true;
      continue;
    }
    if (c === ";") return i;
  }
  return sql.length;
}

// Splits a `(...), (...), (...)` block into individual `(...)` tuple
// strings (without the outer parens), respecting quoted-string state.
function splitTuples(valuesBlock: string): string[] {
  const tuples: string[] = [];
  let depth = 0;
  let inString = false;
  let start = -1;
  for (let i = 0; i < valuesBlock.length; i++) {
    const c = valuesBlock[i];
    if (inString) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "'") inString = false;
      continue;
    }
    if (c === "'") {
      inString = true;
      continue;
    }
    if (c === "(") {
      if (depth === 0) start = i + 1;
      depth++;
      continue;
    }
    if (c === ")") {
      depth--;
      if (depth === 0 && start >= 0) {
        tuples.push(valuesBlock.slice(start, i));
        start = -1;
      }
      continue;
    }
  }
  return tuples;
}

// Splits one tuple's inner content on top-level commas (respecting quoted
// strings) and converts each field: `NULL` -> null, `'...'` -> unescaped
// string, bare numeric -> number.
function parseTuple(tuple: string): SqlValue[] {
  const fields: string[] = [];
  let inString = false;
  let cur = "";
  for (let i = 0; i < tuple.length; i++) {
    const c = tuple[i];
    if (inString) {
      if (c === "\\") {
        cur += c + (tuple[i + 1] ?? "");
        i++;
        continue;
      }
      cur += c;
      if (c === "'") inString = false;
      continue;
    }
    if (c === "'") {
      inString = true;
      cur += c;
      continue;
    }
    if (c === ",") {
      fields.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  fields.push(cur.trim());
  return fields.map(parseField);
}

function parseField(raw: string): SqlValue {
  if (raw === "NULL") return null;
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return unescapeString(raw.slice(1, -1));
  }
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

function unescapeString(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      const next = s[i + 1];
      switch (next) {
        case "'":
          out += "'";
          break;
        case "\\":
          out += "\\";
          break;
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "0":
          out += "\0";
          break;
        case '"':
          out += '"';
          break;
        default:
          out += next ?? "";
      }
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}
