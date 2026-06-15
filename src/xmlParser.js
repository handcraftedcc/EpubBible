import { BOOK_NAMES, testamentSubdir } from "./bibleBooks.js";

function collectText(xmlFragment) {
  return xmlFragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function extractTranslationName(translation) {
  let name = (translation ?? "").trim();
  const markerIndex = name.indexOf(" ==");
  if (markerIndex !== -1) {
    name = name.slice(0, markerIndex).trim();
  }
  if (name.startsWith("English ")) {
    name = name.slice("English ".length);
  }
  return name || "Unknown";
}

export function parseBibleXml(xmlText) {
  const translationMatch = xmlText.match(/<(?:xmlbible|bible)\b[^>]*\btranslation="([^"]*)"/i);
  const translation = extractTranslationName(translationMatch?.[1] ?? "Unknown");
  const books = [];
  const bookPattern = /<book\b[^>]*\bnumber="([^"]+)"[^>]*>([\s\S]*?)<\/book>/gi;

  for (const bookMatch of xmlText.matchAll(bookPattern)) {
    const bookNumber = Number.parseInt(bookMatch[1], 10);
    if (!Number.isInteger(bookNumber) || bookNumber < 1 || bookNumber > BOOK_NAMES.length) {
      continue;
    }

    const chapters = [];
    const chapterPattern = /<chapter\b[^>]*\bnumber="([^"]+)"[^>]*>([\s\S]*?)<\/chapter>/gi;
    for (const chapterMatch of bookMatch[2].matchAll(chapterPattern)) {
      const chapterNumber = Number.parseInt(chapterMatch[1], 10);
      if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
        continue;
      }

      const verses = [];
      const versePattern = /<verse\b[^>]*\bnumber="([^"]*)"[^>]*>([\s\S]*?)<\/verse>/gi;
      for (const verseMatch of chapterMatch[2].matchAll(versePattern)) {
        const text = collectText(verseMatch[2]);
        if (!text) {
          continue;
        }

        verses.push({
          number: verseMatch[1].trim(),
          text,
        });
      }

      chapters.push({
        number: chapterNumber,
        verses,
      });
    }

    if (chapters.length === 0) {
      continue;
    }

    books.push({
      number: bookNumber,
      title: BOOK_NAMES[bookNumber - 1],
      testament: testamentSubdir(bookNumber),
      chapters,
    });
  }

  return {
    translation,
    books,
  };
}
