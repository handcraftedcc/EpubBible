import json
import unittest


class BuildManifestTests(unittest.TestCase):
    def test_manifest_entry_shape(self):
        from scripts.build_manifest import build_manifest_entries

        sample_tree = [
            {"path": "English/English_King_James_Bible.xml", "type": "blob"},
            {"path": "English/README.md", "type": "blob"},
            {"path": "Deutsch/Lutherbibel_1912.xml", "type": "blob"},
        ]

        entries = build_manifest_entries(sample_tree)

        self.assertEqual(
            entries,
            [
                {
                    "name": "Lutherbibel 1912",
                    "language": "Deutsch",
                    "path": "Deutsch/Lutherbibel_1912.xml",
                    "rawUrl": "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/Deutsch/Lutherbibel_1912.xml",
                },
                {
                    "name": "English King James Bible",
                    "language": "English",
                    "path": "English/English_King_James_Bible.xml",
                    "rawUrl": "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/English/English_King_James_Bible.xml",
                },
            ],
        )

    def test_manifest_output_is_json_serializable(self):
        from scripts.build_manifest import build_manifest_entries

        entries = build_manifest_entries(
            [{"path": "Spanish/Reina_Valera_1909.xml", "type": "blob"}]
        )

        payload = json.dumps(entries)
        self.assertIn("Reina Valera 1909", payload)


if __name__ == "__main__":
    unittest.main()
