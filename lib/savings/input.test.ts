import { describe, expect, it } from "vitest";
import { parseSavingsForm, priorityLabel } from "./input";

const good = {
  startMonth: "2026-12",
  startEf: "38,000",
  startTravel: "12,000",
  startWants: "",
  efTranche: "100,000",
  efHardCap: "500,000",
  travelCap: "150,000",
  wantsCap: "60,000",
  priority: "EF,TRAVEL,WANTS",
};

describe("parseSavingsForm", () => {
  it("parses amounts to centavos and the priority order", () => {
    const r = parseSavingsForm(good);
    expect(r.ok && r.value.start.ef).toBe(3_800_000);
    expect(r.ok && r.value.start.wants).toBe(0);
    expect(r.ok && r.value.settings.defaultOrder).toEqual(["EF", "TRAVEL", "WANTS"]);
    expect(r.ok && r.value.settings.efTranche).toBe(10_000_000);
  });
  it("treats blank caps as zero (no cap / disabled)", () => {
    const r = parseSavingsForm({ ...good, efHardCap: "", wantsCap: "" });
    expect(r.ok && r.value.settings.efHardCap).toBe(0);
    expect(r.ok && r.value.settings.wantsCap).toBe(0);
  });
  it("needs a step above zero and valid month, amounts and priority", () => {
    expect(parseSavingsForm({ ...good, efTranche: "" }).ok).toBe(false);
    expect(parseSavingsForm({ ...good, efTranche: "0" }).ok).toBe(false);
    expect(parseSavingsForm({ ...good, startMonth: "2026-13" }).ok).toBe(false);
    expect(parseSavingsForm({ ...good, startEf: "abc" }).ok).toBe(false);
    expect(parseSavingsForm({ ...good, startEf: "-5" }).ok).toBe(false);
    expect(parseSavingsForm({ ...good, priority: "EF,EF,EF" }).ok).toBe(false);
  });
  it("labels priorities", () => {
    expect(priorityLabel("TRAVEL,EF,WANTS")).toBe("Travel > Emergency > Wants");
  });
});
