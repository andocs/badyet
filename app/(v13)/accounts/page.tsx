import Link from "next/link";
import { stableColor } from "@/lib/accounts/order";
import { ACCOUNT_COLORS, ACCOUNT_KINDS, creditAvailable, creditOwed } from "@/lib/accounts/v13";
import { isoDate } from "@/lib/domain/dates";
import { formatPesos, money, sum, type Money as MoneyValue } from "@/lib/domain/money";
import { balanceNow } from "@/lib/engine/balances";
import { shortDate } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import { createClient } from "@/lib/supabase/server";
import { ColorPick, FormDialog, KindFields, QrViewer } from "@/components/v13/form-dialog";
import { AccountsBoard } from "@/components/v13/accounts/board";
import { Money } from "@/components/v13/money";
import { addAccount, editAccount, moveMoney, reconcileAccount, removeQr, uploadQr } from "./actions";
import { FormPick } from "@/components/v13/pick";

export const metadata = { title: "Accounts · Bad(yet)" };

interface AccountRow { id: string; name: string; kind: string; institution: string | null; last4: string | null; color: string | null; receive_qr_path: string | null; credit_limit: number | null }
interface AnchorRow { account_id: string; as_of: string; amount: number }
interface TxnRow { id: string; account_id: string; occurred_at: string; amount: number; merchant: string | null; kind: string; status: "pending" | "confirmed" | "ignored" }

const COLORS = ["#2F5BD7", "#087A5A", "#B03030", "#7A3FB8", "#0F7A95", "#B83A86"];

