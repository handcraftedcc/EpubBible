import argparse
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from html import escape
from xml.sax.saxutils import quoteattr


BOOK_NAMES = [
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
    "Jude", "Revelation",
]


def extract_translation_name(translation):
    name = (translation or "").strip()
    idx = name.find(" ==")
    if idx != -1:
        name = name[:idx].strip()
    if name.startswith("English "):
        name = name[len("English "):]
    return name or "Unknown"


def slugify(text):
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_") or "book"


def testament_subdir(book_number):
    if book_number <= 39:
        return "Old Testament"
    return "New Testament"


def collect_text(element):
    return "".join(element.itertext()).strip()


def inline_verses(verse_elements, show_first_number=False):
    parts = []
    for index, verse_el in enumerate(verse_elements):
        verse_num = verse_el.get("number", "").strip()
        verse_text = collect_text(verse_el)
        if not verse_text:
            continue
        prefix = ""
        if verse_num and (show_first_number or index > 0):
            prefix = "[{}] ".format(escape(verse_num))
        parts.append(prefix + escape(verse_text))
    return " ".join(parts)


def chapter_xhtml(book_title, chapter_number, verse_elements, show_first_number=False):
    body = inline_verses(verse_elements, show_first_number=show_first_number)
    if not body:
        body = "<em>No verses found.</em>"
    return """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>{title} {chapter}</title>
    <meta charset="utf-8" />
    <style>
      body {{ font-family: serif; line-height: 1.45; margin: 5%; }}
      h1 {{ margin-bottom: 0.2em; }}
      h2 {{ margin-top: 1.2em; }}
      p {{ text-indent: 0; }}
    </style>
  </head>
  <body>
    <h1>{title}</h1>
    <h2>Chapter {chapter}</h2>
    <p>{body}</p>
  </body>
</html>
""".format(title=escape(book_title), chapter=escape(str(chapter_number)), body=body)


def toc_xhtml(book_title, chapter_numbers):
    links = []
    for chapter_number in chapter_numbers:
        links.append(
            '      <li><a href="chapter_{:03d}.xhtml">Chapter {}</a></li>'.format(
                chapter_number,
                escape(str(chapter_number)),
            )
        )
    return """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>{title}</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc" id="toc">
      <h1>{title}</h1>
      <ol>
{links}
      </ol>
    </nav>
  </body>
</html>
""".format(title=escape(book_title), links="\n".join(links))


def content_opf(identifier, book_title, author, chapter_numbers):
    manifest_items = [
        '    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
    ]
    spine_items = ['    <itemref idref="nav"/>']

    for chapter_number in chapter_numbers:
        item_id = "chapter_{:03d}".format(chapter_number)
        href = "chapter_{:03d}.xhtml".format(chapter_number)
        manifest_items.append(
            '    <item id="{item_id}" href="{href}" media-type="application/xhtml+xml"/>'.format(
                item_id=item_id,
                href=href,
            )
        )
        spine_items.append('    <itemref idref="{}"/>'.format(item_id))

    return """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{identifier}</dc:identifier>
    <dc:title>{title}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>{author}</dc:creator>
  </metadata>
  <manifest>
{manifest}
  </manifest>
  <spine>
{spine}
  </spine>
</package>
""".format(
        identifier=escape(identifier),
        title=escape(book_title),
        author=escape(author),
        manifest="\n".join(manifest_items),
        spine="\n".join(spine_items),
    )


def container_xml():
    return """<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""


def toc_ncx(identifier, book_title, chapter_numbers):
    nav_points = []
    for play_order, chapter_number in enumerate(chapter_numbers, start=1):
        nav_points.append(
            """    <navPoint id="navpoint-{n}" playOrder="{n}">
      <navLabel><text>Chapter {chapter}</text></navLabel>
      <content src="chapter_{chapter:03d}.xhtml"/>
    </navPoint>""".format(n=play_order, chapter=chapter_number)
        )
    return """<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content={identifier}/>
  </head>
  <docTitle><text>{title}</text></docTitle>
  <navMap>
{nav_points}
  </navMap>
</ncx>
""".format(
        identifier=quoteattr(identifier),
        title=escape(book_title),
        nav_points="\n".join(nav_points),
    )


def write_epub(output_path, book_title, author, chapter_map, show_first_number=False):
    chapter_numbers = sorted(chapter_map.keys())
    identifier = "{}:{}".format(slugify(author), slugify(book_title))

    with zipfile.ZipFile(output_path, "w") as epub:
        epub.writestr(
            zipfile.ZipInfo("mimetype"),
            "application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )
        epub.writestr("META-INF/container.xml", container_xml())
        epub.writestr("OEBPS/content.opf", content_opf(identifier, book_title, author, chapter_numbers))
        epub.writestr("OEBPS/toc.ncx", toc_ncx(identifier, book_title, chapter_numbers))
        epub.writestr("OEBPS/toc.xhtml", toc_xhtml(book_title, chapter_numbers))

        for chapter_number in chapter_numbers:
            epub.writestr(
                "OEBPS/chapter_{:03d}.xhtml".format(chapter_number),
                chapter_xhtml(
                    book_title,
                    chapter_number,
                    chapter_map[chapter_number],
                    show_first_number=show_first_number,
                ),
            )


def convert(xml_path, output_dir, show_first_number=False):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    translation = extract_translation_name(root.get("translation", "Unknown"))
    os.makedirs(output_dir, exist_ok=True)

    wrote = 0
    for book_el in root.findall(".//book"):
        try:
            book_number = int(book_el.get("number", "0"))
        except ValueError:
            continue
        if book_number < 1 or book_number > len(BOOK_NAMES):
            continue

        book_title = BOOK_NAMES[book_number - 1]
        chapter_map = {}
        for chapter_el in book_el.findall("chapter"):
            try:
                chapter_number = int(chapter_el.get("number", "0"))
            except ValueError:
                continue
            chapter_map[chapter_number] = chapter_el.findall("verse")

        if not chapter_map:
            continue

        testament_dir = os.path.join(output_dir, testament_subdir(book_number))
        os.makedirs(testament_dir, exist_ok=True)
        filename = "{:02d} {}.epub".format(book_number, book_title)
        output_path = os.path.join(testament_dir, filename)
        write_epub(
            output_path,
            "{} ({})".format(book_title, translation),
            translation,
            chapter_map,
            show_first_number=show_first_number,
        )
        wrote += 1
        print("wrote {}".format(output_path))

    print("done: {} -> {} ({} epubs)".format(xml_path, output_dir, wrote))


def main():
    parser = argparse.ArgumentParser(description="Convert Bible XML to one EPUB per Bible book.")
    parser.add_argument("xml", help="Path to Bible XML file")
    parser.add_argument(
        "-o",
        "--output-dir",
        default=None,
        help="Output directory (default: based on XML filename)",
    )
    parser.add_argument(
        "--show-first-verse-number",
        action="store_true",
        help="Prefix the first verse in each chapter with [1] as well.",
    )
    args = parser.parse_args()

    if args.output_dir:
        output_dir = args.output_dir
    else:
        base = os.path.splitext(os.path.basename(args.xml))[0]
        output_dir = os.path.join(os.path.dirname(args.xml), base + "_epubs")

    convert(args.xml, output_dir, show_first_number=args.show_first_verse_number)


if __name__ == "__main__":
    main()
