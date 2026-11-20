-- Slice 3: a private bucket for each account's receive-QR image, and the sign of credit-card balances.
-- SECURITY: the bucket is private (no public URLs). A file lives at <user id>/<account id>.<ext>, and the policies only let you
-- touch files under your own user id. Only the account's own receive QR is kept, never a card, a number or a CVV.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-qr', 'account-qr', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "own qr: select" on storage.objects for select to authenticated
  using (bucket_id = 'account-qr' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own qr: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'account-qr' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own qr: update" on storage.objects for update to authenticated
  using (bucket_id = 'account-qr' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'account-qr' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own qr: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'account-qr' and (storage.foldername(name))[1] = auth.uid()::text);

-- Balances are positions: money you owe is negative, so an expense on a card makes the figure more negative.
-- The data migration copied a card's "owed" amount as a positive number; flip those migrated anchors once.
update public.balance_anchors b
set amount = -b.amount
from public.accounts a
where a.id = b.account_id and a.kind = 'credit' and b.source = 'migration' and b.amount > 0;

-- Rollback:
-- drop policy "own qr: select" on storage.objects; drop policy "own qr: insert" on storage.objects;
-- drop policy "own qr: update" on storage.objects; drop policy "own qr: delete" on storage.objects;
-- delete from storage.buckets where id = 'account-qr';   (remove the files first in the dashboard)
-- update public.balance_anchors b set amount = -b.amount from public.accounts a
--   where a.id = b.account_id and a.kind = 'credit' and b.source = 'migration' and b.amount < 0;