export default async function Accounts({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const { a: selectedParam } = await searchParams;

  const [acctRes, anchorRes, fundRes] = await Promise.all([
    supabase.from("accounts").select("id, name, kind, institution, last4, color, receive_qr_path, credit_limit").is("archived_at", null).order("sort").order("created_at"),
    supabase.from("balance_anchors").select("account_id, as_of, amount"),
    supabase.from("funds").select("name, linked_account_id").is("archived_at", null).not("linked_account_id", "is", null),
  ]);
  const accounts = (acctRes.data ?? []) as AccountRow[];
  const anchors = (anchorRes.data ?? []) as AnchorRow[];
  const fundOf = new Map(((fundRes.data ?? []) as { name: string; linked_account_id: string }[]).map((f) => [f.linked_account_id, f.name]));
  const earliest = anchors.map((x) => x.as_of).sort()[0];
  const txRes = earliest ? await supabase.from("transactions").select("id, account_id, occurred_at, amount, merchant, kind, status").neq("status", "ignored").gte("occurred_at", earliest) : { data: [] };
  const txns = (txRes.data ?? []) as TxnRow[];

  const view = accounts.map((a, i) => {
    const mine = anchors.filter((x) => x.account_id === a.id);
    const latest = [...mine].sort((x, y) => y.as_of.localeCompare(x.as_of))[0];
    const own = txns.filter((t) => t.account_id === a.id);
    const balance = balanceNow(mine.map((x) => ({ asOf: x.as_of, amount: money(x.amount) })), own.map((t) => ({ occurredAt: t.occurred_at, amount: money(t.amount), status: t.status })));
    return { ...a, color: a.color ?? stableColor(a.id, COLORS), balance, latest, own, fund: fundOf.get(a.id) ?? null };
  });
  const selected = view.find((v) => v.id === selectedParam) ?? view[0] ?? null;
  const spending = view.filter((v) => !v.fund);
  const funds = view.filter((v) => v.fund);
  const owned = (list: typeof view) => sum(list.filter((v) => v.kind !== "credit").map((v) => v.balance));
  const pendingTotal = txns.filter((t) => t.status === "pending").length;

  // Every panel is on the page (so choosing a card is instant), so every QR gets its short-lived link.
  const qrUrls: Record<string, string | null> = {};
  await Promise.all(
    view.filter((v) => v.receive_qr_path).map(async (v) => {
      const signed = await supabase.storage.from("account-qr").createSignedUrl(v.receive_qr_path!, 300);
      qrUrls[v.id] = signed.data?.signedUrl ?? null;
    }),
  );

  return (
    <main className="v-main">
      <div className="v-stack">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>Accounts</h1>
            <div className="v-lbl">Balances move when you confirm a transaction. Tap a card to see the math and its QR.</div>
          </div>
          <div className="v-row v-wrap">
            <FormDialog trigger="+ Add account" title="Add account" action={addAccount} submitLabel="Add account">
              <label className="v-field">
                Name
                <input name="name" maxLength={30} required autoComplete="off" />
              </label>
              <label className="v-field">
                Bank or wallet (optional)
                <input name="institution" maxLength={40} autoComplete="off" />
              </label>
              <KindFields kinds={ACCOUNT_KINDS} />
              <label className="v-field">
                Last 4 digits (optional)
                <input name="last4" inputMode="numeric" maxLength={4} autoComplete="off" />
              </label>
              <ColorPick colors={ACCOUNT_COLORS} />
              <p className="v-xs v-muted" style={{ margin: 0 }}>Only the last four digits are kept. Never type a full card or account number.</p>
            </FormDialog>
            {view.length >= 2 ? (
              <FormDialog trigger="Move money" title="Move money" action={moveMoney} submitLabel="Move money">
                <div className="v-two">
                  <div className="v-field">
                    From
                    <FormPick label="From" name="from" defaultValue={view[0]!.id} options={view.map((v) => ({ value: v.id, label: v.name }))} />
                  </div>
                  <div className="v-field">
                    To
                    <FormPick label="To" name="to" defaultValue={view[1]!.id} options={view.map((v) => ({ value: v.id, label: v.name }))} />
                  </div>
                </div>
                <label className="v-field">
                  Amount (₱)
                  <input name="amount" inputMode="decimal" autoComplete="off" required />
                </label>
                <p className="v-xs v-muted" style={{ margin: 0 }}>Counts as a transfer, not income or an expense.</p>
              </FormDialog>
            ) : null}
          </div>
        </div>

        <section className="v-hero">
          <div className="v-row v-sp v-wrap">
            <div>
              <div className="v-lbl">What I have right now</div>
              <div className="v-big v-xl num">{formatPesos(owned(view))}</div>
            </div>
            <div className="v-row v-wrap" style={{ gap: 8 }}>
              <span className="v-pill">Spending <Money value={owned(spending)} /></span>
              {funds.length > 0 ? <span className="v-pill">Funds <Money value={owned(funds)} /></span> : null}
              {pendingTotal > 0 ? <Link href="/inbox" className="v-pill v-warn">{pendingTotal} pending in Inbox</Link> : null}
            </div>
          </div>
        </section>

        {view.length === 0 ? (
          <div className="v-note">No accounts yet. Add your first one to start tracking balances.</div>
        ) : (
          <AccountsBoard
            initial={selected?.id ?? null}
            items={view.map((v) => ({ id: v.id, kind: v.kind, fund: !!v.fund, name: v.name, color: v.color, face: <CardFace v={v} />, panel: <Panel selected={v} qrUrl={qrUrls[v.id] ?? null} /> }))}
          />
        )}
      </div>
    </main>
  );
}

type View = {
  id: string; name: string; kind: string; institution: string | null; receive_qr_path: string | null; last4: string | null; color: string; balance: MoneyValue; credit_limit: number | null;
  latest: AnchorRow | undefined; own: TxnRow[]; fund: string | null;
};

function CardFace({ v }: { v: View }) {
  const owed = v.kind === "credit";
  const avail = owed ? creditAvailable(v.balance, v.credit_limit === null ? null : money(v.credit_limit)) : null;
  const sub: React.ReactNode = owed ? (avail !== null ? <>Available <Money value={avail} /></> : "owed") : v.latest ? `Confirmed ${shortDate(isoDate(manilaDate(v.latest.as_of)))}` : "No balance set yet";
  return (
    <>
      <span className="v-an"><span>{v.name}</span>{v.fund ? <span className="v-tagx">Fund</span> : null}</span>
      <span className="v-ak">{v.kind}{v.last4 ? ` ·· ${v.last4}` : ""}</span>
      <span className="v-ab"><Money value={owed ? creditOwed(v.balance) : v.balance} />{owed ? " owed" : ""}</span>
      <span className="v-as">{sub}</span>
    </>
  );
}


/** One account's detail panel: the sum that proves its balance, reconcile, edit and the receive QR. */
function Panel({ selected, qrUrl }: { selected: View; qrUrl: string | null }) {
  return (
              <aside className="v-card v-detail" aria-label="Account details">
                <div className="v-row">
                  <span className="v-av" style={{ background: selected.color }} aria-hidden="true">{selected.name[0]}</span>
                  <div className="v-grow">
                    <h2>{selected.name}</h2>
                    <div className="v-xs v-muted">{selected.kind}{selected.last4 ? ` ·· ${selected.last4}` : ""}</div>
                  </div>
                  <b className="v-disp" style={{ fontSize: 20 }}><Money value={selected.kind === "credit" ? creditOwed(selected.balance) : selected.balance} />{selected.kind === "credit" ? " owed" : ""}</b>
                </div>

                <Calc v={selected} />

                <div className="v-row v-wrap" style={{ gap: 8, marginBottom: 14 }}>
                  <FormDialog trigger="Reconcile with real balance" triggerClassName="v-btn v-sm" title={`Reconcile ${selected.name}`} action={reconcileAccount} submitLabel="Save balance">
                    <input type="hidden" name="account" value={selected.id} />
                    <label className="v-field">
                      {selected.kind === "credit" ? "What you owe right now (₱)" : "What the bank or wallet shows now (₱)"}
                      <input name="balance" inputMode="decimal" autoComplete="off" required autoFocus />
                    </label>
                  </FormDialog>
                  <FormDialog trigger="Edit account" triggerClassName="v-btn v-sm" title={`Edit ${selected.name}`} action={editAccount} submitLabel="Save">
                    <input type="hidden" name="account" value={selected.id} />
                    <label className="v-field">
                      Name
                      <input name="name" maxLength={30} required autoComplete="off" defaultValue={selected.name} />
                    </label>
                    <label className="v-field">
                      Bank or wallet (optional)
                      <input name="institution" maxLength={40} autoComplete="off" defaultValue={selected.institution ?? ""} />
                    </label>
                    <label className="v-field">
                      Last 4 digits (optional)
                      <input name="last4" inputMode="numeric" maxLength={4} autoComplete="off" defaultValue={selected.last4 ?? ""} />
                    </label>
                    <ColorPick key={selected.id} colors={ACCOUNT_COLORS} initial={selected.color} />
                    <p className="v-xs v-muted" style={{ margin: 0 }}>Only the last four digits are kept. The kind and the balance do not change here.</p>
                  </FormDialog>
                                  {selected.fund ? <span className="v-pill v-ok">Linked to {selected.fund} fund</span> : null}
                </div>

                <div className="v-qrbox">
                  {qrUrl ? (
                    <div className="v-qrimg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt={`Receive QR for ${selected.name}`} />
                    </div>
                  ) : null}
                  <div>
                    <b>Receive QR</b>
                    <div className="v-xs v-muted" style={{ margin: "2px 0 8px" }}>
                      {qrUrl ? "Saved so you can show it when someone pays you. Only the receive QR, never a card number." : selected.fund ? "Fund accounts rarely take payments, so no QR needed." : "Nothing saved yet. PNG, JPEG or WebP, up to 1 MB."}
                    </div>
                    <div className="v-row v-wrap" style={{ gap: 8 }}>
                      {qrUrl ? <QrViewer url={qrUrl} caption={selected.name} /> : null}
                      <FormDialog trigger={qrUrl ? "Replace" : "Add a QR image"} triggerClassName="v-btn v-sm" title="Receive QR image" action={uploadQr} submitLabel="Upload">
                        <input type="hidden" name="account" value={selected.id} />
                        <label className="v-field">
                          Image of your receive QR
                          <input name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
                        </label>
                      </FormDialog>
                      {qrUrl ? (
                        <FormDialog trigger="Remove" triggerClassName="v-btn v-sm v-ghost" title="Remove QR image" action={removeQr} submitLabel="Remove image">
                          <input type="hidden" name="account" value={selected.id} />
                          <p style={{ margin: 0 }}>Delete the saved QR image for {selected.name}?</p>
                        </FormDialog>
                      ) : null}
                    </div>
                  </div>
                </div>
              </aside>
  );
}

/** "The sum that proves it": last confirmed balance, confirmed transactions after it, the balance now, and pending rows not counted. */
function Calc({ v }: { v: View }) {
  const after = v.latest ? v.own.filter((t) => t.status === "confirmed" && Date.parse(t.occurred_at) > Date.parse(v.latest!.as_of)) : [];
  const pending = v.own.filter((t) => t.status === "pending");
  return (
    <div className="v-calc">
      <div className="v-r">
        <span className="v-muted">Last confirmed balance{v.latest ? ` · ${shortDate(isoDate(manilaDate(v.latest.as_of)))}` : ""}</span>
        <Money value={money(v.latest?.amount ?? 0)} />
      </div>
      {after.map((t) => (
        <div className="v-r" key={t.id}>
          <span>{t.merchant ?? (t.kind === "transfer" ? "Transfer" : "Transaction")} <span className="v-xs v-muted">{shortDate(isoDate(manilaDate(t.occurred_at)))}</span></span>
          <Money value={money(t.amount)} signed />
        </div>
      ))}
      <div className="v-r v-t"><span>Balance now</span><Money value={v.balance} /></div>
      {pending.length > 0 ? (
        <div className="v-r v-warnt"><span>Pending, not counted yet</span><Money value={sum(pending.map((t) => money(t.amount)))} signed /></div>
      ) : null}
    </div>
  );
}
