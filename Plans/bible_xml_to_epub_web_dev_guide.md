# Development Guide: Browser-Based Bible XML to EPUB Converter

## 1. Project goal

Build a lightweight website hosted on GitHub Pages that lets users:

1. Browse available Bible XML files from the Beblia `Holy-Bible-XML-Format` repository.
2. Search/filter by language or translation name.
3. Select one Bible XML file.
4. Convert it to EPUB directly in the browser.
5. Download the generated EPUB or ZIP file.

The app should not require a backend server. All processing should happen locally in the user’s browser.

---

## 2. Recommended architecture

Use GitHub Pages for hosting and browser JavaScript for processing.

```text
GitHub Pages site
  ├─ index.html
  ├─ app.js
  ├─ epub/
  │   ├─ bibleBooks.js
  │   ├─ xmlParser.js
  │   ├─ epubBuilder.js
  │   └─ download.js
  ├─ manifest.json
  ├─ vendor/
  │   └─ jszip.min.js
  └─ styles.css
```

The conversion flow should be:

```text
User opens website
  ↓
Website loads manifest.json
  ↓
User selects Bible translation
  ↓
Browser downloads XML from raw.githubusercontent.com
  ↓
Browser parses XML with DOMParser
  ↓
Browser generates EPUB files as strings
  ↓
JSZip packages the EPUB
  ↓
Browser downloads the .epub or .zip
```

---

## 3. Core design choice: browser-side conversion

Do not try to run the existing Python script on GitHub Pages. GitHub Pages is static hosting, so the Python script should be treated as the reference implementation.

Port the Python script’s logic to JavaScript.

Python to JavaScript mapping:

```text
xml.etree.ElementTree  → DOMParser
zipfile.ZipFile        → JSZip
html.escape            → custom escapeHtml()
quoteattr              → custom quoteAttr()
os.path                → string paths
argparse               → browser UI controls
```

The browser version should keep the same conceptual stages:

```text
parse XML
  ↓
extract translation name
  ↓
iterate books
  ↓
iterate chapters
  ↓
collect verses
  ↓
generate XHTML
  ↓
generate OPF/nav/container files
  ↓
zip as EPUB
  ↓
download
```

---

## 4. Initial feature set

### Version 1

Keep the first version simple:

- Load `manifest.json`.
- Show searchable list of Bible XML files.
- Convert selected XML to one full Bible EPUB.
- Show progress text while converting.
- Download the finished `.epub`.

### Version 2

Add:

- “One EPUB per Bible book” mode.
- ZIP download for 66 separate book EPUBs.
- Old Testament only / New Testament only options.
- Show first verse number toggle.
- Better language/translation grouping.
- Recent/favorite translations using `localStorage`.

---

## 5. Manifest strategy

Avoid scraping the GitHub web UI.

Use a static `manifest.json` in your own repo.

Example:

```json
[
  {
    "name": "English King James Bible",
    "language": "English",
    "path": "English/English_King_James_Bible.xml",
    "rawUrl": "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/English/English_King_James_Bible.xml"
  }
]
```

This is better than calling GitHub’s API every time a user opens the page.

### Manifest generation options

#### Option A: manual manifest

Start with a small manually curated list for development.

Good for early testing.

```json
[
  {
    "name": "English King James Bible",
    "language": "English",
    "path": "English_King_James_Bible.xml",
    "rawUrl": "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/English_King_James_Bible.xml"
  }
]
```

#### Option B: generated manifest

Add a Node or Python script that queries the GitHub repo tree and writes `manifest.json`.

This script runs during development or through GitHub Actions.

```text
scripts/
  build_manifest.py
```

Output:

```text
public/
  manifest.json
```

For production, this is the best approach.

---

## 6. Suggested file structure

```text
bible-epub-web/
  public/
    index.html
    styles.css
    manifest.json
    vendor/
      jszip.min.js

  src/
    app.js
    bibleBooks.js
    xmlParser.js
    epubBuilder.js
    download.js
    manifest.js
    utils.js

  scripts/
    build_manifest.py

  .github/
    workflows/
      build-manifest.yml

  README.md
```

If you want maximum simplicity, you can skip a bundler and use native ES modules:

```html
<script type="module" src="./src/app.js"></script>
```

For GitHub Pages, this is perfectly fine.

---

## 7. Module responsibilities

### `app.js`

Responsible for UI orchestration.

Responsibilities:

