# Bible EPUB Web Converter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a GitHub Pages-compatible web app that converts Bible XML files from the Beblia upstream repository into a ZIP of per-book EPUBs, with EPUB chapter/verse formatting matching the current Python reference script and clear repo documentation that this project stores no Bible source data.

**Architecture:** Use a static site with native ES modules. Generate a committed `manifest.json` from the upstream repository using a refresh script, then load that manifest in the browser, fetch the selected XML directly from the upstream raw URL, parse it into a normalized structure, generate one EPUB per book using Python-matching XHTML/OPF/NCX/container templates, package the EPUB files into a ZIP, and download that ZIP.

**Tech Stack:** HTML, CSS, browser JavaScript, DOMParser, JSZip, Python for manifest generation, GitHub Pages, optional GitHub Actions

---

### Task 1: Scaffold the static site structure

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `src/app.js`
- Create: `src/manifest.js`
- Create: `src/bibleBooks.js`
- Create: `src/xmlParser.js`
- Create: `src/epubBuilder.js`
- Create: `src/download.js`
- Create: `public/vendor/`

**Step 1: Create the minimal static app shell**

Add an HTML page with:
- title and short explanation
- search input
- translation list container
- convert button
- status area
- error area

Include `<script type="module" src="../src/app.js"></script>` or equivalent page-compatible module path once file layout is finalized.

**Step 2: Add base styles**

Write `public/styles.css` for a clean single-page layout with:
- clear heading
- obvious explanation that the repo does not host Bible data
- filterable translation list
- visible convert/download status
- mobile-safe spacing

**Step 3: Add module placeholders**

Create minimal exported functions in each JS module so the app can import successfully before logic is filled in.

**Step 4: Verify the app shell loads**

Run: `python3 -m http.server 8000`
Expected: page loads at `http://localhost:8000/public/` with no fatal module import errors in the browser console

**Step 5: Commit**

```bash
git add public/index.html public/styles.css src/app.js src/manifest.js src/bibleBooks.js src/xmlParser.js src/epubBuilder.js src/download.js
git commit -m "feat: scaffold static bible epub web app"
```

### Task 2: Add canonical book metadata and normalized Bible parsing

**Files:**
- Modify: `src/bibleBooks.js`
- Modify: `src/xmlParser.js`
- Create: `tests/fixtures/sample_bible.xml`
- Create: `tests/xmlParser.test.js`

**Step 1: Write the failing parser tests**

Cover:
- translation extraction strips the `English ` prefix when present
- invalid book numbers are skipped
- books map to canonical names from the Python script
- chapters and verses preserve order
- verse text is collected from nested XML text nodes

Example:

```js
assert.equal(extractTranslationName("English King James Bible == Notes"), "King James Bible");
assert.equal(parsed.books[0].title, "Genesis");
assert.equal(parsed.books[0].chapters[0].verses[0].number, "1");
```

**Step 2: Run tests to verify failure**

Run: `node --test tests/xmlParser.test.js`
Expected: FAIL because parser exports or logic are incomplete

**Step 3: Implement the normalized parser**

Implement:
- `BOOK_NAMES` array matching the Python script
- `testamentSubdir(bookNumber)`
- `extractTranslationName(translation)`
- XML parsing from text with `DOMParser`
- normalized output structure such as:

```js
{
  translation: "King James Bible",
  books: [
    {
      number: 1,
      title: "Genesis",
      testament: "Old Testament",
      chapters: [
        {
          number: 1,
          verses: [{ number: "1", text: "In the beginning..." }]
        }
      ]
    }
  ]
}
```

**Step 4: Run tests to verify pass**

Run: `node --test tests/xmlParser.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/bibleBooks.js src/xmlParser.js tests/fixtures/sample_bible.xml tests/xmlParser.test.js
git commit -m "feat: parse bible xml into normalized book data"
```

### Task 3: Implement manifest generation with an easy refresh path

**Files:**
- Create: `scripts/build_manifest.py`
- Create: `public/manifest.json`
- Create: `.github/workflows/build-manifest.yml`
- Create: `tests/build_manifest.test.py`

**Step 1: Write the failing manifest tests**

