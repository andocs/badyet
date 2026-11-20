import { describe, expect, it } from "vitest";
import { bestGuess, matchRule, normalizePattern, type MerchantRule } from "./rules";

const rule = (over: Partial<MerchantRule> & Pick<MerchantRule, "id" | "pattern">): MerchantRule => ({ categoryId: "c", accountId: null, priority: 0, ...over });

describe("merchant rules", () => {
  it("matches by case-insensitive contains", () => {
    const rules = [rule({ id: "1", pattern: "grab", categoryId: "commute" })];
    expect(matchRule("GRAB *Ride 123", "a1", rules)?.categoryId).toBe("commute");
    expect(matchRule("Jollibee", "a1", rules)).toBeNull();
    expect(matchRule(null, "a1", rules)).toBeNull();
    expect(matchRule("", "a1", rules)).toBeNull();
  });

  it("an account-specific rule only matches that account", () => {
    const rules = [rule({ id: "1", pattern: "7-eleven", accountId: "bpi" })];
    expect(matchRule("7-Eleven Ayala", "bpi", rules)).not.toBeNull();
    expect(matchRule("7-Eleven Ayala", "gcash", rules)).toBeNull();
  });

  it("prefers higher priority, then the more specific pattern", () => {
    const rules = [
      rule({ id: "a", pattern: "grab", categoryId: "commute" }),
      rule({ id: "b", pattern: "grab food", categoryId: "eating" }),
      rule({ id: "c", pattern: "grab", categoryId: "other", priority: 5 }),
    ];
    expect(matchRule("Grab Food order", "x", rules)?.categoryId).toBe("other");
    expect(matchRule("Grab Food order", "x", rules.slice(0, 2))?.categoryId).toBe("eating");
  });

  it("normalizes a merchant into a pattern", () => {
    expect(normalizePattern("  Mang   Inasal \n")).toBe("Mang Inasal");
    expect(normalizePattern("   ")).toBeNull();
    expect(normalizePattern(null)).toBeNull();
    expect(normalizePattern("x".repeat(200))).toHaveLength(80);
  });
});

describe("best guess from history", () => {
  const history = [
    { merchant: "Jollibee", categoryId: "eating" },
    { merchant: "jollibee ", categoryId: "eating" },
    { merchant: "Jollibee", categoryId: "fun" },
    { merchant: "Jollibee", categoryId: null },
    { merchant: "Grab", categoryId: "commute" },
  ];
  it("picks the category used most for the same merchant", () => {
    expect(bestGuess("JOLLIBEE", history)).toBe("eating");
    expect(bestGuess("Grab", history)).toBe("commute");
  });
  it("has no guess for an unknown or empty merchant", () => {
    expect(bestGuess("Nowhere", history)).toBeNull();
    expect(bestGuess(null, history)).toBeNull();
    expect(bestGuess("Jollibee", [])).toBeNull();
  });
});
