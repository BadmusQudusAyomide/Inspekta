import { FormEvent, useMemo, useState } from "react";
import { fetchGithubCodeStats, GithubCodeStats } from "./api";
import { MetricCard, TopNav } from "./ui";

export function GithubCodePage() {
  const initialUrl = useMemo(() => {
    const query = window.location.hash.split("?")[1];
    const params = new URLSearchParams(query ?? "");
    return params.get("url") ?? "";
  }, []);

  const [url, setUrl] = useState(initialUrl);
  const [result, setResult] = useState<GithubCodeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchGithubCodeStats(url);
      setResult(payload);
    } catch (codeError) {
      setError(codeError instanceof Error ? codeError.message : "Unable to load code inventory.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell codeShell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />

      <main className="page">
        <TopNav current="github-code" />

        <section className="codeHero">
          <div className="eyebrow">GitHub-only tool</div>
          <h1>Count lines of code without running the full audit.</h1>
          <p className="lede">
            Paste a public GitHub repo link to get total lines of code, code file count, language
            breakdown, and the largest source files with SHA details.
          </p>

          <form className="searchCard codeSearchCard" onSubmit={onSubmit}>
            <label htmlFor="github-url" className="label">
              GitHub repository URL
            </label>
            <div className="inputRow">
              <input
                id="github-url"
                type="url"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Counting..." : "Get code stats"}
              </button>
            </div>
          </form>

          {error ? <div className="errorBanner">{error}</div> : null}
        </section>

        {result ? (
          <section className="dashboard">
            <header className="dashboardHeader">
              <div>
                <div className="sectionTag">GitHub Code Inventory</div>
                <h2>{result.repo}</h2>
              </div>
              <div className="timestamp">Branch {result.branch}</div>
            </header>

            <div className="grid grid-four">
              <MetricCard label="Total files" value={result.totalFiles.toLocaleString()} />
              <MetricCard label="Code files" value={result.codeFiles.toLocaleString()} />
              <MetricCard label="Analyzed files" value={result.analyzedFiles.toLocaleString()} />
              <MetricCard label="Lines of code" value={result.totalLines.toLocaleString()} />
            </div>

            <div className="grid grid-two">
              <article className="panel emphasis">
                <div className="panelTitle">Language breakdown</div>
                <ul className="plainList">
                  {result.languages.map((item) => (
                    <li key={item.language}>
                      {item.language}: {item.lines.toLocaleString()} lines across {item.files} files
                    </li>
                  ))}
                </ul>
              </article>

              <article className="panel">
                <div className="panelTitle">What this tool counts</div>
                <ul className="plainList">
                  <li>Total repository files</li>
                  <li>Recognized code files only</li>
                  <li>Estimated line count from fetched blobs</li>
                  <li>Largest source files with SHA references</li>
                </ul>
                {result.truncated ? (
                  <div className="subsection">
                    <div className="subheading">Safety note</div>
                    <p className="smallText">
                      This inventory was capped to avoid turning the main app into a heavy crawler.
                    </p>
                  </div>
                ) : null}
              </article>
            </div>

            <article className="panel">
              <div className="panelTitle">Largest code files</div>
              <div className="codeTable">
                {result.largestFiles.map((file) => (
                  <div key={file.path} className="codeRow">
                    <div>
                      <strong>{file.path}</strong>
                      <div className="smallText">{file.language}</div>
                    </div>
                    <div className="codeRowMeta">
                      <span>{file.lines.toLocaleString()} lines</span>
                      <code>{file.sha.slice(0, 7)}</code>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : (
          <section className="emptyState">
            <div className="emptyCard">
              <h2>Paste a GitHub repository URL to get code stats.</h2>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
