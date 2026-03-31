import axios from "axios";
import * as cheerio from "cheerio";
import https from "node:https";
import puppeteer from "puppeteer";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeWebsite(parsedUrl: URL) {
  const pageResponse = await fetchWebsiteMarkup(parsedUrl.toString());
  const html = pageResponse.data;
  const sizeBytes = new TextEncoder().encode(html).length;
  const $ = cheerio.load(html);

  const technologies = inferTechnologies($, html);
  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() ?? null;
  const ogValues = {
    title: $('meta[property="og:title"]').attr("content")?.trim() ?? null,
    description: $('meta[property="og:description"]').attr("content")?.trim() ?? null,
    image: $('meta[property="og:image"]').attr("content")?.trim() ?? null
  };
  const headingSamples = {
    h1: $("h1")
      .slice(0, 3)
      .toArray()
      .map((element) => $(element).text().trim())
      .filter(Boolean),
    h2: $("h2")
      .slice(0, 3)
      .toArray()
      .map((element) => $(element).text().trim())
      .filter(Boolean),
    h3: $("h3")
      .slice(0, 3)
      .toArray()
      .map((element) => $(element).text().trim())
      .filter(Boolean)
  };
  const seo = {
    titlePresent: title.length > 0,
    titleLength: title.length,
    metaDescriptionPresent: metaDescription.length > 0,
    descriptionLength: metaDescription.length,
    canonicalPresent: canonicalUrl?.length ? true : false,
    canonicalUrl,
    headings: {
      h1: $("h1").length,
      h2: $("h2").length,
      h3: $("h3").length,
      samples: headingSamples
    },
    og: {
      title: Boolean(ogValues.title),
      description: Boolean(ogValues.description),
      image: Boolean(ogValues.image),
      values: ogValues
    }
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--ignore-certificate-errors"]
  });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": "Inspekta" });
    await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
    const start = Date.now();
    const navigation = await page.goto(parsedUrl.toString(), { waitUntil: "networkidle2", timeout: 45000 });
    const screenshot = await page.screenshot({ type: "png", encoding: "base64", fullPage: false });
    const loadTimeMs = Date.now() - start;
    const pageSizeKb = Number((sizeBytes / 1024).toFixed(1));

    const performanceHints = buildPerformanceHints({
      loadTimeMs,
      pageSizeKb,
      technologies,
      headingCount: seo.headings.h1 + seo.headings.h2 + seo.headings.h3,
      hasMetaDescription: seo.metaDescriptionPresent
    });
    const scores = buildWebsiteScores({
      loadTimeMs,
      pageSizeKb,
      seo
    });
    const summary = await summarizeWebsite({
      hostname: parsedUrl.hostname,
      title,
      metaDescription,
      technologies,
      performanceHints,
      scores
    });

    return {
      page: {
        title: title || parsedUrl.hostname,
        description: metaDescription,
        screenshot,
        favicon: resolveAssetUrl(parsedUrl, $('link[rel="icon"]').attr("href") ?? null),
        finalUrl: page.url(),
        loadTimeMs,
        pageSizeKb,
        statusCode: navigation?.status() ?? pageResponse.status
      },
      summary: summary.text,
      aiEnhanced: summary.aiEnhanced,
      seo,
      technologies,
      performanceHints,
      scores,
      topPriority: buildTopPriority(buildWebsiteIssues({
        loadTimeMs,
        seo,
        technologies
      }), buildWebsiteQuickWins({
        loadTimeMs,
        seo,
        pageSizeKb
      })),
      confidence: buildConfidence([
        title.length > 0,
        metaDescription.length > 0,
        seo.canonicalPresent,
        seo.headings.h1 >= 0,
        seo.headings.h2 >= 0,
        seo.og.title,
        seo.og.description,
        seo.og.image,
        technologies.length > 0,
        pageSizeKb >= 0,
        loadTimeMs >= 0
      ]),
      highlights: buildWebsiteHighlights({
        technologies,
        scores,
        seo
      }),
      keyIssues: buildWebsiteIssues({
        loadTimeMs,
        seo,
        technologies
      }),
      quickWins: buildWebsiteQuickWins({
        loadTimeMs,
        seo,
        pageSizeKb
      })
    };
  } finally {
    await browser.close();
  }
}

