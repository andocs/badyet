import { describe, expect, it } from 'vitest';
import type { AllocatorSettings, AllocatorState, ForecastMonth } from './allocator';
import { allocateForecast, allocateMonth } from './allocator';
import { yearMonth } from './dates';
import type { Money } from './money';
import { ZERO, parsePesos } from './money';

const p = (t: string): Money => {
  const v = parsePesos(t);
  if (v === undefined) throw new Error(t);
  return v;
};

const S: AllocatorSettings = {
  efTranche: p('100000'),
  efHardCap: p('500000'),
  travelCap: p('150000'),
  wantsCap: p('60000'),
  defaultOrder: ['EF', 'TRAVEL', 'WANTS'],
};

function state(ef: string, travel = '0', wants = '0', travelFirst = false, efFirst = false): AllocatorState {
  return { ef: p(ef), travel: p(travel), wants: p(wants), travelFirst, efFirst, efTarget: ZERO };
}
const none = { exists: false, total: ZERO };
const month = (m: string, pool: string, extra: Partial<ForecastMonth> = {}): ForecastMonth => ({
  month: yearMonth(m),
  pool: p(pool),
  ...extra,
});

describe('allocator fixtures', () => {
  it('V-S1 override EF', () => {
    const r = allocateMonth(state('20000'), month('2026-11', '40000', { override: 'EF' }), S, none);
    expect(r.balances.ef).toBe(p('60000'));
  });

  it('V-S2 EF reaches the tranche, Travel takes the rest', () => {
    const r = allocateMonth(state('95000', '110000'), month('2027-04', '10000', { override: 'EF' }), S, none);
    expect(r.balances.ef).toBe(p('100000'));
    expect(r.status.EF).toBe('CAP_HIT');
    expect(r.balances.travel).toBe(p('115000'));
  });

  it('V-S3 override Travel pauses EF', () => {
    const r = allocateMonth(state('95000'), month('2027-03', '110000', { override: 'TRAVEL' }), S, none);
    expect(r.balances.travel).toBe(p('110000'));
    expect(r.status.EF).toBe('PAUSED');
  });

  it('V-S4 Travel full then Wants full', () => {
    const r = allocateMonth(state('100000', '145000', '30000', true), month('2027-11', '35000'), S, none);
    expect(r.balances.travel).toBe(p('150000'));
    expect(r.balances.wants).toBe(p('60000'));
    expect(r.status.TRAVEL).toBe('CAP_HIT');
    expect(r.status.WANTS).toBe('CAP_HIT');
    expect(r.status.EF).toBe('PAUSED');
  });

  it('V-S5 January resets Travel and Wants', () => {
    const r = allocateMonth(state('110000', '150000', '60000'), month('2028-01', '15000', { override: 'EF' }), S, none);
    expect(r.balances.ef).toBe(p('125000'));
    expect(r.balances.travel).toBe(ZERO);
    expect(r.balances.wants).toBe(ZERO);
  });

  it('V-S6 spill: EF wins the tie with Wants', () => {
    const r = allocateMonth(state('140000', '145000', '0', true), month('2028-06', '15000'), S, none);
    expect(r.balances.travel).toBe(p('150000'));
    expect(r.balances.ef).toBe(p('150000'));
    expect(r.balances.wants).toBe(ZERO);
  });

  it('V-S7 nothing goes past the hard cap', () => {
    const r = allocateMonth(state('495000', '150000', '60000'), month('2030-06', '20000'), S, none);
    expect(r.balances.ef).toBe(p('500000'));
    expect(r.unallocated).toBe(p('15000'));
    expect(r.status.EF).toBe('CAP_HIT');
  });

  it('V-S8 everything full: all unallocated', () => {
    const r = allocateMonth(state('500000', '150000', '60000'), month('2030-06', '12000'), S, none);
    expect(r.unallocated).toBe(p('12000'));
    expect(r.received).toEqual({ EF: ZERO, TRAVEL: ZERO, WANTS: ZERO });
  });

  it('V-S9 Wants cap 0 is never funded and never PAUSED', () => {
    const r = allocateMonth(state('100000', '150000'), month('2030-06', '10000'), { ...S, wantsCap: ZERO }, none);
    expect(r.balances.wants).toBe(ZERO);
    expect(r.status.WANTS).toBe('EMPTY');
  });

  it('V-S10 EF-first window before the CIP month', () => {
    const results = allocateForecast(
      { ef: p('75000'), travel: ZERO, wants: ZERO },
      [month('2027-01', '10000'), month('2027-02', '10000'), month('2027-03', '110000', { cip: true })],
      S,
    );
    expect(results.map((r) => r.balances.ef)).toEqual([p('85000'), p('95000'), p('100000')]);
    expect(results[2]?.status.EF).toBe('CAP_HIT');
    expect(results[2]?.balances.travel).toBe(p('105000'));
  });

  it('V-S11 Travel full: the closer cap (Wants) first', () => {
    const r = allocateMonth(state('40000', '150000', '30000'), month('2027-08', '20000'), S, none);
    expect(r.balances.wants).toBe(p('50000'));
    expect(r.balances.ef).toBe(p('40000'));
  });

  it('V-S12 tie goes to EF', () => {
    const r = allocateMonth(state('40000', '150000', '0'), month('2027-08', '20000'), S, none);
    expect(r.balances.ef).toBe(p('60000'));
  });

  it('V-S13 EF-first window not met: Travel takes the January pool', () => {
    const results = allocateForecast(
      { ef: ZERO, travel: ZERO, wants: ZERO },
      [month('2027-01', '10000'), month('2027-02', '10000'), month('2027-03', '30000', { cip: true })],
      S,
    );
    expect(results[0]?.balances.travel).toBe(p('10000'));
    expect(results[0]?.balances.ef).toBe(ZERO);
  });

  it('V-S14 before the first January: default order', () => {
    const r = allocateMonth(state('20000', '0', '0'), month('2026-10', '20000'), S, none);
    expect(r.balances.ef).toBe(p('40000'));
    expect(r.balances.travel).toBe(ZERO);
  });

  it('money is conserved every month', () => {
    const r = allocateMonth(state('90000', '140000', '10000', true), month('2027-05', '77777'), S, none);
    const got = r.received.EF + r.received.TRAVEL + r.received.WANTS;
    expect(got + r.unallocated).toBe(p('77777'));
  });
});
