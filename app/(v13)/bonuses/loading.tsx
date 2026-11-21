// Shown at once when a Bonuses year tab is tapped, shaped like the page so nothing jumps when the data lands.
export default function Loading() {
  return (
    <main className="v-main" aria-busy="true" aria-label="Loading bonuses">
      <div className="v-stack v-l">
        <div className="v-skel" style={{ height: 34, width: "min(200px, 50%)" }} />
        <div className="v-skel" style={{ height: 40, width: "min(520px, 100%)", borderRadius: 999 }} />
        <div className="v-cols4">
          <div className="v-stack">
            <div className="v-skel" style={{ height: 190 }} />
            <div className="v-skel" style={{ height: 150 }} />
            <div className="v-skel" style={{ height: 150 }} />
          </div>
          <div className="v-skel" style={{ height: 260 }} />
        </div>
      </div>
    </main>
  );
}
