# Bible EPUB Web Converter Design

**Date:** 2026-06-15

## Goal

Build a static GitHub Pages web app that lets a user select a Bible XML file from the Beblia `Holy-Bible-XML-Format` repository, convert it locally in the browser into one EPUB per Bible book, and download a single ZIP containing those EPUB files.

## Constraints

- No backend server
- This repository must not store Bible XML data
- The site must make clear that it only indexes and converts content from the upstream Beblia repository
- EPUB formatting must match the current Python reference script:
  - each chapter is its own EPUB chapter document
  - chapter pages contain a chapter heading
  - verses are rendered as a single text block
  - verse numbers are prefixed inline as `[1]`, `[23]`, etc.
- The primary output is one ZIP containing all generated per-book EPUB files

## Chosen Approach

Use a static site with native ES modules and a generated `manifest.json`.

- `manifest.json` is generated ahead of time from the upstream repo tree
- the browser fetches the selected XML from `raw.githubusercontent.com`
- XML parsing happens in-browser with `DOMParser`
- EPUB files are assembled in-browser with JavaScript
- the resulting per-book EPUB files are packaged into a ZIP for one-click download

## Why This Approach

- Matches GitHub Pages deployment
- Avoids backend complexity
- Preserves the project’s real end goal instead of shipping an intermediate full-Bible EPUB mode first
- Keeps upstream data ownership separate from this repo
- Uses the existing Python script as the output-format reference without trying to run Python in production

## Main Components

- `public/index.html`: app shell
- `public/styles.css`: UI styling
- `public/manifest.json`: generated Bible source list
- `public/vendor/jszip.min.js`: ZIP creation library
- `src/app.js`: UI flow, status, errors, and download actions
- `src/manifest.js`: manifest loading and filtering
- `src/bibleBooks.js`: canonical book names and testament grouping
- `src/xmlParser.js`: parse Beblia XML into normalized data
- `src/epubBuilder.js`: generate EPUB contents matching the Python script’s formatting model
- `src/download.js`: ZIP creation and download trigger
- `scripts/build_manifest.py`: refresh `manifest.json`
- `.github/workflows/build-manifest.yml`: optional automated manifest refresh
- `README.md`: explain project purpose, scope, and upstream-data relationship

## Open Implementation Notes

- The Python script currently makes verse numbers optional for the first verse in a chapter. The browser implementation should default to showing verse numbers inline as requested.
- The ZIP layout should preserve testament grouping to stay close to the reference output.
- The manifest generation script should be easy to run locally and easy to automate later.
