import { formatPesos, type Money } from '@/lib/domain/money';

export const MASK = '*****';

/** Peso text for a centavo amount, or the mask when amounts are hidden. Negatives use a real minus sign. */
export function peso(value: Money, hide: boolean, opts: { symbol?: boolean } = {}): string {
  if (hide) return MASK;
  return formatPesos(value, opts).replace('-', '−');
}
