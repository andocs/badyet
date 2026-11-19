import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./allowed";

describe("isAllowedEmail", () => {
  it("matches ignoring case and spaces", () => {
    expect(isAllowedEmail(" Me@Example.com ", "me@example.com")).toBe(true);
  });
  it("rejects other addresses", () => {
    expect(isAllowedEmail("other@example.com", "me@example.com")).toBe(false);
  });
  it("fails closed when nothing is configured", () => {
    expect(isAllowedEmail("me@example.com", undefined)).toBe(false);
    expect(isAllowedEmail("me@example.com", "  ")).toBe(false);
  });
  it("rejects a missing email", () => {
    expect(isAllowedEmail(undefined, "me@example.com")).toBe(false);
    expect(isAllowedEmail("", "")).toBe(false);
  });
});
