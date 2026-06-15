import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBookEpub,
  buildBookFileName,
  buildChapterXhtml,
  buildContentOpf,
  buildInlineVerses,
  buildTocNcx,
  buildTocXhtml,
  buildZipPath,
  containerXml,
  slugify,
} from "../src/epubBuilder.js";

const sampleBook = {
  number: 1,
  title: "Genesis",
  testament: "Old Testament",
  chapters: [
    {
      number: 1,
      verses: [
        { number: "1", text: "In the beginning God created the heaven and the earth." },
        { number: "2", text: "And the earth was without form, and void." },
      ],
    },
    {
      number: 2,
      verses: [{ number: "1", text: "Thus the heavens and the earth were finished." }],
    },
  ],
};

test("slugify mirrors the reference naming shape", () => {
  assert.equal(slugify("King James Bible"), "king_james_bible");
  assert.equal(slugify("  1 Samuel  "), "1_samuel");
});

test("buildInlineVerses renders one inline block with bracketed verse numbers", () => {
  const output = buildInlineVerses(sampleBook.chapters[0].verses);
  assert.equal(
    output,
    "[1] In the beginning God created the heaven and the earth. [2] And the earth was without form, and void.",
  );
});

test("buildChapterXhtml matches the reference chapter layout", () => {
  const xhtml = buildChapterXhtml(sampleBook.title, 1, sampleBook.chapters[0].verses);
  assert.match(xhtml, /<h1>Genesis<\/h1>/);
  assert.match(xhtml, /<h2>Chapter 1<\/h2>/);
  assert.match(
    xhtml,
    /<p>\[1\] In the beginning God created the heaven and the earth\. \[2\] And the earth was without form, and void\.<\/p>/,
  );
  assert.doesNotMatch(xhtml, /<\/p>\s*<p>/);
});

test("supporting EPUB files include nav and chapter entries", () => {
  const chapterNumbers = sampleBook.chapters.map((chapter) => chapter.number);
  const toc = buildTocXhtml("Genesis (King James Bible)", chapterNumbers);
  const ncx = buildTocNcx("king_james_bible:genesis", "Genesis (King James Bible)", chapterNumbers);
  const opf = buildContentOpf("king_james_bible:genesis", "Genesis (King James Bible)", "King James Bible", chapterNumbers);

  assert.match(toc, /chapter_001\.xhtml/);
  assert.match(ncx, /navPoint id="navpoint-1"/);
  assert.match(opf, /properties="nav"/);
  assert.match(containerXml(), /OEBPS\/content\.opf/);
});

test("buildBookEpub returns a zip-ready EPUB artifact description", () => {
  const artifact = buildBookEpub(sampleBook, "King James Bible");

  assert.equal(buildBookFileName(sampleBook.number, sampleBook.title), "01 Genesis.epub");
  assert.equal(buildZipPath(sampleBook), "Old Testament/01 Genesis.epub");
  assert.equal(artifact.fileName, "01 Genesis.epub");
  assert.equal(artifact.zipPath, "Old Testament/01 Genesis.epub");
  assert.ok(artifact.bytes instanceof Uint8Array);
  assert.ok(artifact.bytes.length > 0);
});
