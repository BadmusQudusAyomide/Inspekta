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
      highlights: buildWebsiteHighlights({
        technologies,
        scores,
        seo
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
    hints.push("Page load is on the slow side. Review render-blocking scripts and media weight.");
  } else if (input.loadTimeMs > 2000) {
    hints.push("Load time is decent, but there is room to tighten initial response and asset delivery.");
  } else {
    hints.push("Load time looks healthy for a quick first-pass inspection.");
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
  let seoScore = 30;
  if (input.seo.titlePresent) seoScore += 20;
  if (input.seo.titleLength >= 20 && input.seo.titleLength <= 70) seoScore += 10;
  if (input.seo.metaDescriptionPresent) seoScore += 20;
  if (input.seo.descriptionLength >= 70 && input.seo.descriptionLength <= 170) seoScore += 10;
  if (input.seo.canonicalPresent) seoScore += 10;
  if (input.seo.headings.h1 === 1) seoScore += 10;
  if (input.seo.headings.h2 >= 1) seoScore += 10;

  let socialScore = 30;
  if (input.seo.og.title) socialScore += 25;
  if (input.seo.og.description) socialScore += 25;
  if (input.seo.og.image) socialScore += 20;

  let performanceScore = 100;
  if (input.loadTimeMs > 2000) performanceScore -= 15;
  if (input.loadTimeMs > 4000) performanceScore -= 20;
  if (input.pageSizeKb > 500) performanceScore -= 10;
  if (input.pageSizeKb > 1500) performanceScore -= 15;
  performanceScore = Math.max(25, performanceScore);

  const overall = Math.round((seoScore + socialScore + performanceScore) / 3);

  return {
    seo: Math.min(100, seoScore),
    social: Math.min(100, socialScore),
    performance: Math.min(100, performanceScore),
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
    highlights.push(`Detected stack signals include ${input.technologies.slice(0, 4).join(", ")}.`);
  } else {
    highlights.push("No strong framework or analytics fingerprints were visible in the fetched markup.");
  }

  highlights.push(`SEO score is ${input.scores.seo}/100 and social-card score is ${input.scores.social}/100.`);

  if (!input.seo.metaDescriptionPresent || !input.seo.canonicalPresent) {
    highlights.push("Core metadata can be tightened with a stronger description and canonical setup.");
  }

  if (input.seo.headings.h1 !== 1) {
    highlights.push("Heading structure looks unusual because the page does not have exactly one H1.");
  }

  if (!input.seo.og.image) {
    highlights.push("Open Graph image is missing, so link previews may feel incomplete.");
  }

  return highlights;
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

  return `${input.title || input.hostname} was inspected. ${stackLine} ${healthLine}`.trim();
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
