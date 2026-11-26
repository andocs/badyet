import type { Decision, TransferPlan } from './decide';
import type { Parsed } from './parsers';
import { resolveAccount, type AccountLite } from './row';
import type { SourceConfig } from './sources';

/**
 * Where a kept capture goes: the account its money is on (null = not known yet, so it is held) and, for a move between two of your
 * accounts, both of them. The capture run and the Rules page's sample test both use this, so the test shows what really happens.
 */
export function placeCapture(
  decision: Extract<Decision, { keep: true }>,
  parsed: Pick<Parsed, 'direction'> & Parsed,
  config: SourceConfig | undefined,
  accounts: readonly AccountLite[],
): { accountId: string | null; plan?: TransferPlan } {
  // A transfer or card payment rule names the accounts it can; what it names is used.
  if (decision.transfer) return { accountId: decision.accountId, plan: decision.transfer };
  const half = decision.move;
  const accountId = half?.own ?? (config ? resolveAccount(config, parsed, accounts) : null);
  // Only the other side was named, and the message says whose this one is: both are known after all.
  if (accountId && half?.other && half.other !== accountId) {
    return { accountId, plan: parsed.direction === 'out' ? { fromAccountId: accountId, toAccountId: half.other } : { fromAccountId: half.other, toAccountId: accountId } };
  }
  return { accountId };
}
