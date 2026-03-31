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
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,rgba(168,85,247,0.24),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.18),transparent_24%),linear-gradient(145deg,#140a24_0%,#1b1436_48%,#23134a_100%)] text-slate-100">
      <div className="pointer-events-none fixed -left-10 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/30 blur-[90px]" />
      <div className="pointer-events-none fixed -bottom-2 -right-14 h-64 w-64 rounded-full bg-violet-500/30 blur-[90px]" />

      <main className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <a className="flex items-center gap-3 text-inherit no-underline" href={window.location.pathname}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 font-extrabold text-fuchsia-50">
                LOC
              </span>
              <div>
                <strong className="block text-sm font-semibold tracking-wide text-white sm:text-base">
                  Inspekta Code Atlas
                </strong>
                <small className="block text-xs text-slate-300 sm:text-sm">
                  GitHub repository code inventory
                </small>
              </div>
            </a>

            <nav className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <a
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-slate-100 no-underline transition hover:bg-white/10"
                href="#"
              >
                Main audit
              </a>
              <a
                className="rounded-full border border-fuchsia-300/25 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 px-4 py-2 text-center text-sm font-medium text-fuchsia-100 no-underline"
                href="#/github-code"
              >
                Code Atlas
              </a>
            </nav>
          </div>
        </header>

        <section className="mt-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200">
            Standalone Tool
          </div>
          <h1 className="max-w-4xl text-4xl font-black leading-none tracking-tight text-white sm:text-5xl lg:text-7xl">
            Measure a GitHub repo like a real code inventory tool.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            Paste a public repository, choose an optional branch, ignore noisy folders, and get
            totals for files, lines, blanks, comments, LOC, language mix, and the largest source
            files.
          </p>

          <form
            className="mt-8 rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-6"
            onSubmit={onSubmit}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  GitHub repository URL
                </span>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white outline-none transition placeholder:text-slate-400 focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-400/30"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Branch</span>
                <input
                  type="text"
                  placeholder="Default branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white outline-none transition placeholder:text-slate-400 focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-400/30"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Ignore files or directories
                </span>
                <input
                  type="text"
                  placeholder="node_modules,dist,coverage"
                  value={ignoredText}
                  onChange={(event) => setIgnoredText(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white outline-none transition placeholder:text-slate-400 focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-400/30"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-4 text-sm font-bold text-fuchsia-50 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80 sm:w-fit"
              >
                {loading ? "Scanning repository..." : "Get code stats"}
              </button>
              <small className="text-sm leading-6 text-slate-300">
                Counts are fetched live from the selected branch and filtered by your ignore list.
              </small>
            </div>
          </form>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="mt-9 space-y-5">
            <header className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                    Repository
                  </div>
                  <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{result.repo}</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Branch <strong className="text-white">{result.branch}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full bg-white/5 px-4 py-2 text-sm text-fuchsia-100">
                    {result.truncated ? "Partial scan" : "Full scan"}
                  </div>
                  <div className="rounded-full bg-white/5 px-4 py-2 text-sm text-fuchsia-100">
                    {result.ignored?.length ? `${result.ignored.length} ignore rules` : "No ignore rules"}
                  </div>
                </div>
              </div>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric title="Visible files" value={result.totalFiles.toLocaleString()} detail={`${result.rawFileCount.toLocaleString()} total blobs before ignore rules`} />
              <Metric title="Code files" value={result.codeFiles.toLocaleString()} detail={`${result.analyzedFiles.toLocaleString()} files analyzed for metrics`} />
              <Metric title="Total lines" value={result.totals.lines.toLocaleString()} detail="Every fetched line including blanks and comments" />
              <Metric title="Lines of code" value={result.totals.linesOfCode.toLocaleString()} detail="Non-blank, non-comment lines only" />
              <Metric title="Blank lines" value={result.totals.blanks.toLocaleString()} detail="Whitespace-only lines" />
              <Metric title="Comment lines" value={result.totals.comments.toLocaleString()} detail="Standalone comment lines" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <article className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                  Language breakdown
                </div>
                <div className="space-y-3">
                  {result.languages.map((item) => (
                    <div
                      key={item.language}
                      className="flex flex-col gap-2 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <strong className="block text-white">{item.language}</strong>
                        <small className="text-slate-400">{item.files} files</small>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="block font-semibold text-fuchsia-100">
                          {item.linesOfCode.toLocaleString()} LOC
                        </span>
                        <small className="text-slate-400">
                          {item.lines.toLocaleString()} lines • {item.comments.toLocaleString()} comments
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                  Scan settings
                </div>
                <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-slate-200">
                  <li>Branch analyzed: {result.branch}</li>
                  <li>Ignore rules: {result.ignored?.length ? result.ignored.join(", ") : "none"}</li>
                  <li>Count model: files, lines, blanks, comments, and LOC</li>
                  <li>
                    Safety cap: {result.truncated ? "scan was capped to keep requests reasonable" : "entire recognized set scanned"}
                  </li>
                </ul>
              </article>
            </div>

            <article className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                Largest source files
              </div>
              <div className="space-y-3">
                {result.largestFiles.map((file) => (
                  <div
                    key={file.path}
                    className="flex flex-col gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <strong className="block break-all text-white">{file.path}</strong>
                      <small className="text-slate-400">
                        {file.language} • {file.linesOfCode.toLocaleString()} LOC
                      </small>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300 lg:justify-end">
                      <span>{file.lines.toLocaleString()} lines</span>
                      <span>{file.comments.toLocaleString()} comments</span>
                      <code className="rounded-lg bg-white/10 px-2 py-1 text-xs text-fuchsia-100">
                        {file.sha.slice(0, 7)}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : (
          <section className="mt-9">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <h2 className="text-2xl font-bold text-white">Start a repository scan.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                This page is its own tool, so you can style and grow it independently from the main
                audit.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <span className="block text-sm text-slate-300">{title}</span>
      <strong className="mt-3 block text-3xl font-black tracking-tight text-white">{value}</strong>
      <small className="mt-2 block text-sm leading-6 text-slate-400">{detail}</small>
    </article>
  );
}
