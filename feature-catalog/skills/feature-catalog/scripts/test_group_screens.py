import unittest
from group_screens import group_screens, slugify


class TestGroupScreens(unittest.TestCase):
    def test_groups_by_first_path_label(self):
        index = {"screens": [
            {"id": 0, "title": "Dashboard", "path": [], "txt": "000_dash.txt"},
            {"id": 1, "title": "Vendor list", "path": ["Vendors"], "txt": "001_v.txt"},
            {"id": 2, "title": "Invite vendor", "path": ["Vendors", "Invite"], "txt": "002_iv.txt"},
            {"id": 3, "title": "Invoices", "path": ["Invoices"], "txt": "003_inv.txt"},
        ]}
        out = group_screens(index)
        mods = {m["name"]: m for m in out["modules"]}
        self.assertEqual(set(mods), {"Overview", "Vendors", "Invoices"})
        self.assertEqual(mods["Vendors"]["screen_ids"], [1, 2])
        self.assertEqual(mods["Vendors"]["screen_files"], ["001_v.txt", "002_iv.txt"])
        self.assertEqual(mods["Overview"]["screen_ids"], [0])

    def test_overview_sorts_first_then_alphabetical(self):
        index = {"screens": [
            {"id": 0, "title": "Home", "path": [], "txt": "000.txt"},
            {"id": 1, "title": "X", "path": ["Zeta"], "txt": "001.txt"},
            {"id": 2, "title": "Y", "path": ["Alpha"], "txt": "002.txt"},
        ]}
        names = [m["name"] for m in group_screens(index)["modules"]]
        self.assertEqual(names, ["Overview", "Alpha", "Zeta"])

    def test_slugify(self):
        self.assertEqual(slugify("Vendor Onboarding"), "vendor_onboarding")
        self.assertEqual(slugify("A/P & Invoicing!"), "a_p_invoicing")

    def test_empty_screens(self):
        self.assertEqual(group_screens({"screens": []}), {"modules": []})

    def test_none_id_is_excluded(self):
        """Screens without an id should not append None to screen_ids."""
        index = {"screens": [
            {"title": "Home", "path": [], "txt": "000.txt"},  # no "id" key
            {"id": None, "title": "Also Home", "path": [], "txt": "001.txt"},  # explicit None
            {"id": 2, "title": "Vendors", "path": ["Vendors"], "txt": "002.txt"},
        ]}
        out = group_screens(index)
        mods = {m["name"]: m for m in out["modules"]}
        self.assertNotIn(None, mods["Overview"]["screen_ids"])
        self.assertEqual(mods["Vendors"]["screen_ids"], [2])


if __name__ == "__main__":
    unittest.main()
