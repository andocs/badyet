import { describe, expect, it } from "vitest";
import { dropOn, moveInOrder, moveWithinGroup, stableColor } from "./order";

describe("moveInOrder", () => {
  it("swaps an account with its neighbour", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "earlier")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "later")).toEqual(["a", "c", "b"]);
  });
  it("returns null at either end or for an unknown account", () => {
    expect(moveInOrder(["a", "b"], "a", "earlier")).toBeNull();
    expect(moveInOrder(["a", "b"], "b", "later")).toBeNull();
    expect(moveInOrder(["a", "b"], "z", "later")).toBeNull();
  });
  it("does not change the list it was given", () => {
    const ids = ["a", "b"];
    moveInOrder(ids, "a", "later");
    expect(ids).toEqual(["a", "b"]);
  });

  const kinds: Record<string, string> = { a: "debit", b: "ewallet", c: "debit", d: "ewallet", e: "debit" };
  const kindOf = (id: string) => kinds[id]!;
  it("moves within the group, past accounts of other kinds", () => {
    expect(moveWithinGroup(["a", "b", "c", "d", "e"], kindOf, "c", "earlier")).toEqual(["c", "b", "a", "d", "e"]);
    expect(moveWithinGroup(["a", "b", "c", "d", "e"], kindOf, "c", "later")).toEqual(["a", "b", "e", "d", "c"]);
    expect(moveWithinGroup(["a", "b", "c", "d", "e"], kindOf, "b", "later")).toEqual(["a", "d", "c", "b", "e"]);
  });
  it("stops at the ends of the group", () => {
    expect(moveWithinGroup(["a", "b", "c", "d", "e"], kindOf, "a", "earlier")).toBeNull();
    expect(moveWithinGroup(["a", "b", "c", "d", "e"], kindOf, "e", "later")).toBeNull();
    expect(moveWithinGroup(["a", "b"], kindOf, "z", "later")).toBeNull();
  });
  it("drops a dragged account onto another", () => {
    expect(dropOn(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(dropOn(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(dropOn(["a", "b", "c"], "a", "a")).toBeNull();
    expect(dropOn(["a", "b"], "a", "z")).toBeNull();
  });

  it("gives an account the same colour wherever it sits", () => {
    const palette = ["#111111", "#222222", "#333333", "#444444"];
    expect(stableColor("acct-1", palette)).toBe(stableColor("acct-1", palette));
    expect(palette).toContain(stableColor("acct-2", palette));
    const ids = ["a1", "b2", "c3", "d4", "e5", "f6"];
    expect(new Set(ids.map((id) => stableColor(id, palette))).size).toBeGreaterThan(1);
  });
});
