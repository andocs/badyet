"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import { isoDate } from "@/lib/domain/dates";
import type { FormState } from "@/lib/form-state";
import { confirmOthers, createLoan, postponeLoan, recordPayback, removeLoan, type Env, type LendInput, type OthersInput, type PaybackInput, type Result } from "@/lib/lending/write";
import { todayManila } from "@/lib/plans/validate";

const env = (): Env => ({ today: isoDate(todayManila()), newId: () => crypto.randomUUID() });

/** Lending changes balances, the budget, funds and the forecast. */
function done(r: Result): FormState {
  for (const path of ["/", "/inbox", "/lending", "/accounts", "/budget", "/funds", "/forecast", "/bonuses"]) revalidatePath(path);
  return "error" in r ? { error: r.error } : { ok: true };
}

export async function lendMoney(input: LendInput): Promise<FormState> {
  return done(await createLoan(await requireAuthed(), input, env()));
}

export async function paybackLoan(input: PaybackInput): Promise<FormState> {
  return done(await recordPayback(await requireAuthed(), input, env()));
}

export async function postponePayback(input: { loanId: string; newDue: string; note?: string }): Promise<FormState> {
  return done(await postponeLoan(await requireAuthed(), input, env()));
}

export async function deleteLoan(loanId: string): Promise<FormState> {
  return done(await removeLoan(await requireAuthed(), loanId));
}

/** An Inbox item sent to someone else's account: a loan, spending, or neither. */
export async function confirmToOthers(input: { txnId: string; note?: string } & OthersInput): Promise<FormState> {
  return done(await confirmOthers(await requireAuthed(), input, env()));
}
