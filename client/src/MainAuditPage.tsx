import { FormEvent, useEffect, useState } from "react";
import { CODE_PAGE_HASH } from "./App";
import {
  analyzeUrl,
  clearHistoryFromApi,
  HistoryEntry,
  loadHistoryIntoState,
  toggleFavoriteInApi
} from "./api";
import { AnalyzeResponse } from "./types";
import {
  activityFreshnessLabel,
  daysTone,
  durationTone,
  formatDays,
  HeadingSamples,
  loadTimeGuidance,
  MetricCard,
  relativeTime,
  scoreLabel,
  scoreTone,
  TagList,
  toneTextClass,
  TopNav
} from "./ui";

const examples = [
  "https://github.com/vercel/next.js",
  "https://stripe.com",
  "https://github.com/expressjs/express",
  "https://www.notion.so"
];

const panelClass =
  "rounded-[28px] border border-white/12 bg-slate-950/60 p-6 shadow-[0_20px_70px_rgba(1,6,20,0.24)] backdrop-blur-xl";

export function MainAuditPage() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    await loadHistoryIntoState(setHistory);
  }

  async function toggleHistoryFavorite(id: string) {
    await toggleFavoriteInApi(id);
    await loadHistory();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = await analyzeUrl(url);
      setData(payload);
      await loadHistory();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Something went wrong while analyzing the URL.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(254,211,48,0.18),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(55,110,255,0.2),transparent_25%),linear-gradient(135deg,#0f172a_0%,#1d293d_45%,#10262e_100%)] text-[#f9f5ef]">
      <div className="pointer-events-none fixed -left-10 -top-28 h-72 w-72 rounded-full bg-[#ff9e7d] opacity-40 blur-[90px]" />
      <div className="pointer-events-none fixed -bottom-8 -right-16 h-60 w-60 rounded-full bg-[#6de2d0] opacity-40 blur-[90px]" />

      <main className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <TopNav current="main" />

        <section className="animate-[fadeUp_500ms_ease]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            URL intelligence for products, founders, and curious engineers
          </div>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            Inspekta turns one pasted link into a sharp, visual audit.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200/85 sm:text-lg">
            Paste a GitHub repo or website URL. We detect the destination, inspect the right signals,
            and render the results in one polished dashboard.
          </p>

          <form className={`${panelClass} mt-8 p-5 sm:p-6`} onSubmit={onSubmit}>
            <label htmlFor="url" className="mb-3 block text-sm text-slate-100">
              URL to inspect
            </label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                id="url"
                type="url"
                placeholder="https://github.com/owner/repo or https://example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                className="min-w-0 flex-1 rounded-2xl border border-white/14 bg-white/5 px-4 py-4 text-white outline-none placeholder:text-slate-400 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-amber-300 to-orange-300 px-6 py-4 font-bold text-slate-950 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
              >
                {loading ? "Inspecting..." : "Inspect now"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-full bg-white/8 px-3 py-2 text-sm text-amber-100 transition hover:bg-white/12"
                  onClick={() => setUrl(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </form>

          {error ? (
            <div className="mt-4 rounded-2xl border border-orange-200/40 bg-orange-300/15 px-4 py-3 text-sm text-orange-50">
              {error}
            </div>
          ) : null}

          {history.length ? (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                  Recent inspections
                </span>
                <button
                  type="button"
                  className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                  onClick={async () => {
                    await clearHistoryFromApi();
                    setHistory([]);
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {history.map((entry) => {
                  const tone = entry.score !== null ? scoreTone(entry.score) : "neutral";
                  const scoreStyles =
                    tone === "good"
                      ? "bg-emerald-400/14 text-emerald-200"
                      : tone === "caution"
                        ? "bg-amber-300/14 text-amber-100"
                        : tone === "danger"
                          ? "bg-rose-300/14 text-rose-100"
                          : "bg-white/6 text-slate-200";

                  return (
                    <article
                      key={entry.id}
                      className="rounded-3xl border border-white/12 bg-white/5 p-4 text-left backdrop-blur-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <strong className={`grid h-12 w-12 place-items-center rounded-2xl text-lg ${scoreStyles}`}>
                          {entry.score !== null ? entry.score : "--"}
                        </strong>
                        <div>
                          <span className="block text-[0.72rem] uppercase tracking-[0.08em] text-amber-200">
                            {entry.kind === "github" ? "GitHub" : "Website"}
                          </span>
                          <small className="text-slate-300">
                            {entry.score !== null ? scoreLabel(entry.score) : "Saved result"}
                          </small>
                        </div>
                      </div>

                      <strong className="block text-white">{entry.label}</strong>
                      <small className="mt-1 block break-words text-slate-400">
                        {entry.subtitle || entry.normalizedUrl}
                      </small>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-slate-100 transition hover:bg-white/10"
                          onClick={() => setUrl(entry.normalizedUrl)}
                        >
                          Open
                        </button>
                        <small className="mr-auto text-slate-400">{relativeTime(entry.inspectedAt)}</small>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            entry.favorite
                              ? "border-amber-300/35 bg-amber-300/18 text-amber-100"
                              : "border-white/12 bg-white/6 text-slate-100 hover:bg-white/10"
                          }`}
                          onClick={async () => {
                            await toggleHistoryFavorite(entry.id);
                          }}
                        >
                          {entry.favorite ? "Starred" : "Star"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        {data ? (
          <section className="mt-9 animate-[fadeUp_650ms_ease]">
            <header className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                  {data.kind === "github" ? "GitHub Repo Analysis" : "Website Analysis"}
                </div>
                <h2 className="mt-2 break-words text-2xl font-bold text-white sm:text-3xl">
                  {data.normalizedUrl}
                </h2>
              </div>
              <div className="grid gap-2 lg:justify-items-end">
                <div className="text-sm text-slate-300">
                  Inspected {new Date(data.inspectedAt).toLocaleString()}
                </div>
                <div className="rounded-full bg-white/8 px-3 py-2 text-sm text-amber-100">
                  Confidence: {data.confidence.level} ({data.confidence.signalCount} signals)
                </div>
              </div>
            </header>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <article className={`${panelClass} bg-[linear-gradient(180deg,rgba(255,211,109,0.12),transparent_70%),rgba(8,15,27,0.62)]`}>
                <div className="mb-3 text-sm font-semibold text-amber-100">Executive summary</div>
                <p className="leading-7 text-slate-100">{data.summary}</p>
                <div className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-amber-200">
                  {data.aiEnhanced ? "AI-assisted summary" : "Inspection summary"}
                </div>
              </article>

              <article className={panelClass}>
                <div className="mb-3 text-sm font-semibold text-amber-100">Top priority</div>
                <p className="leading-7 text-slate-100">{data.topPriority}</p>
                <div className="mt-5 border-t border-white/8 pt-5">
                  <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Inspection highlights
                  </div>
                  <ul className="list-disc space-y-2 pl-5 text-slate-100">
                    {data.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>

            {data.kind === "github" ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Vitality"
                    value={`${data.vitality.score}/100`}
                    tone={scoreTone(data.vitality.score)}
                    helper={scoreLabel(data.vitality.score)}
                  />
                  <MetricCard label="Stars" value={data.repo.stars.toLocaleString()} />
                  <MetricCard label="Contributors" value={data.repo.contributors.toLocaleString()} />
                  <MetricCard
                    label="Days since push"
                    value={String(data.activity.daysSincePush)}
                    tone={daysTone(data.activity.daysSincePush)}
                    helper={activityFreshnessLabel(data.activity.daysSincePush)}
                  />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">Repo health</div>
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <strong className="text-lg text-white">{data.vitality.status}</strong>
                      <span className="text-slate-300">{data.activity.cadence}</span>
                    </div>
                    <ul className="list-disc space-y-2 pl-5 text-slate-100">
                      <li>{data.vitality.reason}</li>
                      <li>Issue pressure: {data.activity.issuePressure}</li>
                      <li>Repo age: {formatDays(data.activity.repoAgeDays)}</li>
                      <li>
                        {data.activity.singleMaintainerRisk
                          ? "Single maintainer risk detected."
                          : "Contributor base looks broader than one person."}
                      </li>
                      <li>
                        {data.repo.archived
                          ? "Repository is archived."
                          : "Repository is still open for development."}
                      </li>
                    </ul>
                  </article>

                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">Tech stack</div>
                    <TagList items={data.techStack} emptyLabel="No strong stack signals detected." />
                    <div className="mt-5 border-t border-white/8 pt-5">
                      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Language breakdown
                      </div>
                      <TagList items={data.languages} emptyLabel="No language breakdown available." />
                    </div>
                  </article>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Activity model"
                    value={`${data.scoreBreakdown.activity}/100`}
                    tone={scoreTone(data.scoreBreakdown.activity)}
                    helper="40% of final score"
                  />
                  <MetricCard
                    label="Docs model"
                    value={`${data.scoreBreakdown.documentation}/100`}
                    tone={scoreTone(data.scoreBreakdown.documentation)}
                    helper="20% of final score"
                  />
                  <MetricCard
                    label="Community model"
                    value={`${data.scoreBreakdown.community}/100`}
                    tone={scoreTone(data.scoreBreakdown.community)}
                    helper="20% of final score"
                  />
                  <MetricCard
                    label="Structure model"
                    value={`${data.scoreBreakdown.structure}/100`}
                    tone={scoreTone(data.scoreBreakdown.structure)}
                    helper="20% of final score"
                  />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard label="Forks" value={data.repo.forks.toLocaleString()} />
                  <MetricCard label="Open issues" value={data.repo.openIssues.toLocaleString()} />
                  <MetricCard label="Repo size" value={`${data.repo.sizeKb.toLocaleString()} KB`} />
                  <MetricCard label="Primary language" value={data.repo.language ?? "Unknown"} />
                  <MetricCard label="License" value={data.repo.license ?? "No license"} />
                  <MetricCard label="Default branch" value={data.repo.defaultBranch} />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <ListPanel title="Key issues" items={data.keyIssues} />
                  <ListPanel title="Quick wins" items={data.quickWins} />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">README quality</div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <strong
                        className={`font-bold ${toneTextClass(
                          scoreTone((data.readmeScore.score / data.readmeScore.maxScore) * 100)
                        )}`}
                      >
                        {data.readmeScore.verdict}
                      </strong>
                      <span className="text-slate-200">
                        {data.readmeScore.score}/{data.readmeScore.maxScore}
                      </span>
                    </div>
                    <ul className="list-disc space-y-2 pl-5 text-slate-100">
                      {data.readmeScore.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </article>

                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">Recent commit</div>
                    {data.recentCommit ? (
                      <div className="grid gap-2">
                        <strong className="text-white">{data.recentCommit.message}</strong>
                        <span className="text-slate-200">{data.recentCommit.author}</span>
                        <span className="text-slate-300">
                          {new Date(data.recentCommit.date).toLocaleString()}
                        </span>
                        <code className="inline-flex w-fit rounded-lg bg-white/8 px-2 py-1 text-sm text-slate-100">
                          {data.recentCommit.sha.slice(0, 7)}
                        </code>
                      </div>
                    ) : (
                      <p className="text-slate-300">No recent commit data available.</p>
                    )}
                  </article>
                </div>

                <article className={`${panelClass} mt-5`}>
                  <div className="mb-3 text-sm font-semibold text-amber-100">Need only lines of code?</div>
                  <p className="text-slate-100">
                    Open the dedicated GitHub code inventory tool for total lines of code, total files,
                    language breakdown, and file-level SHA details.
                  </p>
                  <div className="mt-4">
                    <a
                      className="inline-flex rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-100 no-underline transition hover:bg-white/10"
                      href={`${CODE_PAGE_HASH}?url=${encodeURIComponent(data.normalizedUrl)}`}
                    >
                      Open code inventory page
                    </a>
                  </div>
                </article>
              </>
            ) : (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Overall score"
                    value={`${data.scores.overall}/100`}
                    tone={scoreTone(data.scores.overall)}
                    helper={scoreLabel(data.scores.overall)}
                  />
                  <MetricCard
                    label="SEO score"
                    value={`${data.scores.seo}/100`}
                    tone={scoreTone(data.scores.seo)}
                    helper={scoreLabel(data.scores.seo)}
                  />
                  <MetricCard
                    label="Social score"
                    value={`${data.scores.social}/100`}
                    tone={scoreTone(data.scores.social)}
                    helper={scoreLabel(data.scores.social)}
                  />
                  <MetricCard
                    label="Performance"
                    value={`${data.scores.performance}/100`}
                    tone={scoreTone(data.scores.performance)}
                    helper={scoreLabel(data.scores.performance)}
                  />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <article className={`${panelClass} bg-[linear-gradient(180deg,rgba(255,211,109,0.12),transparent_70%),rgba(8,15,27,0.62)]`}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">Page preview</div>
                    {data.page.screenshot ? (
                      <img
                        className="w-full rounded-3xl border border-white/12"
                        src={`data:image/png;base64,${data.page.screenshot}`}
                        alt={data.page.title}
                      />
                    ) : (
                      <div className="grid min-h-[260px] place-items-center rounded-3xl bg-white/6 text-slate-400">
                        Screenshot unavailable
                      </div>
                    )}
                  </article>

                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">SEO snapshot</div>
                    <ul className="list-disc space-y-2 pl-5 text-slate-100">
                      <li>Title: {data.seo.titlePresent ? `Present (${data.seo.titleLength} chars)` : "Missing"}</li>
                      <li>
                        Meta description:{" "}
                        {data.seo.metaDescriptionPresent
                          ? `Present (${data.seo.descriptionLength} chars)`
                          : "Missing"}
                      </li>
                      <li>Canonical: {data.seo.canonicalPresent ? data.seo.canonicalUrl : "Missing"}</li>
                      <li>
                        H1 / H2 / H3: {data.seo.headings.h1} / {data.seo.headings.h2} / {data.seo.headings.h3}
                      </li>
                    </ul>
                    <div className="mt-5 border-t border-white/8 pt-5">
                      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Heading samples
                      </div>
                      <HeadingSamples data={data.seo.headings.samples} />
                    </div>
                  </article>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard label="Status code" value={String(data.page.statusCode ?? "n/a")} />
                  <MetricCard
                    label="Load time"
                    value={data.page.loadTimeMs ? `${(data.page.loadTimeMs / 1000).toFixed(1)}s` : "n/a"}
                    tone={durationTone(data.page.loadTimeMs ?? 0)}
                    helper={data.page.loadTimeMs ? loadTimeGuidance(data.page.loadTimeMs) : undefined}
                  />
                  <MetricCard
                    label="Page size"
                    value={data.page.pageSizeKb ? `${data.page.pageSizeKb} KB` : "n/a"}
                  />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <ListPanel title="Key issues" items={data.keyIssues} />
                  <ListPanel title="Quick wins" items={data.quickWins} />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">Detected technologies</div>
                    <TagList items={data.technologies} emptyLabel="No obvious stack fingerprints found." />
                    <div className="mt-5 border-t border-white/8 pt-5">
                      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Open Graph
                      </div>
                      <ul className="list-disc space-y-2 pl-5 text-slate-100">
                        <li>Title: {data.seo.og.values.title ?? "Missing"}</li>
                        <li>Description: {data.seo.og.values.description ?? "Missing"}</li>
                        <li>Image: {data.seo.og.values.image ?? "Missing"}</li>
                      </ul>
                    </div>
                  </article>

                  <article className={panelClass}>
                    <div className="mb-3 text-sm font-semibold text-amber-100">Performance hints</div>
                    <ul className="list-disc space-y-2 pl-5 text-slate-100">
                      {data.performanceHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                    <div className="mt-5 border-t border-white/8 pt-5">
                      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Resolved URL
                      </div>
                      <p className="break-words text-slate-300">{data.page.finalUrl}</p>
                    </div>
                  </article>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="mt-9 animate-[fadeUp_650ms_ease]">
            <div className={`${panelClass} p-6`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                What Inspekta checks
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Two analysis engines, one simple input.
              </h2>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <article className="rounded-[24px] bg-white/5 p-6">
                  <div className="mb-3 text-sm font-semibold text-amber-100">Websites</div>
                  <p className="text-slate-100">
                    Framework and CMS hints, SEO basics, social-card validation, load timing, and
                    screenshot previews.
                  </p>
                </article>
                <article className="rounded-[24px] bg-white/5 p-6">
                  <div className="mb-3 text-sm font-semibold text-amber-100">GitHub repos</div>
                  <p className="text-slate-100">
                    AI summaries, stack inference, README quality, contributors, activity cadence,
                    and a vitality verdict.
                  </p>
                </article>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <article className={panelClass}>
      <div className="mb-3 text-sm font-semibold text-amber-100">{title}</div>
      <ul className="list-disc space-y-2 pl-5 text-slate-100">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
