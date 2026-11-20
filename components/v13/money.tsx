import { formatPesos, type Money as MoneyValue } from "@/lib/domain/money";

/** A peso figure. The `amt` class is what hide-amounts turns into asterisks. A negative shows with a real minus sign. */
export function Money({ value, className = "", signed = false }: { value: MoneyValue; className?: string; signed?: boolean }) {
  const text = formatPesos(value, { symbol: true }).replace("-", "−");
  return <span className={`v-num amt ${className}`.trim()}>{signed && value > 0 ? `+${text}` : text}</span>;
}
