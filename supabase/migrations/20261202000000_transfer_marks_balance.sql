-- Ticking a transfer as sent moves the destination account's balance, and un-ticking moves it back.
-- E-wallets and debit accounts go up by the amount; a credit card goes down (you paid it down) but never below 0.
-- One function does the tick and the balance together so they cannot drift apart, and it only moves a balance
-- when a tick really changed, so marking something twice never counts twice. Runs as the caller, so RLS still applies.

create or replace function public.apply_transfer_marks(p_lines uuid[], p_month text, p_sent boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  if p_sent then
    for r in
      with ins as (
        insert into transfer_marks (line_id, month)
        select unnest(p_lines), p_month
        on conflict (line_id, month) do nothing
        returning line_id
      )
      select l.wallet_id, l.amount from ins join budget_lines l on l.id = ins.line_id where l.wallet_id is not null
    loop
      update wallets w
         set balance = case when w.kind = 'credit' then greatest(0, w.balance - r.amount)
                            else least(w.balance + r.amount, 100000000000) end,
             balance_as_of = today
       where w.id = r.wallet_id;
    end loop;
  else
    for r in
      with del as (
        delete from transfer_marks where line_id = any (p_lines) and month = p_month returning line_id
      )
      select l.wallet_id, l.amount from del join budget_lines l on l.id = del.line_id where l.wallet_id is not null
    loop
      update wallets w
         set balance = case when w.kind = 'credit' then least(w.balance + r.amount, 100000000000)
                            else greatest(0, w.balance - r.amount) end,
             balance_as_of = today
       where w.id = r.wallet_id;
    end loop;
  end if;
end;
$$;

-- Rollback: drop function public.apply_transfer_marks(uuid[], text, boolean);
