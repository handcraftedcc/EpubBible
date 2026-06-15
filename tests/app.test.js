import test from "node:test";
import assert from "node:assert/strict";

import {
  convertTranslation,
  getSelectableTranslations,
  getVisibleTranslations,
  shouldShowMoreButton,
} from "../src/app.js";

test("convertTranslation reports progress and downloads the built zip", async () => {
  const statuses = [];
  const downloads = [];
  const entry = {
    name: "English King James Bible",
    language: "English",
    path: "English/English_King_James_Bible.xml",
    rawUrl: "https://example.test/English_King_James_Bible.xml",
  };

  await convertTranslation({
    entry,
    onStatus(message) {
      statuses.push(message);
    },
    fetchXml: async (url) => {
      assert.equal(url, entry.rawUrl);
      return '<xmlbible translation="English King James Bible"><book number="1"><chapter number="1"><verse number="1">In the beginning.</verse></chapter></book></xmlbible>';
    },
    parseXml(xmlText) {
      assert.match(xmlText, /In the beginning/);
      return {
        translation: "King James Bible",
        books: [
          {
            number: 1,
            title: "Genesis",
            testament: "Old Testament",
            chapters: [{ number: 1, verses: [{ number: "1", text: "In the beginning." }] }],
          },
        ],
      };
    },
    buildZip(parsedBible) {
      assert.equal(parsedBible.translation, "King James Bible");
      return { fileName: "king_james_bible_epubs.zip", bytes: new Uint8Array([1, 2, 3]) };
    },
    download(fileName, bytes) {
      downloads.push({ fileName, bytes: Array.from(bytes) });
    },
  });

  assert.deepEqual(statuses, [
    "Downloading XML...",
    "Parsing XML...",
    "Building EPUB files...",
    "Packaging ZIP...",
    "Ready.",
  ]);
  assert.deepEqual(downloads, [{ fileName: "king_james_bible_epubs.zip", bytes: [1, 2, 3] }]);
});

test("convertTranslation annotates failures with the upstream source URL", async () => {
  const statuses = [];
  await assert.rejects(
    () =>
      convertTranslation({
        entry: { rawUrl: "https://example.test/source.xml" },
        onStatus(message) {
          statuses.push(message);
        },
        fetchXml: async () => {
          throw new Error("Network exploded");
        },
      }),
    /https:\/\/example\.test\/source\.xml/,
  );
  assert.deepEqual(statuses, ["Downloading XML..."]);
});

test("getSelectableTranslations returns row data for the filterable list", () => {
  const options = getSelectableTranslations(
    [
      {
        name: "AcehBible",
        language: "AcehBible",
        path: "AcehBible.xml",
      },
      {
        name: "King James Bible",
        language: "English",
        path: "English/English_King_James_Bible.xml",
      },
    ],
    "king",
  );

  assert.deepEqual(options, [
    {
      value: "English/English_King_James_Bible.xml",
      label: "King James Bible",
      description: "English · English/English_King_James_Bible.xml",
    },
  ]);
});

test("getVisibleTranslations returns the first chunk of filtered rows", () => {
  const visible = getVisibleTranslations(
    [
      { value: "1", label: "AcehBible", description: "AcehBible · AcehBible.xml" },
      { value: "2", label: "King James Bible", description: "English · English_King_James_Bible.xml" },
      { value: "3", label: "Lutherbibel 1912", description: "Deutsch · Lutherbibel_1912.xml" },
    ],
    {
      query: "bible",
      visibleCount: 2,
    },
  );

  assert.equal(visible.filteredCount, 2);
  assert.deepEqual(
    visible.rows.map((option) => option.label),
    ["AcehBible", "King James Bible"],
  );
});

test("shouldShowMoreButton only appears when filtered results exceed the visible count", () => {
  assert.equal(shouldShowMoreButton({ filteredCount: 25, visibleCount: 20 }), true);
  assert.equal(shouldShowMoreButton({ filteredCount: 20, visibleCount: 20 }), false);
});
