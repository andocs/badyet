import { describe, expect, it } from "vitest";
import { moveInOrder } from "./order";

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
});
