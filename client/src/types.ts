export type AnalysisKind = "github" | "website";

export interface BaseResponse {
  kind: AnalysisKind;
  normalizedUrl: string;
  inspectedAt: string;
}

export interface GithubAnalysis extends BaseResponse {
  kind: "github";
  repo: {
    owner: string;
    name: string;
    fullName: string;
    description: string | null;
    homepage: string | null;
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    defaultBranch: string;
    lastPushAt: string;
    createdAt: string;
    archived: boolean;
    sizeKb: number;
    license: string | null;
    language: string | null;
    contributors: number;
  };
  summary: string;
  aiEnhanced: boolean;
  techStack: string[];
  languages: string[];
  readmeScore: {
    score: number;
    maxScore: number;
    verdict: string;
    notes: string[];
  };
  vitality: {
    status: string;
    score: number;
    reason: string;
  };
  activity: {
    daysSincePush: number;
    repoAgeDays: number;
    issuePressure: string;
    cadence: string;
    singleMaintainerRisk: boolean;
  };
  scoreBreakdown: {
    activity: number;
    documentation: number;
    community: number;
    structure: number;
    overall: number;
  };
  topPriority: string;
  confidence: {
    level: string;
    signalCount: number;
  };
  highlights: string[];
  keyIssues: string[];
  quickWins: string[];
  recentCommit: {
    sha: string;
    message: string;
    date: string;
    author: string;
  } | null;
}

export interface WebsiteAnalysis extends BaseResponse {
  kind: "website";
  page: {
    title: string;
    description: string;
    screenshot: string | null;
    favicon: string | null;
    finalUrl: string;
    loadTimeMs: number | null;
    pageSizeKb: number | null;
    statusCode: number | null;
  };
  summary: string;
  aiEnhanced: boolean;
  seo: {
    titlePresent: boolean;
    titleLength: number;
    metaDescriptionPresent: boolean;
    descriptionLength: number;
    canonicalPresent: boolean;
    canonicalUrl: string | null;
    headings: {
      h1: number;
      h2: number;
      h3: number;
      samples: {
        h1: string[];
        h2: string[];
        h3: string[];
      };
    };
    og: {
      title: boolean;
      description: boolean;
      image: boolean;
      values: {
        title: string | null;
        description: string | null;
        image: string | null;
      };
    };
  };
  technologies: string[];
  performanceHints: string[];
  scores: {
    seo: number;
    social: number;
    performance: number;
    overall: number;
  };
  topPriority: string;
  confidence: {
    level: string;
    signalCount: number;
  };
  highlights: string[];
  keyIssues: string[];
  quickWins: string[];
}

export type AnalyzeResponse = GithubAnalysis | WebsiteAnalysis;
