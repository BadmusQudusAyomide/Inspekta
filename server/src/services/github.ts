import { GoogleGenerativeAI } from "@google/generative-ai";

interface RepoApiResponse {
  full_name: string;
  name: string;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  open_issues_count: number;
  default_branch: string;
  pushed_at: string;
  created_at: string;
  size: number;
  archived: boolean;
  language: string | null;
  license: { name: string } | null;
}

interface CommitResponse {
  sha: string;
  commit: {
    author: {
      date: string;
      name: string;
    };
    message: string;
  };
}

export async function analyzeGithubRepo(parsedUrl: URL) {
  const [owner, repo] = parsedUrl.pathname.split("/").filter(Boolean);

  if (!owner || !repo) {
    throw new Error("GitHub URL must include both owner and repository name.");
  }

  const repoData = await githubFetch<RepoApiResponse>(`https://api.github.com/repos/${owner}/${repo}`);
  const [readmeText, contributors, commits, contents, languages] = await Promise.all([
    fetchReadme(owner, repo),
    fetchContributors(owner, repo),
    githubFetch<CommitResponse[]>(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
    githubFetch<Array<{ name: string }>>(`https://api.github.com/repos/${owner}/${repo}/contents`),
    githubFetch<Record<string, number>>(`https://api.github.com/repos/${owner}/${repo}/languages`)
  ]);

  const techStack = inferRepoStack(readmeText, contents.map((item) => item.name));
  const readmeScore = scoreReadme(readmeText);
  const activity = getRepoActivity({
    pushedAt: repoData.pushed_at,
    createdAt: repoData.created_at,
    openIssues: repoData.open_issues_count,
    contributors
  });
  const summary = await summarizeProject({
    repo: `${owner}/${repo}`,
    description: repoData.description,
    readmeText,
    techStack
  });
  const vitality = getRepoVitality({
    pushedAt: repoData.pushed_at,
    stars: repoData.stargazers_count,
    openIssues: repoData.open_issues_count,
    contributors
  });
  const recentCommit = commits[0]
    ? {
        sha: commits[0].sha,
        message: commits[0].commit.message,
        date: commits[0].commit.author.date,
        author: commits[0].commit.author.name
      }
    : null;

  const languageBreakdown = Object.entries(languages)
    .sort((left, right) => right[1] - left[1])
    .map(([name]) => name)
    .slice(0, 6);

  return {
    repo: {
      owner,
      name: repo,
      fullName: repoData.full_name,
      description: repoData.description,
      homepage: repoData.homepage,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.subscribers_count,
      openIssues: repoData.open_issues_count,
      defaultBranch: repoData.default_branch,
      lastPushAt: repoData.pushed_at,
      createdAt: repoData.created_at,
      archived: repoData.archived,
      sizeKb: repoData.size,
      license: repoData.license?.name ?? null,
      language: repoData.language,
      contributors
    },
    summary: summary.text,
    aiEnhanced: summary.aiEnhanced,
    techStack,
    languages: languageBreakdown,
    readmeScore,
    vitality,
    activity,
    highlights: buildRepoHighlights({
      archived: repoData.archived,
      vitalityStatus: vitality.status,
      readmeVerdict: readmeScore.verdict,
      contributors,
      openIssues: repoData.open_issues_count,
      languageBreakdown
    }),
    recentCommit
  };
}

async function githubFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Inspekta"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function fetchReadme(owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      "User-Agent": "Inspekta"
    }
  });
  if (!response.ok) {
    return "";
  }

  return response.text();
}

async function fetchContributors(owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Inspekta"
    }
  });

  if (!response.ok) {
    return 0;
  }

  const contributors = (await response.json()) as Array<{ login: string }>;
  return contributors.length;
}

function inferRepoStack(readmeText: string, rootFiles: string[]) {
  const corpus = `${readmeText}\n${rootFiles.join("\n")}`.toLowerCase();
  const pairs: Array<[string, string[]]> = [
    ["TypeScript", ["typescript", "tsconfig.json"]],
    ["JavaScript", ["javascript", "package.json"]],
    ["React", ["react", "next.js", "vite"]],
    ["Next.js", ["next.config", "next.js"]],
    ["Vite", ["vite.config"]],
    ["Node.js", ["node.js", "package.json", "express"]],
    ["Express", ["express"]],
    ["Python", ["requirements.txt", "pyproject.toml", "python"]],
    ["Django", ["django"]],
    ["Flask", ["flask"]],
    ["Go", ["go.mod", "golang"]],
    ["Rust", ["cargo.toml", "rust"]],
    ["Docker", ["dockerfile", "docker-compose"]],
    ["PostgreSQL", ["postgres", "postgresql"]],
    ["MongoDB", ["mongodb", "mongoose"]],
    ["Tailwind CSS", ["tailwind"]],
    ["Prisma", ["prisma"]],
    ["GraphQL", ["graphql"]]
  ];

  return pairs
    .filter(([, needles]) => needles.some((needle) => corpus.includes(needle)))
    .map(([label]) => label);
}