Cover:
- only `.xml` files are included
- manifest entries include `name`, `language`, `path`, and `rawUrl`
- output is sorted predictably
- translation names are human-readable

Example:

```python
def test_manifest_entry_shape():
    entries = build_manifest_from_tree(sample_tree)
    assert entries[0]["rawUrl"].startswith("https://raw.githubusercontent.com/")
```

**Step 2: Run tests to verify failure**

Run: `python3 -m pytest tests/build_manifest.test.py -q`
Expected: FAIL because script does not exist yet

**Step 3: Implement the manifest builder**

Implement a Python script that:
- fetches or reads the upstream repo tree
- extracts all relevant XML files
- builds stable entries
- writes `public/manifest.json`
- supports one easy command such as:

```bash
python3 scripts/build_manifest.py
```

Add optional flags for:
- output path override
- offline input fixture for testing

**Step 4: Add easy automation**

Create a GitHub Actions workflow that can refresh the manifest on demand or on schedule.

**Step 5: Run tests and generate the initial manifest**

Run: `python3 -m pytest tests/build_manifest.test.py -q`
Expected: PASS

Run: `python3 scripts/build_manifest.py`
Expected: `public/manifest.json` is created or updated with upstream translation entries

**Step 6: Commit**

```bash
git add scripts/build_manifest.py public/manifest.json .github/workflows/build-manifest.yml tests/build_manifest.test.py
git commit -m "feat: generate translation manifest from upstream repo"
```

### Task 4: Load and filter the translation manifest in the browser

**Files:**
- Modify: `src/manifest.js`
- Modify: `src/app.js`
- Modify: `public/index.html`
- Create: `tests/manifest.test.js`

**Step 1: Write the failing manifest UI tests**

Cover:
- manifest loads from local `public/manifest.json`
- free-text filter matches translation name and language
- selecting one entry updates app state
- empty filter results show a friendly message

**Step 2: Run tests to verify failure**

Run: `node --test tests/manifest.test.js`
Expected: FAIL because manifest-loading and filtering logic is incomplete

**Step 3: Implement manifest browsing**

Implement:
- `loadManifest()`
- `filterManifest(entries, query)`
- renderable translation rows
- selected-state handling in `app.js`

**Step 4: Verify the browser interaction**

Run: `python3 -m http.server 8000`
Expected: manifest entries render, filtering works, and one translation can be selected

**Step 5: Commit**

```bash
git add src/manifest.js src/app.js public/index.html tests/manifest.test.js
git commit -m "feat: add translation manifest browsing"
```

### Task 5: Port Python EPUB formatting exactly enough for browser parity

**Files:**
- Modify: `src/epubBuilder.js`
- Create: `tests/epubBuilder.test.js`

**Step 1: Write the failing EPUB formatting tests**

Cover:
- chapter XHTML includes book title and `Chapter N` heading
- chapter body is one paragraph block
- verses are inline with `[1]`, `[2]`, `[23]` prefixes
- no separate verse paragraphs are emitted
- TOC, OPF, NCX, and container files are produced
- identifiers and filenames are stable

Example:

```js
assert.match(chapterXhtml, /<h2>Chapter 1<\/h2>/);
assert.match(chapterXhtml, /<p>\[1\] In the beginning \[2\] And the earth/);
assert.doesNotMatch(chapterXhtml, /<p>\[1\].*<\/p>\s*<p>\[2\]/s);
```

**Step 2: Run tests to verify failure**

Run: `node --test tests/epubBuilder.test.js`
Expected: FAIL because builder logic is incomplete

**Step 3: Implement EPUB string builders**

Port the Python reference logic for:
- `slugify`
- XHTML escaping
- inline verse rendering
- chapter XHTML
- `toc.xhtml`
- `content.opf`
- `toc.ncx`
- `META-INF/container.xml`

Keep parity with the Python script’s semantics:
- one chapter document per chapter
- one book EPUB per book
- chapter headings present
- verses rendered in a single block with inline bracketed numbers

**Step 4: Run tests to verify pass**

Run: `node --test tests/epubBuilder.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/epubBuilder.js tests/epubBuilder.test.js
git commit -m "feat: port python epub formatting to browser builder"
```

