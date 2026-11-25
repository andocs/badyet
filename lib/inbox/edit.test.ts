import { describe, expect, it } from "vitest";
import { manilaFields, validateEdit, type EditInput } from "./edit";

const ID = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";
const input = (over: Partial<EditInput> = {}): EditInput => ({ id: ID, merchant: "  Jollibee  ", amount: "1,250.50", direction: "out", accountId: ACC, date: "2026-11-25", time: "10:02", note: "", ...over });

describe("validateEdit", () => {
  it("reads the amount in pesos and the date and time as Philippine time", () => {
    expect(validateEdit(input())).toEqual({ ok: true, value: { merchant: "Jollibee", amount: 125_050, direction: "out", accountId: ACC, occurredAt: "2026-11-25T02:02:00.000Z", note: null } });
  });
  it("keeps an empty name as none and trims the note", () => {
    expect(validateEdit(input({ merchant: " ", note: "  lunch " }))).toMatchObject({ ok: true, value: { merchant: null, note: "lunch" } });
  });
  it.each([
    [{ amount: "0" }, "Enter an amount above zero, like 250 or 1,250.50."],
    [{ amount: "lots" }, "Enter an amount above zero, like 250 or 1,250.50."],
    [{ accountId: "" }, "Pick an account."],
    [{ time: "25:00" }, "Enter the date as 2026-11-25 and the time as 10:02."],
    [{ date: "25/11/2026" }, "Enter the date as 2026-11-25 and the time as 10:02."],
    [{ date: "2026-02-31" }, "That date does not exist."],
    [{ merchant: "x".repeat(81) }, "Keep the name under 80 characters."],
    [{ id: "nope" }, "That item was not found."],
  ] as [Partial<EditInput>, string][])("refuses %j", (over, error) => {
    expect(validateEdit(input(over))).toEqual({ ok: false, error });
  });
});

describe("manilaFields", () => {
  it("shows an ISO time as the date and time in Manila", () => {
    expect(manilaFields("2026-11-25T02:02:00.000Z")).toEqual({ date: "2026-11-25", time: "10:02" });
    expect(manilaFields("2026-11-24T17:30:00Z")).toEqual({ date: "2026-11-25", time: "01:30" });
  });
});