async function fetchWebsiteMarkup(url: string) {
  try {
    return await axios.get<string>(url, {
      responseType: "text",
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Inspekta"
      }
    });
  } catch (error) {
    return axios.get<string>(url, {
      responseType: "text",
      timeout: 30000,
      maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        "User-Agent": "Inspekta"
      }
    });
  }
}

function inferTechnologies($: cheerio.CheerioAPI, html: string) {
  const fingerprints: Array<[string, boolean]> = [
    ["WordPress", /wp-content|wordpress/i.test(html)],
    ["Shopify", /cdn\.shopify|shopify/i.test(html)],
    ["Wix", /wixstatic|wix.com/i.test(html)],
    ["Webflow", /webflow/i.test(html)],
    ["Next.js", /_next\/static|__NEXT_DATA__/i.test(html)],
    ["React", /react|__next/i.test(html)],
    ["Vue", /vue/i.test(html)],
    ["Angular", /ng-version|angular/i.test(html)],
    ["Tailwind CSS", /tailwind/i.test(html)],
    ["Bootstrap", /bootstrap/i.test(html)],
    ["Google Analytics", /gtag|google-analytics|analytics.js/i.test(html)],
    ["Google Tag Manager", /googletagmanager/i.test(html)],
    ["Hotjar", /hotjar/i.test(html)],
    ["Cloudflare", /cloudflare/i.test(html)],
    ["Segment", /segment.com\/analytics/i.test(html)]
  ];

  const generator = $('meta[name="generator"]').attr("content");
  const result = fingerprints.filter(([, matched]) => matched).map(([name]) => name);
  if (generator) {
    result.push(`Generator: ${generator}`);
  }

  return Array.from(new Set(result));
}

function buildPerformanceHints(input: {
  loadTimeMs: number;
  pageSizeKb: number;
  technologies: string[];
  headingCount: number;
  hasMetaDescription: boolean;
}) {
  const hints: string[] = [];

  if (input.loadTimeMs > 4000) {
    hints.push("Load time is slow. Review render-blocking scripts and heavy media.");
  } else if (input.loadTimeMs > 3000) {
    hints.push("Load time is slow and should be pushed closer to 3 seconds.");
  } else if (input.loadTimeMs > 2000) {
    hints.push("Load time is good, but there is room to push it below 2 seconds.");
  } else {
    hints.push("Load time is fast enough for a healthy first impression.");
  }

  if (input.pageSizeKb > 1500) {
    hints.push("HTML payload is large. Consider compression, code splitting, or trimming page content.");
  } else if (input.pageSizeKb > 500) {
    hints.push("Page size is moderate. Image optimization and lazy-loading could still help.");
  } else {
    hints.push("Page size looks lightweight from the fetched HTML.");
  }

  if (!input.hasMetaDescription) {
    hints.push("Meta description is missing, which can weaken search result previews.");
  }

  if (input.headingCount < 2) {
    hints.push("Heading structure is sparse. Add clearer section hierarchy for SEO and accessibility.");
  }

  if (!input.technologies.some((item) => item.includes("Analytics"))) {
    hints.push("No major analytics fingerprint was detected in the source.");
  }

  return hints;
}

