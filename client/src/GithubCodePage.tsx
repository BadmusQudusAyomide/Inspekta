import { FormEvent, useMemo, useState } from "react";
import { fetchGithubCodeStats, GithubCodeStats } from "./api";

export function GithubCodePage() {
  const initialUrl = useMemo(() => {
    const query = window.location.hash.split("?")[1];
    const params = new URLSearchParams(query ?? "");
    return params.get("url") ?? "";
  }, []);

  const [url, setUrl] = useState(initialUrl);
  const [branch, setBranch] = useState("");
  const [ignoredText, setIgnoredText] = useState("node_modules,dist,build,.next,coverage,venv,__pycache__");
  const [result, setResult] = useState<GithubCodeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchGithubCodeStats({
        url,
        branch: branch.trim() || undefined,
        ignored: ignoredText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setResult(payload);
    } catch (codeError) {
      setError(codeError instanceof Error ? codeError.message : "Unable to load code inventory.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="codeToolShell">
      <div className="codeToolGlow codeToolGlow-one" />
      <div className="codeToolGlow codeToolGlow-two" />

      <main className="codeToolPage">
        <header className="codeToolNav">
          <a className="codeToolBrand" href={window.location.pathname}>
            <span className="codeToolBrandMark">LOC</span>
            <div>
              <strong>Inspekta Code Atlas</strong>
              <small>GitHub repository code inventory</small>
            </div>
          </a>

          <div className="codeToolLinks">
            <a className="codeToolLink" href="#">
              Main audit
            </a>
            <a className="codeToolLink is-active" href="#/github-code">
              Code Atlas
            </a>
          </div>
        </header>

        <section className="codeToolHero">
          <div className="codeToolTag">Standalone Tool</div>
          <h1>Measure a GitHub repo like a real code inventory tool.</h1>
          <p>
            Paste a public repository, choose an optional branch, ignore noisy folders, and get
            totals for files, lines, blanks, comments, LOC, language mix, and the largest source
            files.
          </p>

          <form className="codeToolForm" onSubmit={onSubmit}>
            <div className="codeToolFormGrid">
              <label className="codeToolField codeToolField-wide">
                <span>GitHub repository URL</span>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  required
                />
              </label>

              <label className="codeToolField">
                <span>Branch</span>
                <input
                  type="text"
                  placeholder="Default branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </label>

              <label className="codeToolField">
                <span>Ignore files or directories</span>
                <input
                  type="text"
                  placeholder="node_modules,dist,coverage"
                  value={ignoredText}
                  onChange={(event) => setIgnoredText(event.target.value)}
                />
              </label>
            </div>

            <div className="codeToolActions">
              <button type="submit" disabled={loading}>
                {loading ? "Scanning repository..." : "Get code stats"}
              </button>
              <small>Counts are fetched live from the selected branch and filtered by your ignore list.</small>
            </div>
          </form>

          {error ? <div className="codeToolError">{error}</div> : null}
        </section>

        {result ? (
          <section className="codeToolResults">
            <header className="codeToolHeaderCard">
              <div>
                <div className="codeToolSectionTag">Repository</div>
                <h2>{result.repo}</h2>
                <p>
                  Branch <strong>{result.branch}</strong>
                </p>
              </div>

              <div className="codeToolHeaderMeta">
                <div className="codeToolStatPill">
                  {result.truncated ? "Partial scan" : "Full scan"}
                </div>
                <div className="codeToolStatPill">
                  {result.ignored.length ? `${result.ignored.length} ignore rules` : "No ignore rules"}
                </div>
              </div>
            </header>

            <div className="codeToolMetricGrid">
              <article className="codeToolMetric">
                <span>Visible files</span>
                <strong>{result.totalFiles.toLocaleString()}</strong>
                <small>{result.rawFileCount.toLocaleString()} total blobs before ignore rules</small>
              </article>
              <article className="codeToolMetric">
                <span>Code files</span>
                <strong>{result.codeFiles.toLocaleString()}</strong>
                <small>{result.analyzedFiles.toLocaleString()} files analyzed for metrics</small>
              </article>
              <article className="codeToolMetric">
                <span>Total lines</span>
                <strong>{result.totals.lines.toLocaleString()}</strong>
                <small>Every fetched line including blanks and comments</small>
              </article>
              <article className="codeToolMetric">
                <span>Lines of code</span>
                <strong>{result.totals.linesOfCode.toLocaleString()}</strong>
                <small>Non-blank, non-comment lines only</small>
              </article>
              <article className="codeToolMetric">
                <span>Blank lines</span>
                <strong>{result.totals.blanks.toLocaleString()}</strong>
                <small>Whitespace-only lines</small>
              </article>
              <article className="codeToolMetric">
                <span>Comment lines</span>
                <strong>{result.totals.comments.toLocaleString()}</strong>
                <small>Standalone comment lines</small>
              </article>
            </div>

            <div className="codeToolPanels">
              <article className="codeToolPanel">
                <div className="codeToolPanelTitle">Language breakdown</div>
                <div className="codeToolLanguageList">
                  {result.languages.map((item) => (
                    <div key={item.language} className="codeToolLanguageRow">
                      <div>
                        <strong>{item.language}</strong>
                        <small>{item.files} files</small>
                      </div>
                      <div className="codeToolLanguageMeta">
                        <span>{item.linesOfCode.toLocaleString()} LOC</span>
                        <small>
                          {item.lines.toLocaleString()} lines • {item.comments.toLocaleString()} comments
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="codeToolPanel">
                <div className="codeToolPanelTitle">Scan settings</div>
                <ul className="codeToolFacts">
                  <li>Branch analyzed: {result.branch}</li>
                  <li>Ignore rules: {result.ignored.length ? result.ignored.join(", ") : "none"}</li>
                  <li>Count model: files, lines, blanks, comments, and LOC</li>
                  <li>
                    Safety cap: {result.truncated ? "scan was capped to keep requests reasonable" : "entire recognized set scanned"}
                  </li>
                </ul>
              </article>
            </div>

            <article className="codeToolPanel">
              <div className="codeToolPanelTitle">Largest source files</div>
              <div className="codeToolFileTable">
                {result.largestFiles.map((file) => (
                  <div key={file.path} className="codeToolFileRow">
                    <div>
                      <strong>{file.path}</strong>
                      <small>
                        {file.language} • {file.linesOfCode.toLocaleString()} LOC
                      </small>
                    </div>
                    <div className="codeToolFileMeta">
                      <span>{file.lines.toLocaleString()} lines</span>
                      <span>{file.comments.toLocaleString()} comments</span>
                      <code>{file.sha.slice(0, 7)}</code>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : (
          <section className="codeToolEmpty">
            <div className="codeToolEmptyCard">
              <h2>Start a repository scan.</h2>
              <p>This page is its own tool, so you can style and grow it independently from the main audit.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
