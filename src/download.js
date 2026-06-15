import { buildBookEpub, buildBookEpubEntries, slugify } from "./epubBuilder.js";
import { createZipArchive } from "./zip.js";

function titleizeWord(word, sourceHadSpaces) {
  if (!word) {
    return word;
  }
  if (/^\d+$/.test(word)) {
    return word;
  }
  if (!sourceHadSpaces && /^[a-z]{2,4}$/.test(word)) {
    return word.toUpperCase();
  }
  if (/^[A-Z0-9]{2,}$/.test(word)) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function formatZipFileName(translation) {
  const raw = String(translation ?? "Unknown").trim();
  const sourceHadSpaces = /\s/.test(raw);
  const normalized = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Unknown";
  const title = normalized
    .split(" ")
    .map((word) => titleizeWord(word, sourceHadSpaces))
    .join(" ");
  return `${title} Epubs.zip`;
}

function getJsZip() {
  if (typeof globalThis !== "undefined" && globalThis.JSZip) {
    return globalThis.JSZip;
  }
  return null;
}

async function buildBookEpubWithJsZip(book, translation, JSZip) {
  const zip = new JSZip();
  const entries = buildBookEpubEntries(book, translation);
  for (const entry of entries) {
    if (entry.name === "mimetype") {
      zip.file(entry.name, entry.data, { compression: "STORE" });
    } else {
      zip.file(entry.name, entry.data);
    }
  }

  return {
    fileName: buildBookEpub(book, translation).fileName,
    zipPath: buildBookEpub(book, translation).zipPath,
    bytes: await zip.generateAsync({
      type: "uint8array",
      mimeType: "application/epub+zip",
      compression: "DEFLATE",
    }),
  };
}

export async function buildTranslationZip(parsedBible) {
  const JSZip = getJsZip();
  const bookArtifacts = JSZip
    ? await Promise.all(parsedBible.books.map((book) => buildBookEpubWithJsZip(book, parsedBible.translation, JSZip)))
    : parsedBible.books.map((book) => buildBookEpub(book, parsedBible.translation));

  if (JSZip) {
    const zip = new JSZip();
    for (const artifact of bookArtifacts) {
      zip.file(artifact.zipPath, artifact.bytes);
    }
    return {
      fileName: formatZipFileName(parsedBible.translation),
      bytes: await zip.generateAsync({
        type: "uint8array",
        mimeType: "application/zip",
        compression: "DEFLATE",
      }),
    };
  }

  return {
    fileName: formatZipFileName(parsedBible.translation),
    bytes: createZipArchive(
      bookArtifacts.map((artifact) => ({
        name: artifact.zipPath,
        data: artifact.bytes,
      })),
    ),
  };
}

export function triggerDownload(fileName, bytes) {
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function buildZipDownload(parsedBible) {
  return buildTranslationZip(parsedBible);
}
