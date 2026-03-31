import { CODE_PAGE_HASH, PageMode } from "./App";

export type Tone = "good" | "caution" | "danger" | "neutral";

const toneClasses: Record<Tone, string> = {
  good: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
  caution: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  danger: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  neutral: "border-white/12 bg-white/6 text-slate-100"
};

const toneTextClasses: Record<Tone, string> = {
  good: "text-emerald-300",
  caution: "text-amber-200",
  danger: "text-rose-200",
  neutral: "text-slate-100"
};

export function TopNav({ current }: { current: PageMode }) {
  return (
    <nav className="mb-7 flex flex-col gap-2 sm:flex-row">
      <a
        className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm no-underline transition ${
          current === "main"
            ? "border-amber-300/35 bg-gradient-to-r from-amber-300/20 to-orange-300/15 text-amber-100"
            : "border-white/12 bg-white/5 text-slate-100 hover:bg-white/8"
        }`}
        href="#"
      >
        Main audit
      </a>
      <a
        className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm no-underline transition ${
          current === "github-code"
            ? "border-fuchsia-300/35 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/18 text-fuchsia-100"
            : "border-white/12 bg-white/5 text-slate-100 hover:bg-white/8"
        }`}
        href={CODE_PAGE_HASH}
      >
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
    <article
      className={`rounded-3xl border p-5 shadow-[0_20px_70px_rgba(1,6,20,0.24)] backdrop-blur-xl ${toneClasses[tone]}`}
    >
      <span className="block text-sm text-slate-300">{label}</span>
      <strong className="mt-3 block text-2xl font-black tracking-tight">{value}</strong>
      {helper ? <small className="mt-2 block text-sm text-slate-300">{helper}</small> : null}
    </article>
  );
}

export function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) {
    return <p className="text-sm text-slate-300">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex rounded-full bg-cyan-300/12 px-3 py-2 text-sm text-cyan-100"
        >
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
    <div className="grid gap-3 md:grid-cols-3">
      {groups.map((group) => (
        <div key={group.label} className="rounded-2xl bg-white/4 p-4">
          <strong className="text-sm text-white">{group.label}</strong>
          {group.items.length ? (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-200">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No samples</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function toneTextClass(tone: Tone) {
  return toneTextClasses[tone];
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
