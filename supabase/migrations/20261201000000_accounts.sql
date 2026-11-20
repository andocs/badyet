-- Accounts: a wallet becomes an e-wallet, a debit account or a credit card, with a balance you keep up to date.
-- SECURITY: no full card or account number, CVV or PIN is ever stored. `last4` holds at most the last 4 digits,
-- enforced here so even a bug in the app cannot save a longer number. Rows stay protected by the existing wallet RLS policies.
-- Balance and limit are centavos (bigint). For a credit card, `balance` is what you owe.

alter table public.wallets
  add column kind text not null default 'ewallet' check (kind in ('ewallet', 'debit', 'credit')),
  add column institution text check (institution is null or char_length(institution) between 1 and 40),
  add column last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  add column balance bigint not null default 0 check (balance >= 0 and balance <= 100000000000),
  add column balance_as_of date,
  add column credit_limit bigint check (credit_limit is null or (credit_limit > 0 and credit_limit <= 100000000000)),
  add column statement_day smallint check (statement_day is null or statement_day between 1 and 31),
  add column due_day smallint check (due_day is null or due_day between 1 and 31),
  add constraint wallets_credit_only check (kind = 'credit' or (credit_limit is null and statement_day is null and due_day is null));

-- Rollback:
-- alter table public.wallets drop constraint wallets_credit_only,
--   drop column kind, drop column institution, drop column last4, drop column balance, drop column balance_as_of,
--   drop column credit_limit, drop column statement_day, drop column due_day;
