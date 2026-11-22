-- Card payment fix (rev-30): answering a held capture as a move to one of your own accounts now saves both halves (the paying account
-- and the card). The second row names the first as its peer; this trigger points the first row back at it, so the pair is linked both
-- ways like a move made in Accounts. Only fills a peer that is still empty.
-- Rollback: drop trigger transactions_peer_backlink on transactions; drop function transactions_peer_backlink();

create function transactions_peer_backlink() returns trigger language plpgsql as $$
begin
  update transactions set transfer_peer_id = new.id where id = new.transfer_peer_id and transfer_peer_id is null;
  return new;
end;
$$;

create trigger transactions_peer_backlink
  after insert on transactions
  for each row
  when (new.transfer_peer_id is not null)
  execute function transactions_peer_backlink();
