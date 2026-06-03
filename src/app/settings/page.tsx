import { config, DRY_RUN } from "@/lib/config";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { updateGoal } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const services: string[] = settings ? JSON.parse(settings.servicesOffered) : [];
  const targetUsd = settings?.goalTargetUsd ?? config.GOAL_TARGET_USD;
  const deadline = settings?.goalDeadline ?? new Date(config.GOAL_DEADLINE);

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">
        The goal is editable here (it drives the Overview). Operational caps, LLM, email/IMAP and
        secrets live in <code>.env</code> / <code>.env.local</code>.
      </p>

      {/* Editable goal */}
      <div className="section">
        <h3>Goal</h3>
        <form action={updateGoal} className="filters" style={{ marginBottom: 0 }}>
          <div className="field">
            <label>Target (USD)</label>
            <input type="number" name="targetUsd" min="1" step="100" defaultValue={targetUsd} />
          </div>
          <div className="field">
            <label>Deadline</label>
            <input type="date" name="deadline" defaultValue={deadline.toISOString().slice(0, 10)} />
          </div>
          <button className="btn" type="submit">
            Save goal
          </button>
        </form>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Currently {`$${targetUsd.toLocaleString()}`} by {fmtDate(deadline)}. Progress, required
          monthly income, and suggested daily outreach recompute live on the Overview.
        </p>
      </div>

      {/* Read-only env config */}
      <div className="section">
        <h3>Safety &amp; LLM (from .env)</h3>
        <dl className="kv">
          <dt>DRY_RUN</dt>
          <dd>
            {String(DRY_RUN)} {DRY_RUN ? "(nothing is sent)" : "(LIVE sending enabled)"}
          </dd>
          <dt>LLM provider</dt>
          <dd>{config.LLM_PROVIDER}</dd>
          <dt>LLM model</dt>
          <dd>{config.OLLAMA_MODEL}</dd>
          <dt>LLM host</dt>
          <dd>{config.OLLAMA_HOST}</dd>
        </dl>
      </div>

      <div className="section">
        <h3>Email &amp; replies (from .env)</h3>
        <dl className="kv">
          <dt>Daily email cap</dt>
          <dd>{config.EMAIL_DAILY_CAP}</dd>
          <dt>Send window</dt>
          <dd>
            {config.SEND_WINDOW_START}:00 – {config.SEND_WINDOW_END}:00
          </dd>
          <dt>SMTP configured</dt>
          <dd>{config.SMTP_HOST ? "yes" : "no (DRY_RUN only)"}</dd>
          <dt>IMAP polling</dt>
          <dd>{config.IMAP_HOST ? `every ${config.IMAP_POLL_MINUTES} min` : "off (log replies manually)"}</dd>
        </dl>
      </div>

      <div className="section">
        <h3>Services offered</h3>
        <ul>
          {services.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
