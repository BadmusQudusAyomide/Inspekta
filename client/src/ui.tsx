import { CODE_PAGE_HASH, PageMode } from "./App";

export type Tone = "good" | "caution" | "danger" | "neutral";

export function TopNav({ current }: { current: PageMode }) {
  return (
    <nav className="topNav">
      <a className={`navAnchor ${current === "main" ? "is-active" : ""}`} href="#">
        Main audit
      </a>
      <a className={`navAnchor ${current === "github-code" ? "is-active" : ""}`} href={CODE_PAGE_HASH}>
        GitHub code inventory
      </a>
    </nav>
  );
}

export function MetricCard({
  label,
  value,
  tone = "neutral",
  helper
}: {
  label: string;
  value: string;
  tone?: Tone;
  helper?: string;
}) {
  return (
    <article className={`metricCard metricCard-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small className="metricHelper">{helper}</small> : null}
    </article>
  );
}

export function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <div className="tagWrap">
      {items.map((item) => (
        <span key={item} className="tag">
          {item}
        </span>
      ))}
    </div>
  );
}

export function HeadingSamples({
  data
}: {
  data: { h1: string[]; h2: string[]; h3: string[] };
}) {
  const groups = [
    { label: "H1", items: data.h1 },
    { label: "H2", items: data.h2 },
    { label: "H3", items: data.h3 }
  ];

  return (
    <div className="sampleGrid">
      {groups.map((group) => (
        <div key={group.label} className="sampleBlock">
          <strong>{group.label}</strong>
          {group.items.length ? (
            <ul className="plainList compactList">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="smallText">No samples</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function scoreTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 55) return "caution";
  return "danger";
}

export function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Fair";
  if (score >= 35) return "Poor";
  return "Critical";
}

export function daysTone(days: number): Tone {
  if (days <= 14) return "good";
  if (days <= 60) return "caution";
  return "danger";
}

export function activityFreshnessLabel(days: number) {
  if (days <= 14) return "Fresh activity";
  if (days <= 60) return "Somewhat active";
  return "Stale activity";
}

export function durationTone(ms: number): Tone {
  if (ms < 2000) return "good";
  if (ms < 3000) return "caution";
  return "danger";
}

export function loadTimeGuidance(ms: number) {
  if (ms < 2000) return "Fast, target < 3s";
  if (ms < 3000) return "Good, target < 3s";
  if (ms < 5000) return "Slow, target < 3s";
  return "Very slow, target < 3s";
}

export function formatDays(days: number) {
  if (days >= 365) return `${Math.round(days / 365)} years`;
  if (days >= 30) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}

export function relativeTime(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day ago`;
}