- Load manifest.
- Render list of translations.
- Handle search/filter.
- Handle button clicks.
- Call XML fetcher.
- Call EPUB builder.
- Trigger download.
- Display progress/errors.

Pseudo-flow:

```js
async function main() {
  const manifest = await loadManifest();
  renderBibleList(manifest);

  onConvertClicked(async (selectedBible) => {
    setStatus("Downloading XML...");
    const xmlText = await fetchBibleXml(selectedBible.rawUrl);

    setStatus("Parsing XML...");
    const bible = parseBibleXml(xmlText);

    setStatus("Building EPUB...");
    const epubBlob = await buildFullBibleEpub(bible);

    setStatus("Ready.");
    downloadBlob(epubBlob, `${bible.safeTitle}.epub`);
  });
}

main();
```

---

### `manifest.js`

Responsible for loading and filtering the Bible list.

```js
export async function loadManifest() {
  const res = await fetch("./manifest.json");
  if (!res.ok) {
    throw new Error("Could not load manifest.json");
  }
  return await res.json();
}

export function filterManifest(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.language?.toLowerCase().includes(q) ||
    item.path.toLowerCase().includes(q)
  );
}
```

---

### `bibleBooks.js`

Stores the canonical 66-book order.

```js
export const BOOK_NAMES = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
  "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation"
];

export function testamentForBookNumber(bookNumber) {
  return bookNumber <= 39 ? "Old Testament" : "New Testament";
}
```

---

### `xmlParser.js`

Responsible for converting raw XML text into a simple JavaScript Bible object.

Target output shape:

```js
{
  translation: "King James Bible",
  books: [
    {
      number: 1,
      title: "Genesis",
      chapters: [
        {
          number: 1,
          verses: [
            { number: "1", text: "In the beginning..." }
          ]
        }
      ]
    }
  ]
}
```

Implementation outline:

```js
import { BOOK_NAMES } from "./bibleBooks.js";

export function parseBibleXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid XML file.");
  }

  const root = doc.documentElement;
  const translation = extractTranslationName(root.getAttribute("translation"));

  const books = [];

  for (const bookEl of root.querySelectorAll("book")) {
    const bookNumber = Number(bookEl.getAttribute("number"));
    if (!Number.isInteger(bookNumber) || bookNumber < 1 || bookNumber > BOOK_NAMES.length) {
      continue;
    }

    const chapters = [];

    for (const chapterEl of bookEl.querySelectorAll(":scope > chapter")) {
      const chapterNumber = Number(chapterEl.getAttribute("number"));
      if (!Number.isInteger(chapterNumber)) continue;

      const verses = [];

      for (const verseEl of chapterEl.querySelectorAll(":scope > verse")) {
        const verseNumber = verseEl.getAttribute("number") || "";
        const verseText = collectText(verseEl);
        if (!verseText) continue;

        verses.push({
          number: verseNumber.trim(),
          text: verseText
        });
      }

      if (verses.length) {
        chapters.push({
          number: chapterNumber,
          verses
        });
      }
    }

    if (chapters.length) {
      books.push({
        number: bookNumber,
        title: BOOK_NAMES[bookNumber - 1],
        chapters
      });
    }
  }

  return {
    translation,
    books
  };
}

function extractTranslationName(value) {
  let name = (value || "").trim();

  const idx = name.indexOf(" ==");
  if (idx !== -1) {
    name = name.slice(0, idx).trim();
  }

  if (name.startsWith("English ")) {
    name = name.slice("English ".length);
  }

  return name || "Unknown";
}

function collectText(element) {
  return element.textContent.trim();
}
```

Note: `:scope` is convenient but can be fragile in older browsers. If needed, replace it with manual child filtering.

---

## 8. EPUB builder design

Use JSZip to create the EPUB archive.

Install option:

```html
<script src="./vendor/jszip.min.js"></script>
```

Or use npm/Vite later if you want a build system.

The EPUB file must include:

```text
mimetype
META-INF/container.xml
OEBPS/content.opf
OEBPS/toc.xhtml
OEBPS/toc.ncx
OEBPS/chapter files
```

Important: the `mimetype` file should be the first file in the zip and should not be compressed.

---

## 9. Full Bible EPUB structure

For a full Bible EPUB, generate one XHTML file per chapter:

```text
mimetype
META-INF/
  container.xml
OEBPS/
  content.opf
  toc.xhtml
  toc.ncx
  chapters/
    001_genesis_001.xhtml
    001_genesis_002.xhtml
    ...
    040_matthew_001.xhtml
    ...
```

