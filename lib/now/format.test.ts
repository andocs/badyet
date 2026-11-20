import { describe, expect, it } from "vitest";
import { isoDate } from "@/lib/domain/dates";
import { dayLabel, rangeLabel, relativeDay, shortDate, timeLabel } from "./format";

const d = isoDate;

describe("date labels", () => {
  it("formats days the way the design shows them", () => {
    expect(dayLabel(d("2026-11-20"))).toBe("Fri 20 Nov");
    expect(shortDate(d("2027-03-05"))).toBe("5 Mar");
  });
  it("formats a cutoff range, with both months when it crosses one", () => {
    expect(rangeLabel(d("2026-11-11"), d("2026-11-24"))).toBe("11–24 Nov");
    expect(rangeLabel(d("2026-11-25"), d("2026-12-10"))).toBe("25 Nov–10 Dec");
  });
  it("names today and yesterday", () => {
    expect(relativeDay(d("2026-11-20"), d("2026-11-20"))).toBe("Today");
    expect(relativeDay(d("2026-11-19"), d("2026-11-20"))).toBe("Yesterday");
    expect(relativeDay(d("2026-11-18"), d("2026-11-20"))).toBe("Wed 18 Nov");
  });
});

describe("time label", () => {
  it("shows Manila time with am and pm", () => {
    expect(timeLabel("2026-11-20T10:42:00Z")).toBe("6:42 pm");
    expect(timeLabel("2026-11-20T16:05:00Z")).toBe("12:05 am"); // 00:05 next day in Manila
    expect(timeLabel("2026-11-20T04:00:00+08:00")).toBe("4:00 am");
    expect(timeLabel("2026-11-20T04:00:00Z")).toBe("12:00 pm");
  });
});
