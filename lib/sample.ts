// Sample data for Slice 1 only. Synthetic figures (not from the real sheet).
// Slice 9 replaces this with plan data from the database. Amounts are integer centavos.
import { money, type Money } from "@/lib/domain/money";

export type WalletId = "gcash" | "maya" | "bpi" | "vybe";
export type Bucket = "essentials" | "wants" | "savings";

export interface Transfer {
  id: string;
  name: string;
  bucket: Bucket;
  wallet: WalletId;
  amount: Money;
  sent: boolean;
}

export const WALLETS: { id: WalletId; name: string; cssColor: string; cardVar: string }[] = [
  { id: "gcash", name: "Gcash", cssColor: "var(--w-gcash)", cardVar: "var(--card-1)" },
  { id: "maya", name: "Maya", cssColor: "var(--w-maya)", cardVar: "var(--card-2)" },
  { id: "bpi", name: "BPI", cssColor: "var(--w-bpi)", cardVar: "var(--card-3)" },
  { id: "vybe", name: "Vybe", cssColor: "var(--w-vybe)", cardVar: "var(--card-4)" },
];

const t = (id: string, name: string, bucket: Bucket, wallet: WalletId, pesos: number, sent = false): Transfer => ({
  id,
  name,
  bucket,
  wallet,
  amount: money(pesos * 100),
  sent,
});

export const FIRST_CUTOFF: Transfer[] = [
  t("t1", "Transpo", "essentials", "gcash", 2400, true),
  t("t2", "Food", "essentials", "gcash", 2000, true),
  t("t3", "Contingency", "essentials", "gcash", 550),
  t("t4", "Rent share", "essentials", "bpi", 3000),
  t("t5", "Internet", "essentials", "maya", 1299),
  t("t6", "Installments", "essentials", "bpi", 3000),
  t("t7", "Wants", "wants", "bpi", 5200),
  t("t8", "Emergency fund", "savings", "maya", 4000),
  t("t9", "Travel fund", "savings", "vybe", 2001),
];

export const CUTOFF_TAKE_HOME = money(2_345_000);

// Bucket totals per cutoff, for the stacked bars (pesos).
export const CUTOFF_BUCKETS = [
  { label: "1st cutoff", essentials: 12249, wants: 5200, savings: 6001 },
  { label: "2nd cutoff", essentials: 10550, wants: 5500, savings: 8050 },
];

// Emergency fund balance by month-end, in thousands of pesos. Cap is 60.
export const FORECAST = {
  months: ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  values: [38, 43, 48, 52, 56, 60, 60],
  cap: 60,
};

export const THIRTEENTH = { amount: money(2_400_000), daysLeft: 11, daysTotal: 30, date: "Dec 15", allocationWaiting: 3 };
export const CUTOFF_LABEL = "First cutoff · Dec 1 to 15";
