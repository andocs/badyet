export interface InstallmentInput {
  id?: string;
  name: string;
  kind: 'card' | 'loan';
  /** Centavos. */
  price: number;
  downPayment: number;
  termCount: number;
  /** Annual rate in basis points; 0 for none. */
  rateBp: number;
  /** YYYY-MM-DD: the due date of the first payment. */
  firstDueOn: string;
  cutoff: 'first' | 'second';
  accountId: string | null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

function realDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** The checks on an installment plan from the form, with the same plain messages on the web and the phone. */
export function validateInstallment(input: unknown): Checked<InstallmentInput> {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'Nothing to save.' };
  const p = input as Record<string, unknown>;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (name.length < 1 || name.length > 60) return { ok: false, error: 'Give it a name of up to 60 characters, like "Phone on BPI card".' };
  if (p.id != null && (typeof p.id !== 'string' || !UUID.test(p.id))) return { ok: false, error: 'That plan was not found.' };
  if (p.kind !== 'card' && p.kind !== 'loan') return { ok: false, error: 'Pick card plan or loan.' };
  if (!int(p.price, 1, 100_000_000_000)) return { ok: false, error: 'Enter the full price or loan amount, like 36,000.' };
  const down = p.downPayment == null ? 0 : p.downPayment;
  if (!int(down, 0, 100_000_000_000)) return { ok: false, error: 'Enter the down payment, or leave it empty.' };
  if (down >= p.price) return { ok: false, error: 'The down payment has to be less than the price.' };
  if (!int(p.termCount, 1, 600)) return { ok: false, error: 'Enter how many monthly payments, from 1 to 600.' };
  const rate = p.rateBp == null ? 0 : p.rateBp;
  if (!int(rate, 0, 10_000)) return { ok: false, error: 'The yearly interest rate is 0 to 100%.' };
  if (!realDate(p.firstDueOn)) return { ok: false, error: 'Pick the date of the first payment.' };
  if (p.cutoff !== 'first' && p.cutoff !== 'second') return { ok: false, error: 'Pick the cutoff it is paid from.' };
  const accountId = p.accountId == null || p.accountId === '' ? null : p.accountId;
  if (accountId !== null && (typeof accountId !== 'string' || !UUID.test(accountId))) return { ok: false, error: 'Pick an account from the list.' };
  return {
    ok: true,
    value: {
      id: typeof p.id === 'string' ? p.id : undefined,
      name,
      kind: p.kind,
      price: p.price,
      downPayment: down,
      termCount: p.termCount,
      rateBp: rate,
      firstDueOn: p.firstDueOn,
      cutoff: p.cutoff,
      accountId: accountId as string | null,
    },
  };
}