function buildWebsiteScores(input: {
  loadTimeMs: number;
  pageSizeKb: number;
  seo: {
    titlePresent: boolean;
    titleLength: number;
    metaDescriptionPresent: boolean;
    descriptionLength: number;
    canonicalPresent: boolean;
    headings: { h1: number; h2: number; h3: number; samples: { h1: string[]; h2: string[]; h3: string[] } };
    og: { title: boolean; description: boolean; image: boolean; values: { title: string | null; description: string | null; image: string | null } };
  };
}) {
  let seoScore = 0;
  if (input.seo.titlePresent) seoScore += 18;
  if (input.seo.titleLength >= 20 && input.seo.titleLength <= 70) seoScore += 12;
  else if (input.seo.titlePresent) seoScore += 4;
  if (input.seo.metaDescriptionPresent) seoScore += 16;
  if (input.seo.descriptionLength >= 70 && input.seo.descriptionLength <= 170) seoScore += 12;
  else if (input.seo.metaDescriptionPresent) seoScore += 4;
  if (input.seo.canonicalPresent) seoScore += 12;
  if (input.seo.headings.h1 === 1) seoScore += 16;
  else if (input.seo.headings.h1 > 1) seoScore -= 8;
  if (input.seo.headings.h2 >= 2) seoScore += 14;
  else if (input.seo.headings.h2 === 1) seoScore += 8;
  else seoScore -= 6;
  if (!input.seo.titlePresent) seoScore -= 12;
  if (!input.seo.metaDescriptionPresent) seoScore -= 12;
  if (!input.seo.canonicalPresent) seoScore -= 8;
  seoScore = clampScore(seoScore);

  let socialScore = 0;
  if (input.seo.og.title) socialScore += 30;
  if (input.seo.og.description) socialScore += 30;
  if (input.seo.og.image) socialScore += 30;
  if (!input.seo.og.title) socialScore -= 10;
  if (!input.seo.og.description) socialScore -= 10;
  if (!input.seo.og.image) socialScore -= 20;
  socialScore = clampScore(socialScore);

  let performanceScore = 100;
  if (input.loadTimeMs > 1500) performanceScore -= 10;
  if (input.loadTimeMs > 2500) performanceScore -= 15;
  if (input.loadTimeMs > 4000) performanceScore -= 25;
  if (input.loadTimeMs > 7000) performanceScore -= 20;
  if (input.pageSizeKb > 300) performanceScore -= 8;
  if (input.pageSizeKb > 800) performanceScore -= 15;
  if (input.pageSizeKb > 1500) performanceScore -= 20;
  performanceScore = clampScore(performanceScore);

  const overall = Math.round(seoScore * 0.4 + socialScore * 0.2 + performanceScore * 0.4);

  return {
    seo: seoScore,
    social: socialScore,
    performance: performanceScore,
    overall
  };
}

function buildWebsiteHighlights(input: {
  technologies: string[];
  scores: { seo: number; social: number; performance: number; overall: number };
  seo: {
    titlePresent: boolean;
    metaDescriptionPresent: boolean;
    canonicalPresent: boolean;
    headings: { h1: number; h2: number; h3: number; samples: { h1: string[]; h2: string[]; h3: string[] } };
    og: { title: boolean; description: boolean; image: boolean; values: { title: string | null; description: string | null; image: string | null } };
  };
}) {
  const highlights: string[] = [];

  if (input.technologies.length) {
    highlights.push(`The page exposes a recognizable stack: ${input.technologies.slice(0, 4).join(", ")}.`);
  } else {
    highlights.push("No clear frontend framework was detected from the markup. This may be due to server-side rendering, minimal client-side scripts, or limited fingerprint signals.");
  }

  if (input.scores.overall >= 80) {
    highlights.push(`This is a strong surface-level website pass at ${input.scores.overall}/100.`);
  } else if (input.scores.overall >= 55) {
    highlights.push(`This site is serviceable, but the audit still found noticeable quality gaps at ${input.scores.overall}/100.`);
  } else {
    highlights.push(`This site underperforms on the basics, landing only ${input.scores.overall}/100.`);
  }

  if (!input.seo.metaDescriptionPresent || !input.seo.canonicalPresent) {
    highlights.push("Core metadata is weak. Missing description or canonical tags make search presentation feel under-managed.");
  }

  if (input.seo.headings.h1 !== 1) {
    highlights.push("Heading hierarchy is messy because the page does not present a clean single-H1 structure.");
  }

  if (!input.seo.og.image) {
    highlights.push("Social sharing is undercooked because the Open Graph image is missing.");
  }

  return highlights;
}

function buildWebsiteIssues(input: {
  loadTimeMs: number;
  seo: {
    titlePresent: boolean;
    metaDescriptionPresent: boolean;
    canonicalPresent: boolean;
    headings: { h1: number; h2: number; h3: number; samples: { h1: string[]; h2: string[]; h3: string[] } };
    og: { title: boolean; description: boolean; image: boolean; values: { title: string | null; description: string | null; image: string | null } };
  };
  technologies: string[];
}) {
  const issues: string[] = [];

  if (input.loadTimeMs > 3000) {
    issues.push(`Load time is slow at roughly ${(input.loadTimeMs / 1000).toFixed(1)}s.`);
  }

  if (input.seo.headings.h1 !== 1) {
    issues.push(`Heading structure is inconsistent because ${input.seo.headings.h1} H1 tags were detected.`);
  }

  if (!input.seo.metaDescriptionPresent) {
    issues.push("Meta description is missing, which weakens search result previews.");
  }

  if (!input.seo.og.image) {
    issues.push("Open Graph image is missing, so shared links may look incomplete.");
  }

  if (!input.technologies.some((item) => item.includes("Analytics"))) {
    issues.push("No analytics fingerprint was detected, which may be intentional but leaves less product insight.");
  }

  return issues.slice(0, 5);
}

