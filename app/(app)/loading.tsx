// Shown instantly while a page's data loads, so switching pages never feels frozen.
export default function Loading() {
  return (
    <main className="main" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ height: 34, width: 240, marginBottom: 20 }} />
      <div className="skel" style={{ height: 160, marginBottom: 18 }} />
      <div className="skel" style={{ height: 220 }} />
    </main>
  );
}
