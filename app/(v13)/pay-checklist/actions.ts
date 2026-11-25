"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import { cancelTransfer, markBillSent, sendLump, undoBillSent } from "@/lib/bills/send";
import { setLineWallet, setPayAccount } from "@/lib/bills/settings";
import type { FormState } from "@/lib/form-state";

const changed = () => {
  for (const p of ["/pay-checklist", "/", "/accounts", "/inbox", "/budget"]) revalidatePath(p);
};
const done = (r: { ok: true } | { error: string }): FormState => {
  if ("error" in r) return { error: r.error };
  changed();
  return { ok: true };
};

/** Tick a line: records one transfer from the payroll account to the line's wallet, so the balances move too. */
export async function tickLine(input: { lineId: string; from: string; amount: string }): Promise<FormState> {
  return done(await markBillSent(await requireAuthed(), input));
}

/** Untick a line you ticked: its transfer is cancelled. */
export async function untickLine(txnId: string): Promise<FormState> {
  return done(await undoBillSent(await requireAuthed(), txnId));
}

/** "Send the rest" on a wallet: one transfer for everything not yet sent there. */
export async function sendRest(input: { from: string; to: string; amount: number }): Promise<FormState> {
  return done(await sendLump(await requireAuthed(), input));
}

/** Undo a transfer made from the checklist (a lump). */
export async function undoTransfer(outId: string): Promise<FormState> {
  return done(await cancelTransfer(await requireAuthed(), outId));
}

export async function choosePayAccount(accountId: string): Promise<FormState> {
  return done(await setPayAccount(await requireAuthed(), accountId));
}

export async function chooseWallet(lineId: string, accountId: string): Promise<FormState> {
  return done(await setLineWallet(await requireAuthed(), lineId, accountId));
}
