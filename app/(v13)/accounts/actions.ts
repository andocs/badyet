"use server";

import { revalidatePath } from "next/cache";
import { anchorAmount, parseAccountEdit, parseNewAccount } from "@/lib/accounts/v13";
import { requireAuthed } from "@/lib/auth/require";
import { parsePesos } from "@/lib/domain/money";
import type { FormState } from "@/lib/form-state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;
const QR_MAX_BYTES = 1_048_576;

const strings = (fd: FormData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
};
const refresh = () => {
  revalidatePath("/accounts");
  revalidatePath("/");
};

/** Adds an account and its first balance anchor (the opening amount). Never stores a full card number. */
export async function addAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAuthed();
  const parsed = parseNewAccount(strings(fd));
  if (!parsed.ok) return { error: parsed.error };
  const a = parsed.value;

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      name: a.name,
      kind: a.kind,
      institution: a.institution,
      last4: a.last4,
      color: a.color,
      credit_limit: a.creditLimit,
      statement_day: a.statementDay,
      due_day: a.dueDay,
    })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "You already have an account with that name." : "Could not save the account. Try again." };

  const anchor = await supabase.from("balance_anchors").insert({ account_id: data.id, as_of: new Date().toISOString(), amount: anchorAmount(a.kind, a.opening), source: "wizard" });
  if (anchor.error) return { error: "The account was added but its starting balance was not saved. Use Reconcile to set it." };
  refresh();
  return { ok: true };
}

/** Renames an account or changes its bank or wallet name, last four digits and colour. The kind and the balance stay as they are. */
export async function editAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAuthed();
  const id = String(fd.get("account") ?? "");
  if (!UUID.test(id)) return { error: "That account was not found." };
  const parsed = parseAccountEdit(strings(fd));
  if (!parsed.ok) return { error: parsed.error };
  const a = parsed.value;
  const { data, error } = await supabase
    .from("accounts")
    .update({ name: a.name, institution: a.institution, last4: a.last4, color: a.color })
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (error) return { error: error.code === "23505" ? "You already have an account with that name." : "Could not save the account. Try again." };
  if (!data || data.length === 0) return { error: "That account was not found." };
  refresh();
  return { ok: true };
}

/** Sets the account's real balance now. It becomes the latest anchor; confirmed transactions after it move it from there. */
export async function reconcileAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAuthed();
  const id = String(fd.get("account") ?? "");
  if (!UUID.test(id)) return { error: "Pick an account." };
  const entered = parsePesos(String(fd.get("balance") ?? ""));
  if (entered === undefined || entered < 0 || entered > MAX) return { error: "Enter the balance like 1,250.50." };

  const acct = await supabase.from("accounts").select("id, kind").eq("id", id).is("archived_at", null).maybeSingle();
  if (!acct.data) return { error: "That account was not found." };
  const { error } = await supabase.from("balance_anchors").insert({
    account_id: id,
    as_of: new Date().toISOString(),
    amount: anchorAmount(acct.data.kind, entered),
    source: "reconcile",
  });
  if (error) return { error: "Could not save the balance. Try again." };
  refresh();
  return { ok: true };
}

/** Moves money between two of your accounts: two confirmed transfer rows that point at each other. Neither is income or an expense. */
export async function moveMoney(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAuthed();
  const from = String(fd.get("from") ?? "");
  const to = String(fd.get("to") ?? "");
  if (!UUID.test(from) || !UUID.test(to)) return { error: "Pick both accounts." };
  if (from === to) return { error: "Pick two different accounts." };
  const amount = parsePesos(String(fd.get("amount") ?? ""));
  if (amount === undefined || amount <= 0 || amount > MAX) return { error: "Enter an amount above zero." };

  const owned = await supabase.from("accounts").select("id").in("id", [from, to]).is("archived_at", null);
  if ((owned.data ?? []).length !== 2) return { error: "One of those accounts was not found." };

  const now = new Date().toISOString();
  const base = { occurred_at: now, kind: "transfer", source: "transfer", status: "confirmed", confirmed_at: now };
  const { data, error } = await supabase
    .from("transactions")
    .insert([
      { ...base, account_id: from, amount: -amount },
      { ...base, account_id: to, amount },
    ])
    .select("id, account_id");
  if (error || !data || data.length !== 2) return { error: "Could not move the money. Try again." };
  const out = data.find((r) => r.account_id === from)!;
  const inn = data.find((r) => r.account_id === to)!;
  const a = await supabase.from("transactions").update({ transfer_peer_id: inn.id }).eq("id", out.id);
  const b = await supabase.from("transactions").update({ transfer_peer_id: out.id }).eq("id", inn.id);
  if (a.error || b.error) return { error: "The money moved but the two sides were not linked. Check Inbox." };
  refresh();
  return { ok: true };
}

type QrType = { ext: string; mime: string };
/** Checks the file's first bytes, not just its name or declared type. */
function sniffImage(bytes: Uint8Array): QrType | null {
  if (bytes.length > 12 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/** Saves the account's own receive-QR image in the private bucket. PNG, JPEG or WebP, up to 1 MB. */
export async function uploadQr(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAuthed();
  const id = String(fd.get("account") ?? "");
  const file = fd.get("file");
  if (!UUID.test(id)) return { error: "Pick an account." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (file.size > QR_MAX_BYTES) return { error: "That image is over 1 MB. Use a smaller screenshot." };
  const type = sniffImage(new Uint8Array(await file.arrayBuffer()));
  if (!type) return { error: "Use a PNG, JPEG or WebP image." };

  const { data: user } = await supabase.auth.getUser();
  const acct = await supabase.from("accounts").select("id, receive_qr_path").eq("id", id).maybeSingle();
  if (!user.user || !acct.data) return { error: "That account was not found." };

  const path = `${user.user.id}/${id}.${type.ext}`;
  const up = await supabase.storage.from("account-qr").upload(path, file, { upsert: true, contentType: type.mime });
  if (up.error) return { error: "Could not upload the image. Try again." };
  const old = acct.data.receive_qr_path as string | null;
  if (old && old !== path) await supabase.storage.from("account-qr").remove([old]);
  const upd = await supabase.from("accounts").update({ receive_qr_path: path }).eq("id", id);
  if (upd.error) return { error: "The image uploaded but was not linked to the account. Try again." };
  refresh();
  return { ok: true };
}

export async function removeQr(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAuthed();
  const id = String(fd.get("account") ?? "");
  if (!UUID.test(id)) return { error: "Pick an account." };
  const acct = await supabase.from("accounts").select("receive_qr_path").eq("id", id).maybeSingle();
  const path = acct.data?.receive_qr_path as string | null | undefined;
  if (path) await supabase.storage.from("account-qr").remove([path]);
  const upd = await supabase.from("accounts").update({ receive_qr_path: null }).eq("id", id);
  if (upd.error) return { error: "Could not remove the image." };
  refresh();
  return { ok: true };
}

/** Saves the order the accounts were dragged or moved into: positions are renumbered from the list, so accounts that never had one get one. */
export async function saveAccountOrder(ids: string[]): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some((id) => typeof id !== "string" || !UUID.test(id)) || new Set(ids).size !== ids.length) return { error: "That order was not valid." };
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from("accounts").update({ sort: i }).eq("id", id);
    if (error) return { error: "Could not save the order. Try again." };
  }
  refresh();
  return { ok: true };
}
