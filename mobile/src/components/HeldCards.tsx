import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isoDate } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { SOURCE_INFO } from "@/lib/capture/sources";
import { relativeDay, timeLabel } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import { Amount, Body, Card, Chip } from "~/components/ui";
import { resolveHeld } from "~/lib/CaptureRunner";
import type { Held } from "~/lib/captureRun";
import { supabase } from "~/lib/supabase";
import { useSync } from "~/lib/sync";
import { fonts, useTheme } from "~/lib/theme";
import { useLoad } from "~/lib/useLoad";

export interface HeldAccount {
  id: string;
  name: string;
}

/** Your accounts, for the held cards to ask about. */
export function useHeldAccounts() {
  return useLoad(async () => {
    const r = await supabase
      .from("accounts")
      .select("id, name")
      .is("archived_at", null)
      .order("sort")
      .order("created_at");
    if (r.error) throw r.error;
    return (r.data ?? []) as HeldAccount[];
  }).data;
}

/**
 * A capture the app understood but no account claimed, shown as an ordinary Inbox card (same layout as every other one to check). It
 * asks which of your accounts it belongs to and where the money went or came from; once answered it becomes a normal pending card.
 */
export function HeldCard({
  h,
  accounts,
  today,
}: {
  h: Held;
  accounts: HeldAccount[];
  today: ReturnType<typeof isoDate>;
}) {
  const c = useTheme();
  const { syncNow } = useSync();
  const [mine, setMine] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = h.parsed;
  const out = p.direction === "out";
  const iso = new Date(h.postTime).toISOString();
  const otherAcct = accounts.find((a) => a.id === other);

  const finish = async (accountId: string | null) => {
    setBusy(true);
    await resolveHeld({
      hash: h.hash,
      accountId,
      other: otherAcct ? { name: otherAcct.name } : null,
      send: syncNow,
    });
    setBusy(false);
  };

  return (
    <Card>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Body bold>
            {p.counterparty ??
              `${SOURCE_INFO[p.source].label} ${out ? "payment" : "deposit"}`}
          </Body>
          <Text
            style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}
          >
            Which account? · {relativeDay(manilaDate(iso), today)}{" "}
            {timeLabel(iso)} · {SOURCE_INFO[p.source].label}
          </Text>
        </View>
        <Amount
          value={money(out ? -p.amount : p.amount)}
          signed
          style={{ color: out ? c.ink : c.accentText, fontSize: 17 }}
        />
      </View>

      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        {out
          ? "Which of your accounts did it leave?"
          : "Which of your accounts did it arrive in?"}
      </Text>
      <View style={s.chips}>
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            on={mine === a.id}
            onPress={() => {
              setMine(a.id);
              if (other === a.id) setOther(null);
            }}
          />
        ))}
      </View>

      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        {out ? "Where did it go?" : "Where did it come from?"}
      </Text>
      <View style={s.chips}>
        <Chip
          label={
            p.counterparty
              ? `${p.counterparty} (someone else)`
              : "Someone or a shop"
          }
          on={other === null}
          onPress={() => setOther(null)}
        />
        {accounts
          .filter((a) => a.id !== mine)
          .map((a) => (
            <Chip
              key={a.id}
              label={`My ${a.name}`}
              on={other === a.id}
              onPress={() => setOther(a.id)}
            />
          ))}
      </View>
      {otherAcct ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
          It will be matched with the {otherAcct.name} notification as a
          transfer between your accounts.
        </Text>
      ) : null}

      <View style={s.row}>
        <Pressable
          onPress={() => void finish(mine)}
          disabled={!mine || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !mine || busy }}
          style={[
            s.btn,
            { flex: 1, backgroundColor: mine && !busy ? c.accent : c.soft },
          ]}
        >
          <Text
            style={{
              color: mine && !busy ? c.onAccent : c.muted,
              fontFamily: fonts.bodyBold,
              fontSize: 15,
            }}
          >
            {busy ? "Adding…" : mine ? "Use this account" : "Pick an account"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void finish(null)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Not mine"
          style={[s.btn, { backgroundColor: c.soft }]}
        >
          <Text
            style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}
          >
            Not mine
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
