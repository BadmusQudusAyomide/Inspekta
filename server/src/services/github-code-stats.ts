interface TreeResponse {
  tree: Array<{
    path: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
  }>;
  truncated?: boolean;
}

interface BlobResponse {
  content: string;
  encoding: "base64" | string;
}

interface RepoResponse {
  default_branch: string;
}

interface LanguageConfig {
  name: string;
  lineComments?: string[];
  blockComments?: Array<{ start: string; end: string }>;
}

interface FileMetrics {
  path: string;
  sha: string;
  language: string;
  lines: number;
  blanks: number;
  comments: number;
  linesOfCode: number;
}

const MAX_ANALYZED_FILES = 150;

const languageConfigs: Record<string, LanguageConfig> = {
  ".ts": { name: "TypeScript", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".tsx": { name: "TypeScript", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".js": { name: "JavaScript", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".jsx": { name: "JavaScript", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".mjs": { name: "JavaScript", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".cjs": { name: "JavaScript", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".py": { name: "Python", lineComments: ["#"] },
  ".go": { name: "Go", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".rs": { name: "Rust", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".java": { name: "Java", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".kt": { name: "Kotlin", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".php": { name: "PHP", lineComments: ["//", "#"], blockComments: [{ start: "/*", end: "*/" }] },
  ".rb": { name: "Ruby", lineComments: ["#"] },
  ".cs": { name: "C#", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".cpp": { name: "C++", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".cc": { name: "C++", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".c": { name: "C", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".h": { name: "C/C++ Header", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".swift": { name: "Swift", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".scala": { name: "Scala", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".sh": { name: "Shell", lineComments: ["#"] },
  ".sql": { name: "SQL", lineComments: ["--"], blockComments: [{ start: "/*", end: "*/" }] },
  ".html": { name: "HTML", blockComments: [{ start: "<!--", end: "-->" }] },
  ".css": { name: "CSS", blockComments: [{ start: "/*", end: "*/" }] },
  ".scss": { name: "SCSS", lineComments: ["//"], blockComments: [{ start: "/*", end: "*/" }] },
  ".vue": { name: "Vue", lineComments: ["//"], blockComments: [{ start: "<!--", end: "-->" }, { start: "/*", end: "*/" }] },
  ".svelte": { name: "Svelte", lineComments: ["//"], blockComments: [{ start: "<!--", end: "-->" }, { start: "/*", end: "*/" }] },
  ".json": { name: "JSON" },
  ".yml": { name: "YAML", lineComments: ["#"] },
  ".yaml": { name: "YAML", lineComments: ["#"] },
  ".toml": { name: "TOML", lineComments: ["#"] }
};

export async function analyzeGithubCodeStats(
  parsedUrl: URL,
  options?: { branch?: string; ignored?: string[] }
) {
  const [owner, repo] = parsedUrl.pathname.split("/").filter(Boolean);

  if (!owner || !repo) {
    throw new Error("GitHub URL must include both owner and repository name.");
  }

  const repoData = await githubFetch<RepoResponse>(`https://api.github.com/repos/${owner}/${repo}`);
  const branch = sanitizeBranch(options?.branch) ?? repoData.default_branch;
  const ignored = normalizeIgnoredPatterns(options?.ignored ?? []);

  const tree = await githubFetch<TreeResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );

  const allFiles = tree.tree.filter((item) => item.type === "blob");
  const visibleFiles = allFiles.filter((item) => !shouldIgnorePath(item.path, ignored));
  const codeFiles = visibleFiles.filter((item) => detectLanguageConfig(item.path));
  const limitedCodeFiles = codeFiles.slice(0, MAX_ANALYZED_FILES);
  const fileStats: FileMetrics[] = [];

  for (const file of limitedCodeFiles) {
    try {
      const blob = await githubFetch<BlobResponse>(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`);
      const content =
        blob.encoding === "base64" ? Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8") : blob.content;
      const metrics = measureFile(file.path, file.sha, content);
      if (metrics) {
        fileStats.push(metrics);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("rate limit")) {
        throw error;
      }
    }
  }

  const totalsByLanguage = new Map<
    string,
    { language: string; files: number; lines: number; blanks: number; comments: number; linesOfCode: number }
  >();

  for (const stat of fileStats) {
    const existing = totalsByLanguage.get(stat.language) ?? {
      language: stat.language,
      files: 0,
      lines: 0,
      blanks: 0,
      comments: 0,
      linesOfCode: 0
    };

    existing.files += 1;
    existing.lines += stat.lines;
    existing.blanks += stat.blanks;
    existing.comments += stat.comments;
    existing.linesOfCode += stat.linesOfCode;
    totalsByLanguage.set(stat.language, existing);
  }

  const languages = Array.from(totalsByLanguage.values()).sort((left, right) => right.linesOfCode - left.linesOfCode);
  const totals = fileStats.reduce(
    (sum, item) => {
      sum.lines += item.lines;
      sum.blanks += item.blanks;
      sum.comments += item.comments;
      sum.linesOfCode += item.linesOfCode;
      return sum;
    },
    { lines: 0, blanks: 0, comments: 0, linesOfCode: 0 }
  );

  return {
    repo: `${owner}/${repo}`,
    branch,
    totalFiles: visibleFiles.length,
    rawFileCount: allFiles.length,
    codeFiles: codeFiles.length,
    analyzedFiles: fileStats.length,
    truncated: (tree.truncated ?? false) || codeFiles.length > limitedCodeFiles.length,
    ignored,
    totals,
    languages,
    largestFiles: [...fileStats].sort((left, right) => right.linesOfCode - left.linesOfCode).slice(0, 12)
  };
}

async function githubFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Inspekta",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
    }
  });

  if (!response.ok) {
    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = response.headers.get("x-ratelimit-reset");
      if (remaining === "0") {
        const resetTime = reset ? new Date(Number(reset) * 1000).toLocaleString() : "later";
        throw new Error(
          `GitHub API rate limit reached for code inventory. Add GITHUB_TOKEN in server/.env or retry after ${resetTime}.`
        );
      }

      throw new Error("GitHub denied the code inventory request. Add GITHUB_TOKEN in server/.env for higher API limits.");
    }

    if (response.status === 404) {
      throw new Error("GitHub could not find that repository or branch.");
    }

    throw new Error(`GitHub request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function detectLanguageConfig(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".d.ts") || lowerPath.includes(".min.")) {
    return null;
  }

  const extension = Object.keys(languageConfigs).find((ext) => lowerPath.endsWith(ext));
  return extension ? languageConfigs[extension] : null;
}

function measureFile(path: string, sha: string, content: string) {
  const config = detectLanguageConfig(path);
  if (!config) {
    return null;
  }

  const rows = content.split(/\r?\n/);
  let blanks = 0;
  let comments = 0;
  let linesOfCode = 0;
  let activeBlock: { start: string; end: string } | null = null;

  for (const row of rows) {
    const trimmed = row.trim();

    if (!trimmed) {
      blanks += 1;
      continue;
    }

    const analysis = classifyLine(trimmed, config, activeBlock);
    activeBlock = analysis.activeBlock;

    if (analysis.commentOnly) {
      comments += 1;
      continue;
    }

    linesOfCode += 1;
  }

  return {
    path,
    sha,
    language: config.name,
    lines: rows.length,
    blanks,
    comments,
    linesOfCode
  };
}

function classifyLine(trimmed: string, config: LanguageConfig, activeBlock: { start: string; end: string } | null) {
  if (activeBlock) {
    const endIndex = trimmed.indexOf(activeBlock.end);
    if (endIndex === -1) {
      return { commentOnly: true, activeBlock };
    }

    const after = trimmed.slice(endIndex + activeBlock.end.length).trim();
    if (!after) {
      return { commentOnly: true, activeBlock: null };
    }

    return classifyLine(after, config, null);
  }

  if (config.lineComments?.some((token) => trimmed.startsWith(token))) {
    return { commentOnly: true, activeBlock: null };
  }

  for (const block of config.blockComments ?? []) {
    if (!trimmed.startsWith(block.start)) {
      continue;
    }

    const endIndex = trimmed.indexOf(block.end, block.start.length);
    if (endIndex === -1) {
      return { commentOnly: true, activeBlock: block };
    }

    const after = trimmed.slice(endIndex + block.end.length).trim();
    if (!after) {
      return { commentOnly: true, activeBlock: null };
    }

    return classifyLine(after, config, null);
  }

  return { commentOnly: false, activeBlock: null };
}

function normalizeIgnoredPatterns(patterns: string[]) {
  return patterns
    .map((pattern) => pattern.trim().replace(/^\/+|\/+$/g, "").toLowerCase())
    .filter(Boolean);
}

function shouldIgnorePath(path: string, ignored: string[]) {
  if (!ignored.length) {
    return false;
  }

  const normalizedPath = path.toLowerCase();
  const segments = normalizedPath.split("/");

  return ignored.some((pattern) => {
    if (normalizedPath === pattern) {
      return true;
    }

    if (normalizedPath.startsWith(`${pattern}/`) || normalizedPath.endsWith(`/${pattern}`)) {
      return true;
    }

    return segments.includes(pattern);
  });
}

function sanitizeBranch(branch?: string) {
  const value = branch?.trim();
  return value ? value : undefined;
}