This is better than one XHTML file per book because Bible books can be large, and smaller chapter files make navigation smoother on e-readers.

---

## 10. EPUB builder API

Recommended public functions:

```js
export async function buildFullBibleEpub(bible, options = {}) {}

export async function buildBookEpub(book, translation, options = {}) {}

export async function buildBookZip(bible, options = {}) {}
```

Options:

```js
{
  showFirstVerseNumber: false,
  includeTocNcx: true,
  includeOldTestament: true,
  includeNewTestament: true
}
```

Start with `buildFullBibleEpub()` first.

---

## 11. XHTML generation

Chapter XHTML should be valid XHTML, not casual HTML.

Example:

```js
function chapterXhtml({ bookTitle, chapterNumber, verses, showFirstVerseNumber }) {
  const body = inlineVerses(verses, showFirstVerseNumber);

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeHtml(bookTitle)} ${escapeHtml(String(chapterNumber))}</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" type="text/css" href="../style.css" />
  </head>
  <body>
    <section epub:type="chapter">
      <h1>${escapeHtml(bookTitle)}</h1>
      <h2>Chapter ${escapeHtml(String(chapterNumber))}</h2>
      <p>${body}</p>
    </section>
  </body>
</html>`;
}
```

Verse rendering:

```js
function inlineVerses(verses, showFirstVerseNumber) {
  const parts = [];

  verses.forEach((verse, index) => {
    let prefix = "";

    if (verse.number && (showFirstVerseNumber || index > 0)) {
      prefix = `<sup>${escapeHtml(verse.number)}</sup> `;
    }

    parts.push(prefix + escapeHtml(verse.text));
  });

  return parts.join(" ");
}
```

Using `<sup>` for verse numbers will usually look better than `[2]`.

---

## 12. Shared EPUB stylesheet

Put a single CSS file inside the EPUB:

```text
OEBPS/style.css
```

Example:

```css
body {
  font-family: serif;
  line-height: 1.45;
  margin: 5%;
}

h1 {
  margin-bottom: 0.2em;
}

h2 {
  margin-top: 1.2em;
}

p {
  text-indent: 0;
}

