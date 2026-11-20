import { describe, expect, it } from "vitest";
import { isExportName, toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header and rows, empty for no rows", () => {
    expect(toCsv([])).toBe("");
    expect(toCsv([{ a: 1, b: "x" }, { a: 2, b: null }])).toBe("a,b\r\n1,x\r\n2,\r\n");
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv([{ n: 'a,"b"\nc' }])).toBe('n\r\n"a,""b""\nc"\r\n');
  });
  it("defuses spreadsheet formulas in text but leaves numbers alone", () => {
    expect(toCsv([{ n: "=1+1", m: -5, k: "@x" }])).toBe("n,m,k\r\n'=1+1,-5,'@x\r\n");
  });
  it("only allows known table names", () => {
    expect(isExportName("budget_lines")).toBe(true);
    expect(isExportName("users")).toBe(false);
    expect(isExportName("../x")).toBe(false);
  });
});
