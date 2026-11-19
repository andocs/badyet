import type { YearMonth } from './dates';
import { isJanuary } from './dates';
import type { Money } from './money';
import { ZERO, add, atLeastZero, min, money, sub, sum } from './money';

/** Savings allocator (planning doc, F.7, decision D-10). Pure: same inputs, same output. */

export type GoalId = 'EF' | 'TRAVEL' | 'WANTS';
export type GoalStatus = 'CAP_HIT' | 'PAUSED' | 'EMPTY' | 'ACTIVE';

export interface AllocatorSettings {
  /** Emergency Fund is funded in steps of this size (for example 100,000). */
  readonly efTranche: Money;
  /** 0 means no hard cap. */
  readonly efHardCap: Money;
  readonly travelCap: Money;
  /** 0 disables Wants. */
  readonly wantsCap: Money;
  readonly defaultOrder: readonly GoalId[];
}

export interface Balances {
  readonly ef: Money;
  readonly travel: Money;
  readonly wants: Money;
}

export interface AllocatorState extends Balances {
  /** A January Travel priority that lasts until Travel reaches its cap. */
  readonly travelFirst: boolean;
  readonly efFirst: boolean;
  readonly efTarget: Money;
}

export interface ForecastMonth {
  readonly month: YearMonth;
  readonly pool: Money;
  /** Per-month override: this goal leads for the month only. */
  readonly override?: GoalId;
  /** The month whose pool includes the CIP windfall. */
  readonly cip?: boolean;
}

export interface MonthResult {
  readonly month: YearMonth;
  readonly pool: Money;
  readonly received: Readonly<Record<GoalId, Money>>;
  readonly balances: Balances;
  readonly status: Readonly<Record<GoalId, GoalStatus>>;
  readonly unallocated: Money;
  /** Human-readable notes, for example an override on a disabled goal that was ignored. */
  readonly notes: readonly string[];
  readonly state: AllocatorState;
}

export const INITIAL_FLAGS = { travelFirst: false, efFirst: false, efTarget: ZERO } as const;

function nextTarget(balance: Money, tranche: Money): Money {
  return money((Math.floor(Math.max(0, balance) / tranche) + 1) * tranche);
}

function efCapacity(ef: Money, s: AllocatorSettings): Money {
  if (s.efHardCap > 0 && ef >= s.efHardCap) {
    return ZERO;
  }
  const target = nextTarget(ef, s.efTranche);
  return sub(s.efHardCap > 0 ? min(target, s.efHardCap) : target, ef);
}

function capacityOf(goal: GoalId, b: Balances, s: AllocatorSettings): Money {
  switch (goal) {
    case 'EF':
      return efCapacity(b.ef, s);
    case 'TRAVEL':
      return atLeastZero(sub(s.travelCap, b.travel));
    case 'WANTS':
      return s.wantsCap === 0 ? ZERO : atLeastZero(sub(s.wantsCap, b.wants));
  }
}

function balanceOf(goal: GoalId, b: Balances): Money {
  return goal === 'EF' ? b.ef : goal === 'TRAVEL' ? b.travel : b.wants;
}

function withBalance(goal: GoalId, b: Balances, value: Money): Balances {
  return {
    ef: goal === 'EF' ? value : b.ef,
    travel: goal === 'TRAVEL' ? value : b.travel,
    wants: goal === 'WANTS' ? value : b.wants,
  };
}

/** The first January pools through the CIP month of the same year, from the forecast. */
function poolsThroughCip(months: readonly ForecastMonth[], index: number): { exists: boolean; total: Money } {
  const start = months[index];
  if (!start) {
    return { exists: false, total: ZERO };
  }
  const year = start.month.slice(0, 4);
  const pools: Money[] = [];
  for (let i = index; i < months.length; i += 1) {
    const m = months[i];
    if (!m || m.month.slice(0, 4) !== year) {
      break;
    }
    pools.push(m.pool);
    if (m.cip === true) {
      return { exists: true, total: sum(pools) };
    }
  }
  return { exists: false, total: ZERO };
}

