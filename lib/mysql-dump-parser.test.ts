// @vitest-environment node
import { describe, it, expect } from "vitest";

import { extractInsertRows } from "@/lib/mysql-dump-parser";

describe("extractInsertRows", () => {
  it("extracts rows keyed by the declared column list, with typed values", () => {
    const sql =
      "INSERT INTO `artist` (`id`, `name`) VALUES\n" + "(1, 'Vril'),\n" + "(2, 'Surgeon');\n";
    expect(extractInsertRows(sql, "artist")).toEqual([
      { id: 1, name: "Vril" },
      { id: 2, name: "Surgeon" },
    ]);
  });

  it("converts the bare NULL literal to null, distinct from an empty string", () => {
    const sql = "INSERT INTO `t` (`a`, `b`) VALUES\n(NULL, '');\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ a: null, b: "" }]);
  });

  it("keeps a quoted numeric-looking value as a string, not a number", () => {
    const sql = "INSERT INTO `t` (`code`) VALUES\n('007');\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ code: "007" }]);
  });

  it("parses bare numeric literals, including negatives and decimals", () => {
    const sql = "INSERT INTO `t` (`a`, `b`, `c`) VALUES\n(-5, 9.50, 0);\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ a: -5, b: 9.5, c: 0 }]);
  });

  it("unescapes \\' and \\\\ inside quoted strings", () => {
    const sql = "INSERT INTO `t` (`title`) VALUES\n('Director\\'s Cut'),\n('back\\\\slash');\n";
    expect(extractInsertRows(sql, "t")).toEqual([
      { title: "Director's Cut" },
      { title: "back\\slash" },
    ]);
  });

  it("does not split a tuple on a comma or paren inside a quoted string", () => {
    const sql = "INSERT INTO `t` (`note`) VALUES\n('Techno, House (mix)');\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ note: "Techno, House (mix)" }]);
  });

  it("does not end the statement early on a semicolon inside a quoted string", () => {
    const sql =
      "INSERT INTO `t` (`a`, `b`) VALUES\n('semi;colon', 1);\n" +
      "INSERT INTO `other` (`x`) VALUES\n(99);\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ a: "semi;colon", b: 1 }]);
    expect(extractInsertRows(sql, "other")).toEqual([{ x: 99 }]);
  });

  it("concatenates rows across multiple INSERT statements for the same table", () => {
    const sql =
      "INSERT INTO `t` (`id`) VALUES\n(1);\n" + "INSERT INTO `t` (`id`) VALUES\n(2), (3);\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("does not match a table whose name is a prefix of another table's name", () => {
    const sql =
      "INSERT INTO `product` (`id`) VALUES\n(1);\n" +
      "INSERT INTO `producttype` (`id`) VALUES\n(2);\n";
    expect(extractInsertRows(sql, "product")).toEqual([{ id: 1 }]);
    expect(extractInsertRows(sql, "producttype")).toEqual([{ id: 2 }]);
  });

  it("respects the dump's declared column order, not a hardcoded position", () => {
    const sql = "INSERT INTO `t` (`b`, `a`) VALUES\n('second', 'first');\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ b: "second", a: "first" }]);
  });

  it("skips a row whose field count doesn't match the declared column count", () => {
    const sql = "INSERT INTO `t` (`a`, `b`) VALUES\n(1, 2),\n(3, 4, 5);\n";
    expect(extractInsertRows(sql, "t")).toEqual([{ a: 1, b: 2 }]);
  });

  it("returns an empty array when the table has no INSERT statement", () => {
    const sql = "INSERT INTO `other` (`id`) VALUES\n(1);\n";
    expect(extractInsertRows(sql, "missing")).toEqual([]);
  });
});
