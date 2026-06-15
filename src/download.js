import { buildBookEpub, slugify } from "./epubBuilder.js";
import { createZipArchive } from "./zip.js";

export function buildTranslationZip(parsedBible) {
  const bookArtifacts = parsedBible.books.map((book) => buildBookEpub(book, parsedBible.translation));
  return {
    fileName: `${slugify(parsedBible.translation)}_epubs.zip`,
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
