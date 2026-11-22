"use client";

import { useState, useTransition, type ReactNode } from "react";
import { saveAccountOrder } from "@/app/(v13)/accounts/actions";
import { dropOn, KIND_LABEL, KIND_ORDER, moveWithinGroup } from "@/lib/accounts/order";
import { useToast } from "../feedback";

export interface BoardItem {
  id: string;
  kind: string;
  /** Linked to a fund, so listed under Fund accounts. */
  fund: boolean;
  name: string;
  color: string;
  /** What is printed on the card. */
  face: ReactNode;
  /** The detail panel for this account, shown when it is selected. */
  panel: ReactNode;
}

/**
 * The account cards, grouped by kind, and the detail panel beside them. Choosing a card switches the panel on the spot (every panel is
 * already on the page), and the cards can be dragged to a new place within their group, or moved with the buttons.
 */
export function AccountsBoard({ items, initial }: { items: BoardItem[]; initial: string | null }) {
  const toast = useToast();
  const [saving, start] = useTransition();
  const [saved, setOrder] = useState(() => items.map((i) => i.id));
  // The two cards that just traded places, shimmering until the change has been saved.
  const [moved, setMoved] = useState<string[]>([]);
  // The order you made, plus any account added since (so a new account never goes missing from the page).
  const itemIds = items.map((i) => i.id);
  const order = [...saved.filter((id) => itemIds.includes(id)), ...itemIds.filter((id) => !saved.includes(id))];
  const [selected, setSelected] = useState(initial ?? items[0]?.id ?? null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const byId = new Map(items.map((i) => [i.id, i]));
  const kindOf = (id: string) => byId.get(id)?.kind ?? "";
  const ordered = order.map((id) => byId.get(id)).filter((i): i is BoardItem => !!i);

  const choose = (id: string) => {
    setSelected(id);
    // Keep the address in step without a trip to the server, so a reload or a shared link opens the same account.
    window.history.replaceState(null, "", `?a=${id}`);
  };
  const commit = (next: string[] | null) => {
    if (!next) return;
    const changed = next.filter((id, i) => id !== order[i]);
    setOrder(next);
    setMoved(changed);
    start(async () => {
      const r = await saveAccountOrder(next);
      setMoved([]);
      if (r.error) {
        setOrder(order);
        toast(r.error, "bad");
      }
    });
  };
  const move = (dir: "earlier" | "later") => selected && commit(moveWithinGroup(order, kindOf, selected, dir));

  const section = (title: string, hint: string | null, list: BoardItem[]) => {
    if (list.length === 0) return null;
    return (
      <section aria-label={title} className="v-stack" style={{ gap: 14 }}>
        <div>
          <h2 style={{ marginBottom: hint ? 2 : 0 }}>{title}</h2>
          {hint ? <div className="v-lbl">{hint}</div> : null}
        </div>
        {KIND_ORDER.map((k) => {
          const inKind = list.filter((i) => i.kind === k);
          if (inKind.length === 0) return null;
          return (
            <div key={k} className="v-agroup">
              <h3 className="v-agh">{KIND_LABEL[k]} <span className="v-muted">· {inKind.length}</span></h3>
              <div className="v-acards">
                {inKind.map((i) => (
                  <div
                    key={i.id}
                    className={`v-acslot${dragging === i.id ? " v-drag" : ""}${over === i.id && dragging !== i.id ? " v-over" : ""}${moved.includes(i.id) ? " v-moved" : ""}`}
                    draggable
                    onDragStart={(e) => { setDragging(i.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", i.id); }}
                    onDragOver={(e) => { if (dragging && dragging !== i.id && kindOf(dragging) === i.kind) { e.preventDefault(); setOver(i.id); } }}
                    onDragLeave={() => setOver((o) => (o === i.id ? null : o))}
                    onDrop={(e) => { e.preventDefault(); if (dragging && kindOf(dragging) === i.kind) commit(dropOn(order, dragging, i.id)); setDragging(null); setOver(null); }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                  >
                    <button type="button" className="v-acard" style={{ "--c": i.color } as React.CSSProperties} aria-pressed={selected === i.id} aria-label={`${i.name}, show details`} onClick={() => choose(i.id)}>
                      {i.face}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    );
  };

  const current = selected ? byId.get(selected) : null;
  const group = current ? ordered.filter((i) => i.kind === current.kind) : [];
  const pos = current ? group.findIndex((i) => i.id === current.id) : -1;

  return (
    <div className="v-cols">
      <div className="v-stack">
        {section("Spending accounts", "Drag a card to put it in a different place in its group.", ordered.filter((i) => !i.fund))}
        {section("Fund accounts", "Linked to a fund, so the fund balance updates itself.", ordered.filter((i) => i.fund))}
      </div>
      <div className="v-stack" style={{ gap: 10 }}>
        {current && group.length > 1 ? (
          <div className="v-row v-sp v-wrap v-sm" role="group" aria-label={`Order of ${KIND_LABEL[current.kind] ?? "accounts"}`}>
            <span className="v-muted">{KIND_LABEL[current.kind] ?? current.kind}: {pos + 1} of {group.length}</span>
            {saving || moved.length > 0 ? <span className="v-saving" role="status"><span className="v-spin" aria-hidden="true" />Saving order…</span> : null}
            <span className="v-row" style={{ gap: 6 }}>
              <button type="button" className="v-btn v-sm" disabled={pos <= 0} onClick={() => move("earlier")} aria-label={`Move ${current.name} earlier`}>← Earlier</button>
              <button type="button" className="v-btn v-sm" disabled={pos < 0 || pos >= group.length - 1} onClick={() => move("later")} aria-label={`Move ${current.name} later`}>Later →</button>
            </span>
          </div>
        ) : null}
        {items.map((i) => (
          <div key={i.id} hidden={i.id !== selected}>{i.panel}</div>
        ))}
      </div>
    </div>
  );
}
