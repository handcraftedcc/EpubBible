import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { BOOK_NAMES, testamentSubdir } from "../src/bibleBooks.js";
import { extractTranslationName, parseBibleXml } from "../src/xmlParser.js";

const fixturePath = new URL("./fixtures/sample_bible.xml", import.meta.url);

test("BOOK_NAMES matches the canonical Bible book count", () => {
  assert.equal(BOOK_NAMES.length, 66);
  assert.equal(BOOK_NAMES[0], "Genesis");
  assert.equal(BOOK_NAMES[39], "Matthew");
  assert.equal(BOOK_NAMES[65], "Revelation");
});

test("testamentSubdir splits books at the traditional boundary", () => {
  assert.equal(testamentSubdir(1), "Old Testament");
  assert.equal(testamentSubdir(39), "Old Testament");
  assert.equal(testamentSubdir(40), "New Testament");
});

test("extractTranslationName strips English prefix and annotation suffix", () => {
  assert.equal(extractTranslationName("English King James Bible == Public Domain"), "King James Bible");
  assert.equal(extractTranslationName("Deutsch Lutherbibel"), "Deutsch Lutherbibel");
  assert.equal(extractTranslationName(""), "Unknown");
});

test("parseBibleXml normalizes translation, books, chapters, and verse text", async () => {
  const xmlText = await readFile(fixturePath, "utf8");
  const parsed = parseBibleXml(xmlText);

  assert.equal(parsed.translation, "King James Bible");
  assert.equal(parsed.books.length, 2);

  assert.deepEqual(
    parsed.books.map((book) => ({
      number: book.number,
      title: book.title,
      testament: book.testament,
      chapterCount: book.chapters.length,
    })),
    [
      { number: 1, title: "Genesis", testament: "Old Testament", chapterCount: 2 },
      { number: 40, title: "Matthew", testament: "New Testament", chapterCount: 1 },
    ],
  );

  assert.deepEqual(parsed.books[0].chapters[0].verses, [
    { number: "1", text: "In the beginning God created the heaven and the earth." },
    { number: "2", text: "And the earth was without form, and void." },
  ]);
});
