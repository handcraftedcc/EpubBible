# Bible Epub Downloader

A local browser-based downloader for turning Bible XML files from the upstream Beblia repository into ebook-friendly EPUB archives.

Open the web app here: [Bible Epub Downloader](https://handcraftedcc.github.io/EpubBible/).

## What This Project Does

- loads a generated manifest of Bible XML sources from the upstream Beblia repository
- lets a user search and select one translation in the browser
- fetches the selected XML file directly from the upstream raw GitHub URL
- converts that XML into one EPUB per Bible book
- packages the generated EPUB files into a single ZIP download

## What This Project Does Not Do

This repository does not contain, mirror, or vend the Bible XML source data.

It provides a browser-based conversion interface that runs on your local system for XML files published by the upstream Beblia [`Holy-Bible-XML-Format`](https://github.com/Beblia/Holy-Bible-XML-Format) repository. The app fetches the source XML from that upstream project and converts it into a ZIP of EPUB files, organized by Old Testament, New Testament, and individual books. This repo only stores:

- the web app
- the generated source manifest
- the manifest refresh tooling
- tests and documentation

## Upstream Source

- Beblia `Holy-Bible-XML-Format`: [https://github.com/Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format)

## Output Format

The EPUB formatting is designed to match the current Python reference script in [Example/convert_bible_xml_to_epub.py](/Users/dominiklange/Documents/GitHub/EpubBible/Example/convert_bible_xml_to_epub.py):

- one EPUB per Bible book
- one EPUB chapter document per Bible chapter
- chapter headings rendered as `Chapter N`
- verses rendered in one continuous block
- inline bracketed verse numbers such as `[1]`, `[23]`
- ZIP output grouped into `Old Testament/` and `New Testament/`

## Repository Layout

- [index.html](/Users/dominiklange/Documents/GitHub/EpubBible/index.html): site entry point
- [public/manifest.json](/Users/dominiklange/Documents/GitHub/EpubBible/public/manifest.json): generated manifest of upstream XML files
- [public/styles.css](/Users/dominiklange/Documents/GitHub/EpubBible/public/styles.css): site styling
- [src/app.js](/Users/dominiklange/Documents/GitHub/EpubBible/src/app.js): browser app flow
- [src/xmlParser.js](/Users/dominiklange/Documents/GitHub/EpubBible/src/xmlParser.js): Bible XML normalization
- [src/epubBuilder.js](/Users/dominiklange/Documents/GitHub/EpubBible/src/epubBuilder.js): EPUB content generation
- [src/download.js](/Users/dominiklange/Documents/GitHub/EpubBible/src/download.js): ZIP packaging and browser download
- [scripts/build_manifest.py](/Users/dominiklange/Documents/GitHub/EpubBible/scripts/build_manifest.py): manifest refresh script

## Local Development

Serve the repo root as a static site:

```bash
python3 -m http.server 8000
```

Then open:

- `http://127.0.0.1:8000/`

## Refreshing the Manifest

Regenerate the committed manifest from the upstream Beblia repo:

```bash
python3 scripts/build_manifest.py
```

The script writes:

- [public/manifest.json](/Users/dominiklange/Documents/GitHub/EpubBible/public/manifest.json)

There is also a GitHub Actions workflow at [build-manifest.yml](/Users/dominiklange/Documents/GitHub/EpubBible/.github/workflows/build-manifest.yml) for scheduled or manual refreshes.

To refresh it from GitHub:

1. Open the repo `Actions` tab
2. Open `Build Manifest`
3. Click `Run workflow`

If the upstream manifest changed, the workflow will commit the updated [public/manifest.json](/Users/dominiklange/Documents/GitHub/EpubBible/public/manifest.json) back to the repository automatically.

## Running Tests

JavaScript tests:

```bash
node --test
```

Python manifest tests:

```bash
PYTHONPATH=. python3 tests/build_manifest.test.py
```

## GitHub Pages

The site is set up to work as a static root-hosted site. For GitHub Pages, the simplest setup is to publish from the repository root so:

- [index.html](/Users/dominiklange/Documents/GitHub/EpubBible/index.html) is the main entry point
- [src/](/Users/dominiklange/Documents/GitHub/EpubBible/src) stays directly reachable as module assets
- [public/manifest.json](/Users/dominiklange/Documents/GitHub/EpubBible/public/manifest.json) remains available for the browser app

## Known Limitations

- conversion depends on the upstream raw XML URL being reachable from the browser
- XML variations outside the expected Beblia structure may need additional parsing hardening
- generating many EPUB files in one browser session may be memory-intensive on lower-powered devices

## About AI Usage

This project was developed with help from AI coding agents. The agents assisted with implementation, copy editing, and review, while the final structure, behavior, and published wording were chosen and validated by the maintainer.
