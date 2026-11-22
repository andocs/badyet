import { describe, expect, it } from 'vitest';
import { planHeldSync } from './heldSync';

const set = (...x: string[]) => new Set(x);

describe('planHeldSync', () => {
  it('uploads a new held capture', () => {
    const p = planHeldSync(['a'], set(), set());
    expect(p.upload).toEqual(['a']);
    expect(p.keep).toEqual(['a']);
    expect([...p.nextSynced]).toEqual(['a']);
  });
  it('leaves one that is already on the server alone', () => {
    const p = planHeldSync(['a'], set('a'), set('a'));
    expect(p.upload).toEqual([]);
    expect(p.staleOnServer).toEqual([]);
  });
  it('drops from the phone one that was answered on the web', () => {
    const p = planHeldSync(['a', 'b'], set('a', 'b'), set('b'));
    expect(p.keep).toEqual(['b']);
    expect(p.upload).toEqual([]);
  });
  it('removes from the server one the phone has since placed itself', () => {
    const p = planHeldSync([], set('a'), set('a'));
    expect(p.staleOnServer).toEqual(['a']);
  });
  it('does not mistake a never-uploaded capture for one answered elsewhere', () => {
    const p = planHeldSync(['a'], set(), set());
    expect(p.keep).toEqual(['a']);
    expect(p.upload).toEqual(['a']);
  });
});