function buildWebsiteQuickWins(input: {
  loadTimeMs: number;
  pageSizeKb: number;
  seo: {
    metaDescriptionPresent: boolean;
    canonicalPresent: boolean;
    headings: { h1: number; h2: number; h3: number; samples: { h1: string[]; h2: string[]; h3: string[] } };
    og: { title: boolean; description: boolean; image: boolean; values: { title: string | null; description: string | null; image: string | null } };
  };
}) {
  const quickWins: string[] = [];

  if (input.loadTimeMs > 3000) {
    quickWins.push("Reduce render-blocking assets and heavy media to push load time below 3 seconds.");
  }

  if (input.pageSizeKb > 800) {
    quickWins.push("Trim page weight with compression, image optimization, and lazy loading.");
  }

  if (input.seo.headings.h1 !== 1) {
    quickWins.push("Fix heading hierarchy so the page uses exactly one H1.");
  }

  if (!input.seo.metaDescriptionPresent || !input.seo.canonicalPresent) {
    quickWins.push("Tighten search metadata with a proper description and canonical tag.");
  }

  if (!input.seo.og.image) {
    quickWins.push("Add an Open Graph image to improve social previews.");
  }

  return quickWins.slice(0, 5);
}

async function summarizeWebsite(input: {
  hostname: string;
  title: string;
  metaDescription: string;
  technologies: string[];
  performanceHints: string[];
  scores: { seo: number; social: number; performance: number; overall: number };
}) {
  const fallback = buildHeuristicWebsiteSummary(input);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      text: fallback,
      aiEnhanced: false
    };
  }

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = [
      "Summarize this website inspection in 2 concise sentences for a product dashboard.",
      `Host: ${input.hostname}`,
      `Title: ${input.title || "None"}`,
      `Meta description: ${input.metaDescription || "None"}`,
      `Detected technologies: ${input.technologies.join(", ") || "Unknown"}`,
      `Scores: SEO ${input.scores.seo}, Social ${input.scores.social}, Performance ${input.scores.performance}, Overall ${input.scores.overall}`,
      `Hints: ${input.performanceHints.join(" ")}`
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

function buildHeuristicWebsiteSummary(input: {
  hostname: string;
  title: string;
  technologies: string[];
  performanceHints: string[];
  scores: { seo: number; social: number; performance: number; overall: number };
}) {
  const stackLine = input.technologies.length
    ? `Stack hints point to ${input.technologies.slice(0, 3).join(", ")}.`
    : "The front-end stack is not strongly exposed in the markup.";
  const healthLine = `Overall website health lands at ${input.scores.overall}/100, with the strongest signal coming from ${
    input.scores.performance >= input.scores.seo && input.scores.performance >= input.scores.social
      ? "performance"
      : input.scores.seo >= input.scores.social
        ? "SEO"
        : "social sharing"
  }.`;

  const verdictLine =
    input.scores.overall >= 80
      ? "It looks well maintained from the outside."
      : input.scores.overall >= 55
        ? "It works, but the polish is uneven."
        : "It feels under-optimized and under-curated.";

  return `${input.title || input.hostname} was inspected. ${stackLine} ${healthLine} ${verdictLine}`.trim();
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
  const level = signalCount >= 9 ? "High" : signalCount >= 6 ? "Medium" : "Low";

  return {
    level,
    signalCount
  };
}

function resolveAssetUrl(baseUrl: URL, assetUrl: string | null) {
  if (!assetUrl) {
    return null;
  }

  try {
    return new URL(assetUrl, baseUrl).toString();
  } catch {
    return assetUrl;
  }
}
