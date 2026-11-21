import { describe, expect, it } from "vitest";
import { isBucket, isCutoff } from "./validate";

describe("guards", () => {
  it("only accepts known cutoffs and buckets", () => {
    expect(isCutoff("first") && isCutoff("second")).toBe(true);
    expect(isCutoff("third")).toBe(false);
    expect(isBucket("wants")).toBe(true);
    expect(isBucket("other")).toBe(false);
  });
});
