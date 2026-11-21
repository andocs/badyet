export type Cutoff = "first" | "second";
export type Bucket = "essentials" | "wants" | "savings";

export const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "essentials", label: "Essentials" },
  { id: "wants", label: "Wants" },
  { id: "savings", label: "Savings" },
];

export const isCutoff = (v: unknown): v is Cutoff => v === "first" || v === "second";
export const isBucket = (v: unknown): v is Bucket => v === "essentials" || v === "wants" || v === "savings";

