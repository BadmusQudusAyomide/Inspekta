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

const codeExtensions: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".php": "PHP",
  ".rb": "Ruby",
  ".cs": "C#",
  ".cpp": "C++",
  ".cc": "C++",
  ".c": "C",
  ".h": "C/C++ Header",
  ".swift": "Swift",
  ".scala": "Scala",
  ".sh": "Shell",
  ".sql": "SQL",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".json": "JSON",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".toml": "TOML"
};

export async function analyzeGithubCodeStats(parsedUrl: URL) {
  const [owner, repo] = parsedUrl.pathname.split("/").filter(Boolean);

  if (!owner || !repo) {
    throw new Error("GitHub URL must include both owner and repository name.");
  }

  const repoData = await githubFetch<{ default_branch: string }>(`https://api.github.com/repos/${owner}/${repo}`);
  const tree = await githubFetch<TreeResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`
  );

  const allFiles = tree.tree.filter((item) => item.type === "blob");
  const codeFiles = allFiles.filter((item) => detectLanguage(item.path));
  const limitedCodeFiles = codeFiles.slice(0, 80);
  const fileStats = [];

  for (const file of limitedCodeFiles) {
    try {
      const blob = await githubFetch<BlobResponse>(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`);
      const content =
        blob.encoding === "base64" ? Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8") : blob.content;
      const language = detectLanguage(file.path);
      const lines = content ? content.split(/\r?\n/).length : 0;

      fileStats.push({
        path: file.path,
        sha: file.sha,
        language: language ?? "Unknown",
        lines
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("rate limit")) {
        throw error;
      }
    }
  }

  const totalsByLanguage = new Map<string, { language: string; files: number; lines: number }>();

  for (const stat of fileStats) {
    const existing = totalsByLanguage.get(stat.language) ?? { language: stat.language, files: 0, lines: 0 };
    existing.files += 1;
    existing.lines += stat.lines;
    totalsByLanguage.set(stat.language, existing);
  }

  const languages = Array.from(totalsByLanguage.values()).sort((left, right) => right.lines - left.lines);
  const totalLines = fileStats.reduce((sum, item) => sum + item.lines, 0);

  return {
    repo: `${owner}/${repo}`,
    branch: repoData.default_branch,
    totalFiles: allFiles.length,
    codeFiles: codeFiles.length,
    analyzedFiles: fileStats.length,
    totalLines,
    truncated: tree.truncated ?? codeFiles.length > limitedCodeFiles.length,
    languages,
    largestFiles: [...fileStats].sort((left, right) => right.lines - left.lines).slice(0, 10)
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

    throw new Error(`GitHub request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function detectLanguage(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".d.ts") || lowerPath.includes(".min.")) {
    return null;
  }

  const extension = Object.keys(codeExtensions).find((ext) => lowerPath.endsWith(ext));
  return extension ? codeExtensions[extension] : null;
}
