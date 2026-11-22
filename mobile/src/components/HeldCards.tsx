import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SOURCE_INFO } from '@/lib/capture/sources';
import { money } from '@/lib/domain/money';
import { Body, Card, Chip, Label } from '~/components/ui';
import { resolveHeld, useHeldItems } from '~/lib/CaptureRunner';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { useSync } from '~/lib/sync';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';
import type { Held } from '~/lib/captureRun';

interface Acct {
  id: string;
  name: string;
}

const when = (ms: number) => new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function HeldCard({ h, accounts }: { h: Held; accounts: Acct[] }) {
  const c = useTheme();
  const { hide } = useHide();
  const { syncNow } = useSync();
  const [mine, setMine] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = h.parsed;
  const out = p.direction === 'out';
  const label = SOURCE_INFO[p.source].label;
  const sign = out ? '−' : '+';
  const others = accounts.filter((a) => a.id !== mine);
  const otherAcct = accounts.find((a) => a.id === other);

  const finish = async (accountId: string | null) => {
    setBusy(true);
    await resolveHeld({ hash: h.hash, accountId, other: otherAcct ? { name: otherAcct.name } : null, send: syncNow });
    setBusy(false);
  };

  return (
    <Card style={{ borderColor: c.gold }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Body bold>{p.counterparty ?? `${label} ${out ? 'payment' : 'deposit'}`}</Body>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
            {label} · {when(h.postTime)}
          </Text>
        </View>
        <Text style={{ color: out ? c.ink : c.accentText, fontFamily: fonts.display, fontSize: 17 }}>
          {sign}
          {peso(money(p.amount), hide)}
        </Text>
      </View>
      <Text style={{ color: c.gold, fontFamily: fonts.bodyBold, fontSize: 13 }}>Needs your check: which account is this?</Text>

      <Label>{out ? 'Which of your accounts did it leave?' : 'Which of your accounts did it arrive in?'}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} on={mine === a.id} onPress={() => { setMine(a.id); if (other === a.id) setOther(null); }} />
        ))}
      </View>

      <Label>{out ? 'Where did it go?' : 'Where did it come from?'}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={p.counterparty ? `${p.counterparty} (someone else)` : 'Someone or a shop'} on={other === null} onPress={() => setOther(null)} />
        {others.map((a) => (
          <Chip key={a.id} label={`My ${a.name}`} on={other === a.id} onPress={() => setOther(a.id)} />
        ))}
      </View>
      {otherAcct ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
          This will be matched with the {otherAcct.name} notification as a transfer between your accounts.
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => void finish(mine)}
          disabled={!mine || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !mine || busy }}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: !mine || busy ? 0.5 : 1 }}
        >
          <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Adding…' : 'Add to Inbox'}</Text>
        </Pressable>
        <Pressable
          onPress={() => void finish(null)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Ignore this capture"
          style={{ minHeight: 44, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}
        >
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Ignore</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Captures the app understood but could not place in an account: each one is asked about here, in the Inbox itself. */
export function HeldCards() {
  const held = useHeldItems();
  const { data } = useLoad(async () => {
    const r = await supabase.from('accounts').select('id, name').is('archived_at', null).order('sort').order('created_at');
    if (r.error) throw r.error;
    return (r.data ?? []) as Acct[];
  });
  if (held.length === 0 || !data) return null;
  return (
    <>
      {held.map((h) => (
        <HeldCard key={h.hash} h={h} accounts={data} />
      ))}
    </>
  );
}
