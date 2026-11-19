import { describe, expect, it } from "vitest";
import { parseInstalmentForm } from "./input";

const good = {
  name: "Phone",
  price: "20,000",
  downPayment: "",
  termCount: "12",
  apr: "6",
  firstDueOn: "2026-12-09",
  cutoff: "first",
  walletId: "",
};

describe("parseInstalmentForm", () => {
  it("parses a good form", () => {
    const r = parseInstalmentForm(good);
    expect(r.ok && r.value.rateBp).toBe(600);
    expect(r.ok && r.value.price).toBe(2_000_000);
    expect(r.ok && r.value.walletId).toBeNull();
  });
  it("treats blank interest as none", () => {
    const r = parseInstalmentForm({ ...good, apr: "" });
    expect(r.ok && r.value.rateBp).toBeNull();
  });
  it("rejects bad input", () => {
    expect(parseInstalmentForm({ ...good, name: "" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, price: "0" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, downPayment: "20,000" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, termCount: "0" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, termCount: "2.5" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, apr: "abc" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, firstDueOn: "2026-02-30" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, cutoff: "third" }).ok).toBe(false);
    expect(parseInstalmentForm({ ...good, walletId: "x" }).ok).toBe(false);
  });
});
