#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


UPSTREAM_TREE_URL = "https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/git/trees/master?recursive=1"
RAW_BASE_URL = "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/"


def humanize_name(path: str) -> str:
    stem = Path(path).stem
    return stem.replace("_", " ")


def build_manifest_entries(tree_entries: list[dict]) -> list[dict]:
    manifest = []
    for entry in tree_entries:
        path = entry.get("path", "")
        if entry.get("type") != "blob" or not path.endswith(".xml"):
            continue

        parts = path.split("/", 1)
        language = parts[0] if parts else "Unknown"
        manifest.append(
            {
                "name": humanize_name(path),
                "language": language,
                "path": path,
                "rawUrl": RAW_BASE_URL + path,
            }
        )

    manifest.sort(key=lambda item: (item["language"].lower(), item["name"].lower(), item["path"].lower()))
    return manifest


def fetch_upstream_tree() -> list[dict]:
    request = Request(UPSTREAM_TREE_URL, headers={"User-Agent": "EpubBible manifest builder"})
    try:
        with urlopen(request) as response:
            payload = json.load(response)
    except URLError as error:
        result = subprocess.run(
            ["curl", "-fsSL", UPSTREAM_TREE_URL],
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout)
    return payload["tree"]


def load_tree_entries(input_path: str | None) -> list[dict]:
    if not input_path:
        return fetch_upstream_tree()
    with open(input_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the Bible XML manifest from the upstream Beblia repository.")
    parser.add_argument(
        "--input-json",
        default=None,
        help="Optional path to a saved upstream tree JSON fixture for offline runs.",
    )
    parser.add_argument(
        "--output",
        default="public/manifest.json",
        help="Path to write the generated manifest JSON.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    tree_entries = load_tree_entries(args.input_json)
    manifest = build_manifest_entries(tree_entries)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"wrote {output_path} ({len(manifest)} entries)")


if __name__ == "__main__":
    main()
