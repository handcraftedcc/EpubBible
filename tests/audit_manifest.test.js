import test from "node:test";
import assert from "node:assert/strict";

import { auditBibleXml, formatAuditSummary } from "../scripts/audit_manifest.js";

test("auditBibleXml accepts translation attribute metadata", () => {
  const result = auditBibleXml(
    {
      name: "AcehBible",
      language: "AcehBible",
      path: "AcehBible.xml",
      rawUrl: "https://example.test/AcehBible.xml",
    },
    `<?xml version="1.0" encoding="utf-8"?>
    <bible translation="Aceh Language (Alkitab HABA GET)">
      <testament name="Old">
        <book number="1"><chapter number="1"><verse number="1">Text.</verse></chapter></book>
      </testament>
    </bible>`,
  );

  assert.equal(result.status, "ok");
  assert.equal(result.metadataSource, "translation");
  assert.equal(result.translation, "Aceh Language (Alkitab HABA GET)");
  assert.equal(result.bookCount, 1);
});

test("auditBibleXml downgrades missing xml metadata to a warning when manifest fallback is usable", () => {
  const result = auditBibleXml(
    {
      name: "BrokenBible",
      language: "Unknown",
      path: "BrokenBible.xml",
      rawUrl: "https://example.test/BrokenBible.xml",
    },
    `<?xml version="1.0" encoding="utf-8"?>
    <bible>
      <testament name="Old">
        <book number="1"><chapter number="1"><verse number="1">Text.</verse></chapter></book>
      </testament>
    </bible>`,
  );

  assert.equal(result.status, "warn");
  assert.equal(result.metadataSource, "entry");
  assert.equal(result.translation, "Broken Bible");
});

test("auditBibleXml uses manifest fallback metadata when xml metadata is absent", () => {
  const result = auditBibleXml(
    {
      name: "EnglishAmplifiedBible",
      language: "EnglishAmplifiedBible",
      path: "EnglishAmplifiedBible.xml",
      rawUrl: "https://example.test/EnglishAmplifiedBible.xml",
    },
    `<?xml version="1.0" encoding="utf-8"?>
    <bible>
      <testament name="Old">
        <book number="1"><chapter number="1"><verse number="1">Text.</verse></chapter></book>
      </testament>
    </bible>`,
  );

  assert.equal(result.status, "warn");
  assert.equal(result.metadataSource, "entry");
  assert.equal(result.translation, "Amplified Bible");
});

test("formatAuditSummary rolls counts into a stable report payload", () => {
  const summary = formatAuditSummary([
    { status: "ok" },
    { status: "warn" },
    { status: "warn" },
    { status: "fail" },
  ]);

  assert.deepEqual(summary, {
    total: 4,
    ok: 1,
    warn: 2,
    fail: 1,
  });
});