export function allocateMonth(
  prior: AllocatorState,
  input: ForecastMonth,
  settings: AllocatorSettings,
  januaryLookahead: { exists: boolean; total: Money },
): MonthResult {
  const notes: string[] = [];
  let b: Balances = { ef: prior.ef, travel: prior.travel, wants: prior.wants };
  let { travelFirst, efFirst, efTarget } = prior;

  if (isJanuary(input.month)) {
    b = { ef: b.ef, travel: ZERO, wants: ZERO };
    travelFirst = settings.travelCap > 0;
    efTarget = nextTarget(b.ef, settings.efTranche);
    efFirst = travelFirst && januaryLookahead.exists && efCapacity(b.ef, settings) <= januaryLookahead.total;
  }

  let override = input.override;
  if (override !== undefined && capacityOf(override, b, settings) === 0 && override === 'WANTS' && settings.wantsCap === 0) {
    notes.push('Override on Wants ignored: Wants is disabled.');
    override = undefined;
  }

  const lead: GoalId[] =
    override !== undefined
      ? [override]
      : travelFirst
        ? efFirst && b.ef < efTarget
          ? ['EF', 'TRAVEL']
          : ['TRAVEL']
        : b.travel < settings.travelCap
          ? [...settings.defaultOrder]
          : [];

  const received: Record<GoalId, Money> = { EF: ZERO, TRAVEL: ZERO, WANTS: ZERO };
  const deferred = new Set<GoalId>();
  let pool = input.pool;
  const goals: GoalId[] = [...settings.defaultOrder];

  while (pool > 0) {
    let chosen: GoalId | undefined = lead.find((g) => !deferred.has(g) && capacityOf(g, b, settings) > 0);
    if (chosen === undefined) {
      let best: Money | undefined;
      for (const g of goals) {
        const cap = capacityOf(g, b, settings);
        if (!deferred.has(g) && cap > 0 && (best === undefined || cap < best)) {
          best = cap;
          chosen = g;
        }
      }
    }
    if (chosen === undefined) {
      break;
    }
    const cap = capacityOf(chosen, b, settings);
    const amount = min(pool, cap);
    b = withBalance(chosen, b, add(balanceOf(chosen, b), amount));
    received[chosen] = add(received[chosen], amount);
    pool = sub(pool, amount);
    if (amount === cap) {
      deferred.add(chosen);
    }
  }

  if (b.travel >= settings.travelCap) {
    travelFirst = false;
  }
  // The EF-first window closes after the CIP month: from then on Travel leads again.
  if (input.cip === true) {
    efFirst = false;
  }

  const primary = lead[0];
  const status = {} as Record<GoalId, GoalStatus>;
  for (const g of goals) {
    const balance = balanceOf(g, b);
    const got = received[g];
    const cap = capacityOf(g, b, settings);
    const reachedStep =
      g === 'EF'
        ? got > 0 && (cap === 0 || balance % settings.efTranche === 0)
        : got > 0 && cap === 0;
    if (reachedStep) {
      status[g] = 'CAP_HIT';
    } else if (balance === 0) {
      status[g] = 'EMPTY';
    } else if (got === 0 && cap > 0 && input.pool > 0 && g !== primary) {
      status[g] = 'PAUSED';
    } else {
      status[g] = 'ACTIVE';
    }
  }

  return {
    month: input.month,
    pool: input.pool,
    received,
    balances: b,
    status,
    unallocated: pool,
    notes,
    state: { ...b, travelFirst, efFirst, efTarget },
  };
}

export function allocateForecast(
  start: Balances,
  months: readonly ForecastMonth[],
  settings: AllocatorSettings,
): MonthResult[] {
  let state: AllocatorState = { ...start, ...INITIAL_FLAGS };
  const results: MonthResult[] = [];
  months.forEach((m, index) => {
    const look = isJanuary(m.month) ? poolsThroughCip(months, index) : { exists: false, total: ZERO };
    const result = allocateMonth(state, m, settings, look);
    results.push(result);
    state = result.state;
  });
  return results;
}
