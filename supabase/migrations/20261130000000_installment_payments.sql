-- One row = this payment (1, 2, 3 ...) of this installment has been paid.

create table public.installment_payments (
  installment_id uuid not null references public.installments (id) on delete cascade,
  seq integer not null check (seq >= 1),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paid_at timestamptz not null default now(),
  primary key (installment_id, seq)
);

alter table public.installment_payments enable row level security;
create policy "own payments: select" on public.installment_payments for select to authenticated using (user_id = auth.uid());
create policy "own payments: insert" on public.installment_payments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.installments i where i.id = installment_id and i.user_id = auth.uid()));
create policy "own payments: delete" on public.installment_payments for delete to authenticated using (user_id = auth.uid());

-- Rollback: drop table public.installment_payments;
