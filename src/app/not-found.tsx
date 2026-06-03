import Link from "next/link";

export default function NotFound() {
  return (
    <div className="section">
      <h2 style={{ marginTop: 0 }}>Not found</h2>
      <p className="muted">That page or lead doesn&apos;t exist.</p>
      <Link className="btn" href="/" style={{ display: "inline-block" }}>
        Back to Overview
      </Link>
    </div>
  );
}
