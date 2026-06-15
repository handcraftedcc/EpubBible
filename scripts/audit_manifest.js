import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { parseBibleXml } from "../src/xmlParser.js";

function sniffRootTag(xmlText) {
  const match = xmlText.match(/<([a-zA-Z0-9:_-]+)\b/);
  return match?.[1] ?? "unknown";
}

function sniffMetadataSource(xmlText) {
  if (/<(?:xmlbible|bible)\b[^>]*\btranslation="/i.test(xmlText)) {
    return "translation";
  }
  if (/<bible\b[^>]*\bname="/i.test(xmlText)) {
    return "name";
  }
  if (/<bible\b[^>]*\blanguage="/i.test(xmlText)) {
    return "language";
  }
  return "none";
}

function countVerses(parsedBible) {
  return parsedBible.books.reduce(
    (total, book) =>
      total +
      book.chapters.reduce((chapterTotal, chapter) => chapterTotal + chapter.verses.length, 0),
    0,
  );
}

export function auditBibleXml(entry, xmlText) {
  const rootTag = sniffRootTag(xmlText);
  const sniffedMetadataSource = sniffMetadataSource(xmlText);
  const parsed = parseBibleXml(xmlText, entry);
  const chapterCount = parsed.books.reduce((total, book) => total + book.chapters.length, 0);
  const issues = [];
  const metadataSource = sniffedMetadataSource === "none" && parsed.translation !== "Unknown" ? "entry" : sniffedMetadataSource;

  if (parsed.translation === "Unknown") {
    issues.push("Missing usable translation metadata.");
  }
  if (parsed.books.length === 0) {
    issues.push("No canonical books were parsed.");
  }
  if (chapterCount === 0) {
    issues.push("No chapters were parsed.");
  }

  let status = "ok";
  if (issues.length > 0) {
    status = "fail";
  } else if (metadataSource !== "translation") {
    status = "warn";
  }

  return {
    ...entry,
    status,
    rootTag,
    metadataSource,
    translation: parsed.translation,
    bookCount: parsed.books.length,
    chapterCount,
    verseCount: countVerses(parsed),
    issues,
  };
}

export function formatAuditSummary(results) {
  return results.reduce(
    (summary, result) => {
      summary.total += 1;
      summary[result.status] += 1;
      return summary;
    },
    { total: 0, ok: 0, warn: 0, fail: 0 },
  );
}

async function fetchXml(url, timeoutMs = 15000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`);
  }
  return response.text();
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function runWorker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function toMarkdown(summary, results) {
  const problemResults = results.filter((result) => result.status !== "ok");
  const lines = [
    "# Manifest Audit Report",
    "",
    `- Total: ${summary.total}`,
    `- OK: ${summary.ok}`,
    `- Warn: ${summary.warn}`,
    `- Fail: ${summary.fail}`,
    "",
  ];

  if (problemResults.length === 0) {
    lines.push("No warnings or failures detected.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Non-OK Entries", "");
  for (const result of problemResults) {
    lines.push(`### ${result.name}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Path: ${result.path}`);
    lines.push(`- URL: ${result.rawUrl}`);
    lines.push(`- Root Tag: ${result.rootTag}`);
    lines.push(`- Metadata Source: ${result.metadataSource}`);
    lines.push(`- Translation: ${result.translation}`);
    lines.push(`- Books: ${result.bookCount}`);
    lines.push(`- Chapters: ${result.chapterCount}`);
    lines.push(`- Verses: ${result.verseCount}`);
    if (result.issues.length > 0) {
      lines.push(`- Issues: ${result.issues.join("; ")}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const manifestPath = process.argv[2] ?? "public/manifest.json";
  const outputDir = process.argv[3] ?? "results";
  const concurrency = Number.parseInt(process.argv[4] ?? "4", 10);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await mkdir(outputDir, { recursive: true });

  const results = await mapWithConcurrency(manifest, concurrency, async (entry, index) => {
    const position = index + 1;
    if (position === 1 || position % 25 === 0) {
      console.log(`Auditing ${position}/${manifest.length}: ${entry.path}`);
    }
    try {
      const xmlText = await fetchXml(entry.rawUrl);
      return auditBibleXml(entry, xmlText);
    } catch (error) {
      return {
        ...entry,
        status: "fail",
        rootTag: "unavailable",
        metadataSource: "unavailable",
        translation: "Unknown",
        bookCount: 0,
        chapterCount: 0,
        verseCount: 0,
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  });

  const summary = formatAuditSummary(results);

  const stamp = new Date().toISOString().replaceAll(":", "-");
  const jsonPath = join(outputDir, `manifest-audit-${stamp}.json`);
  const mdPath = join(outputDir, `manifest-audit-${stamp}.md`);
  const latestJsonPath = join(outputDir, "manifest-audit-latest.json");
  const latestMdPath = join(outputDir, "manifest-audit-latest.md");

  const payload = { manifest: basename(manifestPath), generatedAt: new Date().toISOString(), summary, results };
  const markdown = toMarkdown(summary, results);

  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(mdPath, markdown, "utf8");
  await writeFile(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(latestMdPath, markdown, "utf8");

  console.log(`Audited ${summary.total} entries`);
  console.log(`OK: ${summary.ok}  WARN: ${summary.warn}  FAIL: ${summary.fail}`);
  console.log(jsonPath);
  console.log(mdPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
