// Shown at once while the accounts and their balances load, so a tap on the tab answers straight away.
export default function Loading() {
  return (
    <main className="v-main" aria-busy="true" aria-label="Loading accounts">
      <div className="v-stack v-l">
        <div className="v-skel" style={{ height: 34, width: "min(260px, 60%)" }} />
        <div className="v-acards">
          {[0, 1, 2].map((i) => <div key={i} className="v-skel" style={{ height: 140 }} />)}
        </div>
        <div className="v-skel" style={{ height: 220 }} />
      </div>
    </main>
  );
}
