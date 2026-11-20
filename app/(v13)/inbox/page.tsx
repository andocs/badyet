import Link from "next/link";

export const metadata = { title: "Inbox · Bad(yet)" };

// Placeholder until slice 3 builds the Inbox (confirm, recategorise, ignore, rules).
export default function Inbox() {
  return (
    <main className="v-main">
      <div className="v-stack v-l v-narrow">
        <h1>Inbox</h1>
        <div className="v-card v-stack">
          <p style={{ margin: 0 }}>The Inbox arrives with the next part of the rehaul. Until then, spending you add with + is confirmed straight away.</p>
          <Link className="v-btn" href="/">Back to Now</Link>
        </div>
      </div>
    </main>
  );
}
