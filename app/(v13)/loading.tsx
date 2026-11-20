// Shown at once while a page's data loads, so tapping a tab always responds straight away.
export default function Loading() {
  return (
    <main className="v-main" aria-busy="true" aria-label="Loading">
      <div className="v-stack v-l">
        <div className="v-skel" style={{ height: 34, width: "min(280px, 60%)" }} />
        <div className="v-skel" style={{ height: 190 }} />
        <div className="v-grid2">
          <div className="v-skel" style={{ height: 140 }} />
          <div className="v-skel" style={{ height: 140 }} />
        </div>
        <div className="v-skel" style={{ height: 220 }} />
      </div>
    </main>
  );
}