sup {
  font-size: 0.7em;
  vertical-align: super;
  line-height: 0;
}
```

Then include `style.css` in the OPF manifest.

---

## 13. `container.xml`

This file tells the reader where the EPUB package file is.

```js
function containerXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}
```

---

## 14. `content.opf`

The OPF file needs:

- metadata
- manifest
- spine

For a full Bible EPUB:

```js
function contentOpf({ identifier, title, language, creator, chapters }) {
  const manifestItems = [
    `<item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="style" href="style.css" media-type="text/css"/>`
  ];

  const spineItems = [];

  chapters.forEach((chapter, index) => {
    const id = `chapter_${index + 1}`;
    manifestItems.push(
      `<item id="${id}" href="${chapter.href}" media-type="application/xhtml+xml"/>`
    );
    spineItems.push(`<itemref idref="${id}"/>`);
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeHtml(identifier)}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>${escapeHtml(language)}</dc:language>
    <dc:creator>${escapeHtml(creator)}</dc:creator>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    ${spineItems.join("\n    ")}
  </spine>
</package>`;
}
```

---

## 15. `toc.xhtml`

The EPUB 3 navigation document should include links to books and chapters.

A simple first version can list every chapter:

```js
function tocXhtml(title, chapters) {
  const links = chapters.map(ch =>
    `<li><a href="${escapeAttr(ch.href)}">${escapeHtml(ch.label)}</a></li>`
  ).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeHtml(title)}</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc" id="toc">
      <h1>${escapeHtml(title)}</h1>
      <ol>
        ${links}
      </ol>
    </nav>
  </body>
</html>`;
}
```

Later, improve this to nested book/chapter navigation:

```text
Genesis
  Chapter 1
  Chapter 2
Exodus
  Chapter 1
  Chapter 2
```

---

## 16. `toc.ncx`

Even though EPUB 3 uses `toc.xhtml`, some older e-readers still like `toc.ncx`.

Keep generating it for compatibility.

```js
function tocNcx(identifier, title, chapters) {
  const navPoints = chapters.map((chapter, index) => {
    const n = index + 1;
    return `<navPoint id="navpoint-${n}" playOrder="${n}">
      <navLabel><text>${escapeHtml(chapter.label)}</text></navLabel>
      <content src="${escapeAttr(chapter.href)}"/>
    </navPoint>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeAttr(identifier)}"/>
  </head>
  <docTitle><text>${escapeHtml(title)}</text></docTitle>
  <navMap>
    ${navPoints}
  </navMap>
</ncx>`;
}
```

---

## 17. Creating the EPUB ZIP

Using JSZip:

```js
export async function buildFullBibleEpub(bible, options = {}) {
  const zip = new JSZip();

  const title = `${bible.translation} Bible`;
  const identifier = `bible:${slugify(bible.translation)}`;

  const chapters = flattenChapters(bible);

  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE"
  });

  zip.file("META-INF/container.xml", containerXml());

  zip.file("OEBPS/style.css", epubCss());

  zip.file("OEBPS/content.opf", contentOpf({
    identifier,
    title,
    language: "en",
    creator: bible.translation,
    chapters
  }));

  zip.file("OEBPS/toc.xhtml", tocXhtml(title, chapters));
  zip.file("OEBPS/toc.ncx", tocNcx(identifier, title, chapters));

  for (const chapter of chapters) {
    zip.file(`OEBPS/${chapter.href}`, chapterXhtml({
      bookTitle: chapter.bookTitle,
      chapterNumber: chapter.chapterNumber,
      verses: chapter.verses,
      showFirstVerseNumber: options.showFirstVerseNumber ?? false
    }));
  }

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6
    }
  });
}
```

Note: test whether JSZip preserves the uncompressed first `mimetype` file correctly. If EPUBCheck complains, adjust the packaging logic.

---

## 18. Flattening Bible chapters

```js
function flattenChapters(bible) {
  const chapters = [];

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      const href = `chapters/${String(book.number).padStart(3, "0")}_${slugify(book.title)}_${String(chapter.number).padStart(3, "0")}.xhtml`;

      chapters.push({
        href,
        label: `${book.title} ${chapter.number}`,
        bookNumber: book.number,
        bookTitle: book.title,
        chapterNumber: chapter.number,
        verses: chapter.verses
      });
    }
  }

  return chapters;
}
```

---

## 19. Download helper

```js
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
```

---

## 20. Utility functions

```js
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "book";
}
```

---

## 21. Basic UI

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bible XML to EPUB Converter</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>Bible XML to EPUB Converter</h1>

    <p>
      Select a Bible XML file and convert it to EPUB in your browser.
      No file is uploaded to a server.
    </p>

    <input id="search" type="search" placeholder="Search language or translation..." />

    <select id="bibleSelect" size="12"></select>

    <fieldset>
      <legend>Output</legend>

      <label>
        <input type="radio" name="mode" value="full" checked />
        One full Bible EPUB
      </label>

      <label>
        <input type="radio" name="mode" value="books" />
        One EPUB per book, zipped
      </label>

      <label>
        <input id="showFirstVerse" type="checkbox" />
        Show verse number for first verse in each chapter
      </label>
    </fieldset>

    <button id="convertButton">Convert to EPUB</button>

    <p id="status"></p>
  </main>

  <script src="./vendor/jszip.min.js"></script>
  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

---

## 22. Error handling

Handle these cases cleanly:

- Manifest cannot load.
- Selected XML cannot be fetched.
- XML is invalid.
- XML has no valid Bible books.
- Browser runs out of memory.
- EPUB generation fails.
- Download blocked by browser.

Example user-facing errors:

```text
Could not load the Bible list.
Could not download that XML file.
This XML file could not be parsed.
No Bible books were found in this XML.
The EPUB could not be generated.
```

---

## 23. Progress updates

For large XML files, conversion may take a little time.

Add status messages:

```text
Loading Bible list...
Downloading XML...
Parsing XML...
Generating chapter files...
Packaging EPUB...
Download ready.
```

Later, add a real progress bar.

Possible progress units:

```text
books processed / total books
chapters processed / total chapters
```

---

## 24. Performance notes

Bible XML files are small enough that browser-side conversion should be fine.

Still, avoid unnecessary DOM work:

- Parse XML once.
- Convert into simple JS objects.
- Generate strings directly.
- Avoid rendering all verses into the webpage.
- Only render the translation list and progress UI.

If conversion freezes the page, move the conversion code into a Web Worker later.

Suggested later structure:

```text
src/
  worker/
    convertWorker.js
