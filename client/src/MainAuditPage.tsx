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
  TopNav
} from "./ui";

const examples = [
  "https://github.com/vercel/next.js",
  "https://stripe.com",
  "https://github.com/expressjs/express",
  "https://www.notion.so"
];

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
    <div className="shell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />

      <main className="page">
        <TopNav current="main" />

        <section className="hero">
          <div className="eyebrow">URL intelligence for products, founders, and curious engineers</div>
          <h1>Inspekta turns one pasted link into a sharp, visual audit.</h1>
          <p className="lede">
            Paste a GitHub repo or website URL. We detect the destination, inspect the right signals,
            and render the results in one polished dashboard.
          </p>

          <form className="searchCard" onSubmit={onSubmit}>
            <label htmlFor="url" className="label">
              URL to inspect
            </label>
            <div className="inputRow">
              <input
                id="url"
                type="url"
                placeholder="https://github.com/owner/repo or https://example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Inspecting..." : "Inspect now"}
              </button>
            </div>
            <div className="exampleRow">
              {examples.map((example) => (
                <button key={example} type="button" className="exampleChip" onClick={() => setUrl(example)}>
                  {example}
                </button>
              ))}
            </div>
          </form>

          {error ? <div className="errorBanner">{error}</div> : null}

          {history.length ? (
            <div className="historyStrip">
              <div className="historyHeader">
                <span className="sectionTag">Recent inspections</span>
                <button
                  type="button"
                  className="ghostButton"
                  onClick={async () => {
                    await clearHistoryFromApi();
                    setHistory([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="historyGrid">
                {history.map((entry) => (
                  <article key={entry.id} className="historyCard">
                    <div className="historyScoreRow">
                      <strong className={`historyScore historyScore-${entry.score !== null ? scoreTone(entry.score) : "neutral"}`}>
                        {entry.score !== null ? entry.score : "--"}
                      </strong>
                      <div className="historyScoreText">
                        <span>{entry.kind === "github" ? "GitHub" : "Website"}</span>
                        <small>{entry.score !== null ? scoreLabel(entry.score) : "Saved result"}</small>
                      </div>
                    </div>
                    <strong>{entry.label}</strong>
                    <small>{entry.subtitle || entry.normalizedUrl}</small>
                    <div className="historyMeta">
                      <button type="button" className="historyOpenButton" onClick={() => setUrl(entry.normalizedUrl)}>
                        Open
                      </button>
                      <small>{relativeTime(entry.inspectedAt)}</small>
                      <button
                        type="button"
                        className={`favoriteButton ${entry.favorite ? "is-favorite" : ""}`}
                        onClick={async () => {
                          await toggleHistoryFavorite(entry.id);
                        }}
                      >
                        {entry.favorite ? "Starred" : "Star"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {data ? (
          <section className="dashboard">
            <header className="dashboardHeader">
              <div>
                <div className="sectionTag">{data.kind === "github" ? "GitHub Repo Analysis" : "Website Analysis"}</div>
                <h2>{data.normalizedUrl}</h2>
              </div>
              <div className="headerMeta">
                <div className="timestamp">Inspected {new Date(data.inspectedAt).toLocaleString()}</div>
                <div className="confidenceBadge">
                  Confidence: {data.confidence.level} ({data.confidence.signalCount} signals)
                </div>
              </div>
            </header>

            <div className="heroGrid">
              <article className="panel emphasis">
                <div className="panelTitle">Executive summary</div>
                <p>{data.summary}</p>
                <div className="miniTag">{data.aiEnhanced ? "AI-assisted summary" : "Inspection summary"}</div>
              </article>

              <article className="panel">
                <div className="panelTitle">Top priority</div>
                <p>{data.topPriority}</p>
                <div className="subsection">
                  <div className="subheading">Inspection highlights</div>
                  <ul className="plainList">
                    {data.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>

            {data.kind === "github" ? (
              <>
                <div className="grid grid-four">
                  <MetricCard label="Vitality" value={`${data.vitality.score}/100`} tone={scoreTone(data.vitality.score)} helper={scoreLabel(data.vitality.score)} />
                  <MetricCard label="Stars" value={data.repo.stars.toLocaleString()} />
                  <MetricCard label="Contributors" value={data.repo.contributors.toLocaleString()} />
                  <MetricCard
                    label="Days since push"
                    value={String(data.activity.daysSincePush)}
                    tone={daysTone(data.activity.daysSincePush)}
                    helper={activityFreshnessLabel(data.activity.daysSincePush)}
                  />
                </div>

                <div className="grid grid-two">
                  <article className="panel">
                    <div className="panelTitle">Repo health</div>
                    <div className="verdictRow">
                      <strong>{data.vitality.status}</strong>
                      <span>{data.activity.cadence}</span>
                    </div>
                    <ul className="plainList">
                      <li>{data.vitality.reason}</li>
                      <li>Issue pressure: {data.activity.issuePressure}</li>
                      <li>Repo age: {formatDays(data.activity.repoAgeDays)}</li>
                      <li>{data.activity.singleMaintainerRisk ? "Single maintainer risk detected." : "Contributor base looks broader than one person."}</li>
                      <li>{data.repo.archived ? "Repository is archived." : "Repository is still open for development."}</li>
                    </ul>
                  </article>

                  <article className="panel">
                    <div className="panelTitle">Tech stack</div>
                    <TagList items={data.techStack} emptyLabel="No strong stack signals detected." />
                    <div className="subsection">
                      <div className="subheading">Language breakdown</div>
                      <TagList items={data.languages} emptyLabel="No language breakdown available." />
                    </div>
                  </article>
                </div>

                <div className="grid grid-four">
                  <MetricCard label="Activity model" value={`${data.scoreBreakdown.activity}/100`} tone={scoreTone(data.scoreBreakdown.activity)} helper="40% of final score" />
                  <MetricCard label="Docs model" value={`${data.scoreBreakdown.documentation}/100`} tone={scoreTone(data.scoreBreakdown.documentation)} helper="20% of final score" />
                  <MetricCard label="Community model" value={`${data.scoreBreakdown.community}/100`} tone={scoreTone(data.scoreBreakdown.community)} helper="20% of final score" />
                  <MetricCard label="Structure model" value={`${data.scoreBreakdown.structure}/100`} tone={scoreTone(data.scoreBreakdown.structure)} helper="20% of final score" />
                </div>

                <div className="grid grid-three">
                  <MetricCard label="Forks" value={data.repo.forks.toLocaleString()} />
                  <MetricCard label="Open issues" value={data.repo.openIssues.toLocaleString()} />
                  <MetricCard label="Repo size" value={`${data.repo.sizeKb.toLocaleString()} KB`} />
                  <MetricCard label="Primary language" value={data.repo.language ?? "Unknown"} />
                  <MetricCard label="License" value={data.repo.license ?? "No license"} />
                  <MetricCard label="Default branch" value={data.repo.defaultBranch} />
                </div>

                <div className="grid grid-two">
                  <article className="panel">
                    <div className="panelTitle">Key issues</div>
                    <ul className="plainList">
                      {data.keyIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="panel">
                    <div className="panelTitle">Quick wins</div>
                    <ul className="plainList">
                      {data.quickWins.map((quickWin) => (
                        <li key={quickWin}>{quickWin}</li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="grid grid-two">
                  <article className="panel">
                    <div className="panelTitle">README quality</div>
                    <div className="verdictRow">
                      <strong className={`toneText tone-${scoreTone((data.readmeScore.score / data.readmeScore.maxScore) * 100)}`}>{data.readmeScore.verdict}</strong>
                      <span>
                        {data.readmeScore.score}/{data.readmeScore.maxScore}
                      </span>
                    </div>
                    <ul className="plainList">
                      {data.readmeScore.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="panel">
                    <div className="panelTitle">Recent commit</div>
                    {data.recentCommit ? (
                      <div className="commitCard">
                        <strong>{data.recentCommit.message}</strong>
                        <span>{data.recentCommit.author}</span>
                        <span>{new Date(data.recentCommit.date).toLocaleString()}</span>
                        <code>{data.recentCommit.sha.slice(0, 7)}</code>
                      </div>
                    ) : (
                      <p>No recent commit data available.</p>
                    )}
                  </article>
                </div>

                <article className="panel codeToolCard">
                  <div className="panelTitle">Need only lines of code?</div>
                  <p>
                    Open the dedicated GitHub code inventory tool for total lines of code, total files,
                    language breakdown, and file-level SHA details.
                  </p>
                  <div className="inventoryActions">
                    <a className="historyOpenButton navAnchor" href={`${CODE_PAGE_HASH}?url=${encodeURIComponent(data.normalizedUrl)}`}>
                      Open code inventory page
                    </a>
                  </div>
                </article>
              </>
            ) : (
              <>
                <div className="grid grid-four">
                  <MetricCard label="Overall score" value={`${data.scores.overall}/100`} tone={scoreTone(data.scores.overall)} helper={scoreLabel(data.scores.overall)} />
                  <MetricCard label="SEO score" value={`${data.scores.seo}/100`} tone={scoreTone(data.scores.seo)} helper={scoreLabel(data.scores.seo)} />
                  <MetricCard label="Social score" value={`${data.scores.social}/100`} tone={scoreTone(data.scores.social)} helper={scoreLabel(data.scores.social)} />
                  <MetricCard label="Performance" value={`${data.scores.performance}/100`} tone={scoreTone(data.scores.performance)} helper={scoreLabel(data.scores.performance)} />
                </div>

                <div className="grid grid-two">
                  <article className="panel emphasis">
                    <div className="panelTitle">Page preview</div>
                    {data.page.screenshot ? (
                      <img className="preview" src={`data:image/png;base64,${data.page.screenshot}`} alt={data.page.title} />
                    ) : (
                      <div className="previewFallback">Screenshot unavailable</div>
                    )}
                  </article>

                  <article className="panel">
                    <div className="panelTitle">SEO snapshot</div>
                    <ul className="plainList">
                      <li>Title: {data.seo.titlePresent ? `Present (${data.seo.titleLength} chars)` : "Missing"}</li>
                      <li>
                        Meta description:{" "}
                        {data.seo.metaDescriptionPresent ? `Present (${data.seo.descriptionLength} chars)` : "Missing"}
                      </li>
                      <li>Canonical: {data.seo.canonicalPresent ? data.seo.canonicalUrl : "Missing"}</li>
                      <li>H1 / H2 / H3: {data.seo.headings.h1} / {data.seo.headings.h2} / {data.seo.headings.h3}</li>
                    </ul>
                    <div className="subsection">
                      <div className="subheading">Heading samples</div>
                      <HeadingSamples data={data.seo.headings.samples} />
                    </div>
                  </article>
                </div>

                <div className="grid grid-three">
                  <MetricCard label="Status code" value={String(data.page.statusCode ?? "n/a")} />
                  <MetricCard
                    label="Load time"
                    value={data.page.loadTimeMs ? `${(data.page.loadTimeMs / 1000).toFixed(1)}s` : "n/a"}
                    tone={durationTone(data.page.loadTimeMs ?? 0)}
                    helper={data.page.loadTimeMs ? loadTimeGuidance(data.page.loadTimeMs) : undefined}
                  />
                  <MetricCard label="Page size" value={data.page.pageSizeKb ? `${data.page.pageSizeKb} KB` : "n/a"} />
                </div>

                <div className="grid grid-two">
                  <article className="panel">
                    <div className="panelTitle">Key issues</div>
                    <ul className="plainList">
                      {data.keyIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="panel">
                    <div className="panelTitle">Quick wins</div>
                    <ul className="plainList">
                      {data.quickWins.map((quickWin) => (
                        <li key={quickWin}>{quickWin}</li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="grid grid-two">
                  <article className="panel">
                    <div className="panelTitle">Detected technologies</div>
                    <TagList items={data.technologies} emptyLabel="No obvious stack fingerprints found." />
                    <div className="subsection">
                      <div className="subheading">Open Graph</div>
                      <ul className="plainList">
                        <li>Title: {data.seo.og.values.title ?? "Missing"}</li>
                        <li>Description: {data.seo.og.values.description ?? "Missing"}</li>
                        <li>Image: {data.seo.og.values.image ?? "Missing"}</li>
                      </ul>
                    </div>
                  </article>

                  <article className="panel">
                    <div className="panelTitle">Performance hints</div>
                    <ul className="plainList">
                      {data.performanceHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                    <div className="subsection">
                      <div className="subheading">Resolved URL</div>
                      <p className="smallText">{data.page.finalUrl}</p>
                    </div>
                  </article>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="emptyState">
            <div className="emptyCard">
              <div className="sectionTag">What Inspekta checks</div>
              <h2>Two analysis engines, one simple input.</h2>
              <div className="grid grid-two compact">
                <article className="panel soft">
                  <div className="panelTitle">Websites</div>
                  <p>Framework and CMS hints, SEO basics, social-card validation, load timing, and screenshot previews.</p>
                </article>
                <article className="panel soft">
                  <div className="panelTitle">GitHub repos</div>
                  <p>AI summaries, stack inference, README quality, contributors, activity cadence, and a vitality verdict.</p>
                </article>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