### Task 6: Generate EPUB archives and package them into one ZIP download

**Files:**
- Modify: `src/download.js`
- Modify: `src/epubBuilder.js`
- Modify: `src/app.js`
- Add: `public/vendor/jszip.min.js`
- Create: `tests/download.test.js`

**Step 1: Write the failing ZIP packaging tests**

Cover:
- one EPUB blob is created per parsed book
- ZIP contains `Old Testament/` and `New Testament/` grouped EPUB file paths
- filenames follow Python-style numbering and titles
- resulting ZIP download name includes the translation slug

**Step 2: Run tests to verify failure**

Run: `node --test tests/download.test.js`
Expected: FAIL because ZIP packaging does not exist yet

**Step 3: Implement browser ZIP packaging**

Implement:
- per-book EPUB assembly
- JSZip packaging
- one downloadable ZIP blob
- browser-safe download trigger

Use file paths like:

```text
Old Testament/01 Genesis.epub
New Testament/40 Matthew.epub
```

**Step 4: Verify end-to-end with one real translation**

Run: `python3 -m http.server 8000`
Expected: selecting a manifest entry fetches XML, builds many EPUBs, packages a ZIP, and downloads successfully

**Step 5: Commit**

```bash
git add src/download.js src/epubBuilder.js src/app.js public/vendor/jszip.min.js tests/download.test.js
git commit -m "feat: download generated per-book epubs as zip"
```

### Task 7: Add progress, error handling, and browser-safe status reporting

**Files:**
- Modify: `src/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Create: `tests/app.test.js`

**Step 1: Write the failing app-state tests**

Cover:
- status moves through loading, fetching, parsing, building, zipping, and ready states
- network failures show a clear error
- malformed XML shows a parse error
- convert button is disabled when no translation is selected

**Step 2: Run tests to verify failure**

Run: `node --test tests/app.test.js`
Expected: FAIL because state transitions and error handling are incomplete

**Step 3: Implement user-facing status flow**

Add clear messages:
- `Loading manifest...`
- `Downloading XML...`
- `Parsing XML...`
- `Building EPUB files...`
- `Packaging ZIP...`
- `Ready`

Include error guidance that points users to the upstream source URL when conversion fails.

**Step 4: Verify manually in the browser**

Run: `python3 -m http.server 8000`
Expected: app remains understandable during long conversions and recovers cleanly from fetch/parsing failures

**Step 5: Commit**

```bash
git add src/app.js public/index.html public/styles.css tests/app.test.js
git commit -m "feat: add conversion status and error handling"
```

### Task 8: Write a proper README that clearly explains data ownership

**Files:**
- Create: `README.md`

**Step 1: Draft the README content**

Include:
- what the project does
- what it does not do
- explicit statement that this repo does not store Bible XML data
- link/reference to the upstream Beblia repository
- local development instructions
- manifest refresh command
- GitHub Pages deployment model
- known limitations

Suggested language to preserve:

```md
This repository does not contain or mirror the Bible XML source data. It provides a browser-based conversion tool for XML files published by the upstream Beblia Holy-Bible-XML-Format repository.
```

**Step 2: Verify README accuracy against the implementation**

Check:
- file paths exist
- commands are correct
- output behavior matches the actual app

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project readme and data ownership notes"
```

### Task 9: Add final verification and deployment checks

**Files:**
- Modify: `README.md`
- Modify: any files needed based on verification results

**Step 1: Run the automated tests**

Run:

```bash
node --test
python3 -m pytest -q
```

Expected: PASS

**Step 2: Run the local static site**

Run: `python3 -m http.server 8000`
Expected: the app works from `http://localhost:8000/public/`

**Step 3: Perform manual end-to-end verification**

Verify:
- manifest loads
- search works
- translation selection works
- XML fetch succeeds for at least one known entry
- ZIP downloads successfully
- ZIP contains per-book EPUBs grouped by testament
- EPUB chapter pages include chapter headings
- verses are rendered inline in one block with bracketed numbers such as `[1]`, `[23]`
- README language matches the shipped behavior

**Step 4: Fix any issues found and rerun verification**

Repeat until local verification passes cleanly.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: verify browser epub converter"
```
