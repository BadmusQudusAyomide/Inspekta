import { analyzeGithubRepo } from "./github.js";
import { analyzeWebsite } from "./website.js";

export async function analyzeInput(input: string) {
  const normalizedUrl = normalizeUrl(input);
  const parsedUrl = new URL(normalizedUrl);
  const inspectedAt = new Date().toISOString();

  if (parsedUrl.hostname.toLowerCase() === "github.com") {
    const githubResult = await analyzeGithubRepo(parsedUrl);
    return {
      ...githubResult,
      kind: "github" as const,
      normalizedUrl,
      inspectedAt
    };
  }

  const websiteResult = await analyzeWebsite(parsedUrl);
  return {
    ...websiteResult,
    kind: "website" as const,
    normalizedUrl,
    inspectedAt
  };
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL cannot be empty.");
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(`https://${trimmed}`).toString();
  }
}
