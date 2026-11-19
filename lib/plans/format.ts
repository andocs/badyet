const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: MONTHS[m - 1], d };
}

// "Dec 1 to Dec 31, 2026" (year shown once when both dates share it).
export function formatRange(start: string, end: string | null): string {
  const a = parts(start);
  if (end === null) return `${a.m} ${a.d}, ${a.y} onwards`;
  const b = parts(end);
  if (a.y === b.y) return `${a.m} ${a.d} to ${b.m} ${b.d}, ${b.y}`;
  return `${a.m} ${a.d}, ${a.y} to ${b.m} ${b.d}, ${b.y}`;
}
