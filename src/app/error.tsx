"use client";

// Route-segment error boundary for the dashboard. Catches render/data errors so a
// single failing page never blanks the whole app.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="section" style={{ borderColor: "var(--red)" }}>
      <h2 style={{ color: "var(--red)", marginTop: 0 }}>Something went wrong</h2>
      <p className="muted">{error.message || "An unexpected error occurred."}</p>
      <button className="btn" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
