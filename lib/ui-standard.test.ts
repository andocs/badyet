import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The form control standard (PROJECT_STATE.md, "Decisions & architecture"). A failure here means a screen uses the browser's own
// control, or a typed date, instead of the app's.
const root = path.resolve(__dirname, "..");
const screens = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? screens(`${dir}/${e.name}`) : e.name.endsWith(".tsx") ? [`${dir}/${e.name}`] : []));

/** The code without its comments, which may name the controls they replace. */
const code = (file: string) => fs.readFileSync(path.join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const offenders = (files: string[], banned: RegExp) => files.filter((f) => banned.test(code(f)));

describe("form control standard", () => {
  const web = [...screens("app"), ...screens("components")];
  const phone = screens("mobile/src");

  it("web dropdowns use Pick", () => {
    expect(offenders(web, /<select[\s>]|<datalist[\s>]|<optgroup[\s>]/)).toEqual([]);
  });

  it("web dates and numbers use the app's pickers and plain fields", () => {
    expect(offenders(web, /type="(date|datetime-local|month|week|time|number|color)"/)).toEqual([]);
  });

  it("phone dates and months are picked, not typed", () => {
    expect(offenders(phone, /YYYY-MM|placeholder="20\d\d-\d\d/)).toEqual([]);
  });
});