function scoreReadme(readmeText: string) {
  const notes: string[] = [];
  let score = 0;

  if (readmeText.length > 300) {
    score += 2;
    notes.push("README has enough content to explain the project.");
  } else {
    notes.push("README is thin and may not orient new visitors quickly.");
  }

  if (/#+\s+(install|setup|get started|getting started)/i.test(readmeText)) {
    score += 2;
    notes.push("Setup instructions are present.");
  } else {
    notes.push("Missing obvious setup or getting-started instructions.");
  }

  if (/#+\s+(usage|example|examples)/i.test(readmeText)) {
    score += 2;
    notes.push("README includes usage guidance or examples.");
  } else {
    notes.push("Usage examples are missing or hard to spot.");
  }

  if (/!\[[^\]]*\]\([^)]+\)/.test(readmeText)) {
    score += 1;
    notes.push("Visual assets help make the README easier to scan.");
  }

  if (/\[[^\]]+\]\([^)]+\)/.test(readmeText)) {
    score += 1;
    notes.push("README includes linked references or documentation.");
  }

  if (/license/i.test(readmeText)) {
    score += 1;
    notes.push("License information is mentioned.");
  }

  if (/contribut/i.test(readmeText)) {
    score += 1;
    notes.push("Contribution guidance is present.");
  }

  const verdict =
    score >= 8 ? "Excellent" : score >= 6 ? "Strong" : score >= 4 ? "Fair" : "Weak";

  return {
    score,
    maxScore: 10,
    verdict,
    notes
  };
}

function getRepoVitality(input: {
  pushedAt: string;
  stars: number;
  openIssues: number;
  contributors: number;
}) {
  const lastPush = new Date(input.pushedAt).getTime();
  const ageDays = Math.max(0, Math.round((Date.now() - lastPush) / (1000 * 60 * 60 * 24)));

  let score = 100;
  if (ageDays > 30) score -= 15;
  if (ageDays > 90) score -= 25;
  if (ageDays > 180) score -= 20;
  if (input.openIssues > 200) score -= 10;
  if (input.contributors <= 1) score -= 5;
  if (input.stars === 0) score -= 5;
  if (input.stars > 1000) score += 5;

  score = Math.max(5, Math.min(100, score));

  const status =
    score >= 75 ? "Alive and active" : score >= 50 ? "Maintained with caution" : "Possibly stale";
  const reason =
    ageDays <= 30
      ? "Recent activity suggests the project is actively maintained."
      : ageDays <= 90
        ? "The repo has moved recently, but not extremely often."
        : "The repo has been quiet for a while, so maintenance may be slowing down.";

  return { status, score, reason };
}

function getRepoActivity(input: {
  pushedAt: string;
  createdAt: string;
  openIssues: number;
  contributors: number;
}) {
  const now = Date.now();
  const daysSincePush = Math.max(0, Math.round((now - new Date(input.pushedAt).getTime()) / (1000 * 60 * 60 * 24)));
  const repoAgeDays = Math.max(1, Math.round((now - new Date(input.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  const issuePressure =
    input.openIssues > 200 ? "High" : input.openIssues > 50 ? "Moderate" : "Low";
  const cadence =
    daysSincePush <= 14
      ? "Fresh activity"
      : daysSincePush <= 60
        ? "Recently active"
        : daysSincePush <= 180
          ? "Slower cadence"
          : "Quiet lately";

  return {
    daysSincePush,
    repoAgeDays,
    issuePressure,
    cadence,
    singleMaintainerRisk: input.contributors <= 1
  };
}

function buildRepoHighlights(input: {
  archived: boolean;
  vitalityStatus: string;
  readmeVerdict: string;
  contributors: number;
  openIssues: number;
  languageBreakdown: string[];
}) {
  const highlights: string[] = [];

  if (input.archived) {
    highlights.push("This repository is archived, so new development is likely paused.");
  } else {
    highlights.push(`Project status reads as ${input.vitalityStatus.toLowerCase()}.`);
  }

  highlights.push(`README quality is ${input.readmeVerdict.toLowerCase()}, which affects onboarding confidence.`);
  highlights.push(
    input.contributors <= 1
      ? "Contributor footprint is tiny, so maintenance may depend on one person."
      : `Contributor footprint spans ${input.contributors} public contributors.`
  );

  if (input.openIssues > 200) {
    highlights.push("Open issue volume is heavy, which may indicate backlog pressure.");
  }

  if (input.languageBreakdown.length) {
    highlights.push(`Language mix is led by ${input.languageBreakdown.slice(0, 3).join(", ")}.`);
  }

  return highlights;
}

async function summarizeProject(input: {
  repo: string;
  description: string | null;
  readmeText: string;
  techStack: string[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = buildHeuristicSummary(input);

  if (!apiKey) {
    return {
      text: fallback,
      aiEnhanced: false
    };
  }

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = [
      "Summarize this GitHub project in 2 concise sentences for a product dashboard.",
      `Repository: ${input.repo}`,
      `Description: ${input.description ?? "No description"}`,
      `Inferred stack: ${input.techStack.join(", ") || "Unknown"}`,
      `README excerpt:\n${input.readmeText.slice(0, 6000)}`
    ].join("\n\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return {
      text: text || fallback,
      aiEnhanced: true
    };
  } catch {
    return {
      text: fallback,
      aiEnhanced: false
    };
  }
}

function buildHeuristicSummary(input: {
  repo: string;
  description: string | null;
  readmeText: string;
  techStack: string[];
}) {
  const firstHeadingMatch = input.readmeText.match(/^#\s+(.+)$/m);
  const heading = firstHeadingMatch?.[1];
  const description = input.description ?? "This repository does not provide a GitHub description.";
  const stack = input.techStack.length ? `Likely built with ${input.techStack.join(", ")}.` : "Its stack is not obvious from the repo surface.";

  return `${heading ? `${heading} appears to be the focus of ${input.repo}. ` : ""}${description} ${stack}`.trim();
}
