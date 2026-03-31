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
  const [readmeText, contributors, commits, contents, languages, manifestCorpus] = await Promise.all([
    fetchReadme(owner, repo),
    fetchContributors(owner, repo),
    githubFetch<CommitResponse[]>(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
    githubFetch<Array<{ name: string }>>(`https://api.github.com/repos/${owner}/${repo}/contents`),
    githubFetch<Record<string, number>>(`https://api.github.com/repos/${owner}/${repo}/languages`),
    fetchManifestCorpus(owner, repo)
  ]);

  const techStack = inferRepoStack(readmeText, contents.map((item) => item.name), manifestCorpus);
  const rootFiles = contents.map((item) => item.name);
  const readmeScore = scoreReadme(readmeText);
  const activity = getRepoActivity({
    pushedAt: repoData.pushed_at,
    createdAt: repoData.created_at,
    openIssues: repoData.open_issues_count,
    contributors
  });
  const repoSignals = getRepoSignals({
    rootFiles,
    manifestCorpus,
    techStack,
    contributors,
    stars: repoData.stargazers_count,
    openIssues: repoData.open_issues_count,
    readmeScore,
    activity,
    hasLicense: Boolean(repoData.license?.name)
  });
  const summary = await summarizeProject({
    repo: `${owner}/${repo}`,
    description: repoData.description,
    readmeText,
    techStack
  });
  const vitality = getRepoVitality(repoSignals, activity);
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

  const hasCI = /github\/workflows|actions\/checkout/i.test(manifestCorpus);
  const hasTests = /(jest|vitest|mocha|pytest|rspec|cypress|playwright|testing-library|tests?\/|__tests__)/i.test(
    `${rootFiles.join("\n")}\n${manifestCorpus}`
  );
  const keyIssues = buildRepoIssues({
    activity,
    repoSignals,
    hasLicense: Boolean(repoData.license?.name),
    readmeVerdict: readmeScore.verdict,
    hasTests,
    hasCI
  });
  const quickWins = buildRepoQuickWins({
    activity,
    repoSignals,
    hasLicense: Boolean(repoData.license?.name),
    readmeVerdict: readmeScore.verdict,
    hasTests,
    hasCI
  });

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
    scoreBreakdown: repoSignals,
    topPriority: buildTopPriority(keyIssues, quickWins),
    confidence: buildConfidence([
      Boolean(repoData.description),
      Boolean(readmeText),
      contributors > 0,
      repoData.open_issues_count >= 0,
      repoData.stargazers_count >= 0,
      Boolean(repoData.license?.name),
      languageBreakdown.length > 0,
      techStack.length > 0,
      hasTests,
      hasCI
    ]),
    highlights: buildRepoHighlights({
      archived: repoData.archived,
      vitalityStatus: vitality.status,
      readmeVerdict: readmeScore.verdict,
      contributors,
      openIssues: repoData.open_issues_count,
      languageBreakdown
    }),
    keyIssues,
    quickWins,
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

async function fetchManifestCorpus(owner: string, repo: string) {
  const manifestPaths = [
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "composer.json",
    "Gemfile",
    "Dockerfile",
    ".github/workflows/ci.yml",
    ".github/workflows/main.yml"
  ];
  const manifestContents = await Promise.all(
    manifestPaths.map((path) => fetchOptionalRepoFile(owner, repo, path))
  );

  return manifestContents.filter(Boolean).join("\n");
}

async function fetchOptionalRepoFile(owner: string, repo: string, path: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
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

function inferRepoStack(readmeText: string, rootFiles: string[], manifestCorpus: string) {
  const corpus = `${readmeText}\n${rootFiles.join("\n")}\n${manifestCorpus}`.toLowerCase();
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
    ["GraphQL", ["graphql"]],
    ["Ruby", ["gemfile", "ruby"]],
    ["Rails", ["rails"]],
    ["PHP", ["composer.json", "php"]],
    ["Laravel", ["laravel"]],
    ["CI", ["github/workflows", "actions/checkout", "build", "test"]]
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

function getRepoVitality(
  scores: { activity: number; documentation: number; community: number; structure: number; overall: number },
  activity: { daysSincePush: number; issuePressure: string; singleMaintainerRisk: boolean }
) {
  const score = scores.overall;

  const status =
    score >= 80 ? "Healthy" : score >= 60 ? "Watch closely" : score >= 35 ? "Fragile" : "Barely maintained";
  const reasons: string[] = [];

  if (activity.daysSincePush <= 14) {
    reasons.push("recent commits are a strong positive signal");
  } else if (activity.daysSincePush > 90) {
    reasons.push("commit activity has slowed down");
  } else {
    reasons.push("activity is present but not especially fresh");
  }

  if (activity.issuePressure === "High") {
    reasons.push("the open issue backlog is heavy");
  } else if (activity.issuePressure === "Moderate") {
    reasons.push("issue volume is starting to build up");
  }

  if (activity.singleMaintainerRisk) {
    reasons.push("maintenance appears concentrated in one person");
  }

  if (scores.documentation < 45) {
    reasons.push("documentation quality is weak");
  }

  if (scores.structure < 45) {
    reasons.push("engineering signals like tests or CI are thin");
  }

  const reason = reasons.length
    ? `${status} because ${reasons.join(", ")}.`
    : `${status} with balanced activity, issue load, and contributor coverage.`;

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
  const issuesPerContributor = input.openIssues / Math.max(1, input.contributors);
  const issuePressure =
    issuesPerContributor > 80 ? "High" : issuesPerContributor > 20 ? "Moderate" : "Low";
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

function getRepoSignals(input: {
  rootFiles: string[];
  manifestCorpus: string;
  techStack: string[];
  contributors: number;
  stars: number;
  openIssues: number;
  readmeScore: { score: number; maxScore: number };
  activity: { daysSincePush: number };
  hasLicense: boolean;
}) {
  const hasTests = /(jest|vitest|mocha|pytest|rspec|cypress|playwright|testing-library|tests?\/|__tests__)/i.test(
    `${input.rootFiles.join("\n")}\n${input.manifestCorpus}`
  );
  const hasCI = /(github\/workflows|actions\/checkout|ci:|build:|test:)/i.test(input.manifestCorpus);

  let activityScore = 100;
  if (input.activity.daysSincePush > 14) activityScore -= 10;
  if (input.activity.daysSincePush > 45) activityScore -= 20;
  if (input.activity.daysSincePush > 90) activityScore -= 20;
  if (input.activity.daysSincePush > 180) activityScore -= 20;
  if (input.openIssues > 50) activityScore -= 10;
  if (input.openIssues > 150) activityScore -= 15;

  let documentationScore = Math.round((input.readmeScore.score / input.readmeScore.maxScore) * 100);
  if (input.hasLicense) documentationScore += 10;
  documentationScore = clampScore(documentationScore);

  let communityScore = 20;
  if (input.contributors > 1) communityScore += 20;
  if (input.contributors > 3) communityScore += 15;
  if (input.stars > 0) communityScore += 15;
  if (input.stars > 25) communityScore += 10;
  if (input.stars > 250) communityScore += 10;
  if (input.openIssues > 100) communityScore -= 10;
  if (input.openIssues > 250) communityScore -= 10;
  communityScore = clampScore(communityScore);

  let structureScore = 20;
  if (input.techStack.length >= 2) structureScore += 15;
  if (hasTests) structureScore += 30;
  if (hasCI) structureScore += 25;
  if (input.hasLicense) structureScore += 10;
  structureScore = clampScore(structureScore);

  const overall = Math.round(
    activityScore * 0.4 +
      documentationScore * 0.2 +
      communityScore * 0.2 +
      structureScore * 0.2
  );

  return {
    activity: clampScore(activityScore),
    documentation: clampScore(documentationScore),
    community: clampScore(communityScore),
    structure: clampScore(structureScore),
    overall
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
    highlights.push(`Maintenance outlook is ${input.vitalityStatus.toLowerCase()}.`);
  }

  highlights.push(`README quality is ${input.readmeVerdict.toLowerCase()}, so onboarding is ${input.readmeVerdict === "Weak" ? "rough" : input.readmeVerdict === "Fair" ? "adequate but not strong" : "in decent shape"}.`);
  highlights.push(
    input.contributors <= 1
      ? "Contributor footprint is thin enough to create real bus-factor risk."
      : `Contributor footprint spans ${input.contributors} public contributors, which lowers single-maintainer risk.`
  );

  if (input.openIssues > 200) {
    highlights.push("Open issue volume is high enough to suggest backlog drag rather than healthy throughput.");
  } else if (input.openIssues > 50) {
    highlights.push("The issue queue is noticeable, so responsiveness may already be slipping.");
  }

  if (input.languageBreakdown.length) {
    highlights.push(`The codebase is led by ${input.languageBreakdown.slice(0, 3).join(", ")}.`);
  }

  return highlights;
}

function buildRepoIssues(input: {
  activity: { daysSincePush: number; issuePressure: string; singleMaintainerRisk: boolean };
  repoSignals: { documentation: number; structure: number; community: number };
  hasLicense: boolean;
  readmeVerdict: string;
  hasTests: boolean;
  hasCI: boolean;
}) {
  const issues: string[] = [];

  if (input.activity.daysSincePush > 90) {
    issues.push("Recent activity is weak, so maintenance confidence is low.");
  }

  if (input.readmeVerdict === "Weak" || input.repoSignals.documentation < 45) {
    issues.push("Documentation is thin, which makes onboarding and reuse harder.");
  }

  if (input.activity.singleMaintainerRisk) {
    issues.push("Maintainer depth is shallow, creating real bus-factor risk.");
  }

  if (!input.hasTests) {
    issues.push("No clear test tooling was detected, so quality checks may be fragile.");
  }

  if (!input.hasCI) {
    issues.push("No obvious CI pipeline was detected, so release discipline may be manual.");
  }

  if (!input.hasLicense) {
    issues.push("No license is visible, which makes reuse riskier.");
  }

  return issues.slice(0, 5);
}

function buildRepoQuickWins(input: {
  activity: { daysSincePush: number; issuePressure: string; singleMaintainerRisk: boolean };
  repoSignals: { documentation: number; structure: number; community: number };
  hasLicense: boolean;
  readmeVerdict: string;
  hasTests: boolean;
  hasCI: boolean;
}) {
  const quickWins: string[] = [];

  if (input.readmeVerdict === "Weak" || input.repoSignals.documentation < 45) {
    quickWins.push("Expand the README with setup, usage, and contribution guidance.");
  }

  if (!input.hasTests) {
    quickWins.push("Add a visible test setup so contributors can trust changes faster.");
  }

  if (!input.hasCI) {
    quickWins.push("Add a CI workflow to validate builds and tests on every push.");
  }

  if (!input.hasLicense) {
    quickWins.push("Add an explicit license file if the project is meant to be reused.");
  }

  if (input.activity.singleMaintainerRisk) {
    quickWins.push("Reduce maintainer concentration by documenting ownership and review flow.");
  }

  return quickWins.slice(0, 5);
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
  const heading = cleanPhrase(firstHeadingMatch?.[1] ?? "");
  const focusSentence = input.description?.trim()
    ? `GitHub describes this project as: ${ensureSentence(input.description.trim())}`
    : isUsefulHeading(heading)
      ? `This repository appears to focus on ${heading}.`
      : "No clear project description was provided.";
  const stackSentence = input.techStack.length
    ? `Primary technologies include ${input.techStack.join(", ")}.`
    : "The primary stack is not obvious from the repo surface.";

  return `${focusSentence} ${stackSentence}`.trim();
}

function cleanPhrase(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/[.]+$/, "")
    .trim();
}

function isUsefulHeading(value: string) {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) {
    return false;
  }

  if (cleaned.length < 4) {
    return false;
  }

  return !["or", "and", "app", "project", "repo", "repository", "home"].includes(cleaned);
}

function ensureSentence(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildTopPriority(issues: string[], quickWins: string[]) {
  if (issues[0]) {
    return issues[0];
  }

  if (quickWins[0]) {
    return quickWins[0];
  }

  return "No urgent issue stood out from the current signal set.";
}

function buildConfidence(signals: boolean[]) {
  const signalCount = signals.filter(Boolean).length;
  const level = signalCount >= 8 ? "High" : signalCount >= 5 ? "Medium" : "Low";

  return {
    level,
    signalCount
  };
}
