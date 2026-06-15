import test from "node:test";
import assert from "node:assert/strict";

import { filterManifest, loadManifest } from "../src/manifest.js";

test("filterManifest matches language, name, and path text", () => {
  const entries = [
    {
      name: "English King James Bible",
      language: "English",
      path: "English/English_King_James_Bible.xml",
    },
    {
      name: "Lutherbibel 1912",
      language: "Deutsch",
      path: "Deutsch/Lutherbibel_1912.xml",
    },
  ];

  assert.equal(filterManifest(entries, "").length, 2);
  assert.equal(filterManifest(entries, "deutsch").length, 1);
  assert.equal(filterManifest(entries, "king_james").length, 1);
  assert.equal(filterManifest(entries, "missing").length, 0);
});

test("loadManifest returns parsed JSON and throws on failed fetch", async () => {
  const okFetch = async () => ({
    ok: true,
    async json() {
      return [{ name: "English King James Bible" }];
    },
  });

  const failFetch = async () => ({ ok: false, status: 503 });

  const entries = await loadManifest("./manifest.json", okFetch);
  assert.deepEqual(entries, [{ name: "English King James Bible" }]);

  await assert.rejects(() => loadManifest("./manifest.json", failFetch), /503/);
});
