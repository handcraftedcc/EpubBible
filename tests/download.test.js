import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildTranslationZip } from "../src/download.js";

const execFileAsync = promisify(execFile);

const parsedBible = {
  translation: "King James Bible",
  books: [
    {
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
      ],
    },
    {
      number: 40,
      title: "Matthew",
      testament: "New Testament",
      chapters: [{ number: 1, verses: [{ number: "1", text: "The book of the generation of Jesus Christ." }] }],
    },
  ],
};

test("buildTranslationZip packages per-book epubs into testament folders", async () => {
  const artifact = buildTranslationZip(parsedBible);

  assert.equal(artifact.fileName, "king_james_bible_epubs.zip");
  assert.ok(artifact.bytes instanceof Uint8Array);

  const tempDir = await mkdtemp(join(tmpdir(), "epub-bible-"));
  const zipPath = join(tempDir, artifact.fileName);
  await writeFile(zipPath, artifact.bytes);

  const { stdout } = await execFileAsync("python3", [
    "-c",
    [
      "import sys, zipfile",
      "zf = zipfile.ZipFile(sys.argv[1])",
      "print('\\n'.join(sorted(zf.namelist())))",
    ].join("; "),
    zipPath,
  ]);

  assert.match(stdout, /Old Testament\/01 Genesis\.epub/);
  assert.match(stdout, /New Testament\/40 Matthew\.epub/);
});
