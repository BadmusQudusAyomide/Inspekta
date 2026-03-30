import { FormEvent, useState } from "react";
import { AnalyzeResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

const examples = [
  "https://github.com/vercel/next.js",
  "https://stripe.com",
  "https://github.com/expressjs/express",
  "https://www.notion.so"
];

function App() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Analysis failed.");
      }

      setData(payload);
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
        </section>

        {data ? (
          <section className="dashboard">
            <header className="dashboardHeader">
              <div>
                <div className="sectionTag">{data.kind === "github" ? "GitHub Repo Analysis" : "Website Analysis"}</div>
                <h2>{data.normalizedUrl}</h2>
              </div>
              <div className="timestamp">Inspected {new Date(data.inspectedAt).toLocaleString()}</div>
            </header>

            <div className="heroGrid">
              <article className="panel emphasis">
                <div className="panelTitle">Executive summary</div>
                <p>{data.kind === "github" ? data.summary : data.summary}</p>
                <div className="miniTag">{data.aiEnhanced ? "Gemini-enhanced" : "Heuristic summary"}</div>
              </article>

              <article className="panel">
                <div className="panelTitle">Inspection highlights</div>
                <ul className="plainList">
                  {(data.kind === "github" ? data.highlights : data.highlights).map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </article>
            </div>

            {data.kind === "github" ? (
              <>
                <div className="grid grid-four">
                  <MetricCard label="Vitality" value={`${data.vitality.score}/100`} />
                  <MetricCard label="Stars" value={data.repo.stars.toLocaleString()} />
                  <MetricCard label="Contributors" value={data.repo.contributors.toLocaleString()} />
                  <MetricCard label="Days since push" value={String(data.activity.daysSincePush)} />
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
                    <div className="panelTitle">README quality</div>
                    <div className="verdictRow">
                      <strong>{data.readmeScore.verdict}</strong>
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
              </>
            ) : (
              <>
                <div className="grid grid-four">
                  <MetricCard label="Overall score" value={`${data.scores.overall}/100`} />
                  <MetricCard label="SEO score" value={`${data.scores.seo}/100`} />
                  <MetricCard label="Social score" value={`${data.scores.social}/100`} />
                  <MetricCard label="Performance" value={`${data.scores.performance}/100`} />
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
                  <MetricCard label="Load time" value={data.page.loadTimeMs ? `${data.page.loadTimeMs} ms` : "n/a"} />
                  <MetricCard label="Page size" value={data.page.pageSizeKb ? `${data.page.pageSizeKb} KB` : "n/a"} />
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
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

function HeadingSamples({
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

function formatDays(days: number) {
  if (days >= 365) {
    return `${Math.round(days / 365)} years`;
  }

  if (days >= 30) {
    return `${Math.round(days / 30)} months`;
  }

  return `${days} days`;
}

export default App;
