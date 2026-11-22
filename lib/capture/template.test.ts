import { describe, expect, it } from 'vitest';
import { compileTemplate } from './template';

const run = (template: string, text: string) => {
  const c = compileTemplate(template);
  if (!c.ok) throw new Error(c.error);
  const m = c.value.regex.exec(text);
  return m ? Object.fromEntries(Object.entries(c.value.groups).map(([k, i]) => [k, m[i!]])) : null;
};
const err = (t: string) => {
  const c = compileTemplate(t);
  return c.ok ? '' : c.error;
};

describe('compileTemplate', () => {
  it('reads an amount and a name from the wording you wrote', () => {
    expect(run('You received {amount} from {name}', 'You received ₱1,250.50 from Juan D.')).toEqual({ amount: '1,250.50', name: 'Juan D' });
  });
  it('ignores capital letters and how many spaces there are', () => {
    expect(run('you  received {amount}', 'YOU RECEIVED PHP 100.00 today')).toEqual({ amount: '100.00' });
  });
  it('reads digits and a reference in the middle of the text', () => {
    expect(run('account {last4} has been debited {amount}. Ref {ref}', 'Your account XXXX8167 has been debited PHP 50.00. Ref AB12CD')).toEqual({ amount: '50.00', last4: '8167', ref: 'AB12CD' });
  });
  it('skips what you do not care about with {any}', () => {
    expect(run('paid {amount} of {any} to {name}', 'You paid P112.00 of GCash credits to Jollibee.')).toEqual({ amount: '112.00', name: 'Jollibee' });
  });
  it('treats punctuation in your wording literally', () => {
    expect(run('Success! You sent {amount} (fee incl.)', 'Success! You sent 10.00 (fee incl.)')).toEqual({ amount: '10.00' });
    expect(run('Success! You sent {amount} (fee incl.)', 'Success! You sent 10.00 fee incl')).toBeNull();
  });
  it('does not match a different message', () => {
    expect(run('You received {amount} from {name}', 'Your OTP is 123456')).toBeNull();
  });
  it('explains what is wrong in plain words', () => {
    expect(err('')).toMatch(/Write the wording/);
    expect(err('hello world')).toMatch(/exactly once/);
    expect(err('{amount} {amount} paid')).toMatch(/exactly once/);
    expect(err('paid {amount} to {name} {name}')).toMatch(/only once/);
    expect(err('{amount}')).toMatch(/few words/);
    expect(err('paid {amount} {oops}')).toMatch(/curly brackets/);
    expect(err('x'.repeat(201) + '{amount}')).toMatch(/under 200/);
  });
});
