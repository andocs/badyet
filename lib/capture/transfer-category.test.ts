import { describe, expect, it } from "vitest";
import { client } from "../../mobile/src/lib/fakeClient";
import { ensureTransferCategory } from "./transfer-category";

describe("ensureTransferCategory", () => {
  it("uses the Transfer category when it exists", async () => {
    const { supabase: c } = client({ "categories:select": { data: { id: "c1" } } });
    expect(await ensureTransferCategory(c as never)).toBe("c1");
  });
  it("creates the group and the category, then tags earlier transfers", async () => {
    const { supabase: c } = client({ "categories:select": { data: null }, "category_groups:select": { data: null }, "category_groups:insert": { data: { id: "g1" } }, "categories:insert": { data: { id: "c2" } } });
    expect(await ensureTransferCategory(c as never)).toBe("c2");
  });
  it("returns null when the group cannot be made", async () => {
    const { supabase: c } = client({ "categories:select": { data: null }, "category_groups:select": { data: null }, "category_groups:insert": { data: null } });
    expect(await ensureTransferCategory(c as never)).toBeNull();
  });
});
