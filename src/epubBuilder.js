import { createZipArchive } from "./zip.js";

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function quoteAttribute(text) {
  return `"${escapeHtml(text)}"`;
}

export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "book";
}

export function buildInlineVerses(verses) {
  return verses
    .filter((verse) => verse.text?.trim())
    .map((verse) => `[${escapeHtml(verse.number)}] ${escapeHtml(verse.text.trim())}`)
    .join(" ");
}

export function buildChapterXhtml(bookTitle, chapterNumber, verses) {
  const body = buildInlineVerses(verses) || "<em>No verses found.</em>";
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeHtml(bookTitle)} ${escapeHtml(chapterNumber)}</title>
    <meta charset="utf-8" />
    <style>
      body { font-family: serif; line-height: 1.45; margin: 5%; }
      h1 { margin-bottom: 0.2em; }
      h2 { margin-top: 1.2em; }
      p { text-indent: 0; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(bookTitle)}</h1>
    <h2>Chapter ${escapeHtml(chapterNumber)}</h2>
    <p>${body}</p>
  </body>
</html>
`;
}

export function buildTocXhtml(bookTitle, chapterNumbers) {
  const links = chapterNumbers
    .map(
      (chapterNumber) =>
        `      <li><a href="chapter_${String(chapterNumber).padStart(3, "0")}.xhtml">Chapter ${escapeHtml(chapterNumber)}</a></li>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeHtml(bookTitle)}</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc" id="toc">
      <h1>${escapeHtml(bookTitle)}</h1>
      <ol>
${links}
      </ol>
    </nav>
  </body>
</html>
`;
}

export function buildContentOpf(identifier, bookTitle, author, chapterNumbers) {
  const manifestItems = [
    '    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
  ];
  const spineItems = ['    <itemref idref="nav"/>'];

  for (const chapterNumber of chapterNumbers) {
    const itemId = `chapter_${String(chapterNumber).padStart(3, "0")}`;
    const href = `${itemId}.xhtml`;
    manifestItems.push(`    <item id="${itemId}" href="${href}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="${itemId}"/>`);
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeHtml(identifier)}</dc:identifier>
    <dc:title>${escapeHtml(bookTitle)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>${escapeHtml(author)}</dc:creator>
  </metadata>
  <manifest>
${manifestItems.join("\n")}
  </manifest>
  <spine toc="ncx">
${spineItems.join("\n")}
  </spine>
</package>
`;
}

export function containerXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;
}

export function buildTocNcx(identifier, bookTitle, chapterNumbers) {
  const navPoints = chapterNumbers
    .map(
      (chapterNumber, index) => `    <navPoint id="navpoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>Chapter ${escapeHtml(chapterNumber)}</text></navLabel>
      <content src="chapter_${String(chapterNumber).padStart(3, "0")}.xhtml"/>
    </navPoint>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content=${quoteAttribute(identifier)}/>
  </head>
  <docTitle><text>${escapeHtml(bookTitle)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`;
}

export function buildBookFileName(bookNumber, bookTitle) {
  return `${String(bookNumber).padStart(2, "0")} ${bookTitle}.epub`;
}

export function buildZipPath(book) {
  return `${book.testament}/${buildBookFileName(book.number, book.title)}`;
}

export function buildBookEpubEntries(book, translation) {
  const chapterNumbers = book.chapters.map((chapter) => chapter.number);
  const bookTitle = `${book.title} (${translation})`;
  const identifier = `${slugify(translation)}:${slugify(book.title)}`;
  const entries = [
    { name: "mimetype", data: "application/epub+zip" },
    { name: "META-INF/container.xml", data: containerXml() },
    { name: "OEBPS/content.opf", data: buildContentOpf(identifier, bookTitle, translation, chapterNumbers) },
    { name: "OEBPS/toc.ncx", data: buildTocNcx(identifier, bookTitle, chapterNumbers) },
    { name: "OEBPS/toc.xhtml", data: buildTocXhtml(bookTitle, chapterNumbers) },
  ];

  for (const chapter of book.chapters) {
    entries.push({
      name: `OEBPS/chapter_${String(chapter.number).padStart(3, "0")}.xhtml`,
      data: buildChapterXhtml(book.title, chapter.number, chapter.verses),
    });
  }

  return entries;
}

export function buildBookEpub(book, translation) {
  const entries = buildBookEpubEntries(book, translation);
  return {
    fileName: buildBookFileName(book.number, book.title),
    zipPath: buildZipPath(book),
    bytes: createZipArchive(entries),
  };
}