```

The main UI sends:

```js
worker.postMessage({
  type: "convert",
  xmlText,
  options
});
```

The worker replies with:

```js
{
  type: "done",
  blob
}
```

---

## 25. GitHub Pages setup

Simplest setup:

1. Create a new GitHub repository.
2. Put the static site in the root or `/docs`.
3. Go to repository settings.
4. Open Pages settings.
5. Set source to the desired branch and folder.
6. Visit the published GitHub Pages URL.

Recommended setup:

```text
main branch
  /docs
    index.html
    styles.css
    src/
    vendor/
    manifest.json
```

Then publish from `/docs`.

This keeps your scripts and README separate from the public website.

---

## 26. Optional GitHub Action: update manifest

A later improvement is to automatically rebuild `manifest.json`.

Workflow idea:

```text
Every week:
  checkout this repo
  run scripts/build_manifest.py
  write docs/manifest.json
  commit if changed
```

Example `.github/workflows/update-manifest.yml`:

```yaml
name: Update Bible manifest

on:
  workflow_dispatch:
  schedule:
    - cron: "0 6 * * 1"

jobs:
  update-manifest:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Build manifest
        run: python scripts/build_manifest.py

      - name: Commit manifest changes
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add docs/manifest.json
          git diff --cached --quiet || git commit -m "Update Bible manifest"
          git push
```

The script can call the GitHub tree API, find `.xml` files, and write a simplified manifest.

---

## 27. Testing plan

### Test with a tiny fake XML first

Create `test/sample.xml`:

```xml
<bible translation="English Test Bible">
  <book number="1">
    <chapter number="1">
      <verse number="1">In the beginning test text.</verse>
      <verse number="2">Second verse.</verse>
    </chapter>
  </book>
</bible>
```

Use this before testing full Bible files.

### Test outputs

Check generated EPUBs in:

- Calibre
- Apple Books
- Kindle Previewer
- Thorium Reader
- EPUBCheck

### Validate

Things to verify:

- EPUB opens.
- TOC works.
- Chapters are in correct order.
- Verse text is escaped correctly.
- Special characters display correctly.
- Bible translation name appears in metadata.
- File downloads with a sane filename.

---

## 28. MVP checklist

Build in this order:

1. Create static page.
2. Add manual `manifest.json` with one XML entry.
3. Fetch XML from raw GitHub URL.
4. Parse XML with `DOMParser`.
5. Convert XML into JS Bible object.
6. Generate one chapter XHTML string.
7. Add JSZip.
8. Build minimal EPUB with one chapter.
9. Expand to all chapters.
10. Add TOC.
11. Add full Bible EPUB output.
12. Test in Calibre.
13. Add search/filter UI.
14. Add generated manifest.
15. Add per-book ZIP mode.

---

## 29. First milestone

The first real milestone should be:

```text
A GitHub Pages site with one hardcoded KJV XML file that converts to one downloadable full Bible EPUB.
```

Do not start with all languages, all translations, per-book mode, or GitHub Actions. Get one known XML file converting correctly first.

Once one works, scaling up is mostly UI and manifest work.

---

## 30. Future nice-to-haves

Possible later features:

- Language grouping.
- Translation metadata preview.
- Download as one full EPUB.
- Download as 66 book EPUBs in a ZIP.
- Download as TinyLIBRY-ready folder format.
- Download as compressed JSON for your e-ink reader.
- Include book/chapter index file.
- Option to remove verse numbers.
- Option to show verse numbers as superscript.
- Option to split chapters into smaller reading pages.
- Dark/light UI.
- Local browser cache for downloaded XML.
- “Recently converted” list.
- Web Worker conversion for smoother UI.
- EPUBCheck validation in CI using a few sample outputs.

---

## 31. Recommended implementation order

Start small:

```text
Phase 1: Local proof of concept
  - one sample XML
  - one generated EPUB
  - manual test in Calibre

Phase 2: Browser UI
  - select Bible from manifest
  - convert button
  - download EPUB

Phase 3: Real Beblia integration
  - generated manifest
  - search/filter
  - better names/languages

Phase 4: Output options
  - full Bible EPUB
  - one EPUB per book ZIP
  - TinyLIBRY export format

Phase 5: Polish
  - progress bar
  - Web Worker
  - nicer metadata
  - EPUB validation
```

This path avoids getting stuck on automation and listing logic before the actual EPUB generation works.
