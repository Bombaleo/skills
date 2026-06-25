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

    def test_nav_labels_allowlist_collapses_content_to_overview(self):
        """With a nav allowlist, only real nav labels form modules; screens reached
        through dashboard content (no nav label in their path) fold into Overview,
        and module order follows the nav list with Overview first."""
        index = {"screens": [
            {"id": 0, "title": "Dashboard", "path": [], "txt": "000.txt"},
            {"id": 1, "title": "A calendar cell", "path": ["Jun 25 widget"], "txt": "001.txt"},
            {"id": 2, "title": "Invoices", "path": ["Invoices"], "txt": "002.txt"},
            {"id": 3, "title": "Invoice detail", "path": ["Invoices", "Open"], "txt": "003.txt"},
            {"id": 4, "title": "Analytics", "path": ["Analytics"], "txt": "004.txt"},
            # nav label not first in path, but reached via dashboard widget then nav
            {"id": 5, "title": "Sched", "path": ["Some widget", "Schedule"], "txt": "005.txt"},
        ]}
        nav = ["Analytics", "Schedule", "Invoices"]
        out = group_screens(index, nav_labels=nav)
        mods = {m["name"]: m for m in out["modules"]}
        # content-only screens (calendar cell, dashboard, widget w/o nav) -> Overview
        self.assertEqual(mods["Overview"]["screen_ids"], [0, 1])
        self.assertEqual(mods["Invoices"]["screen_ids"], [2, 3])
        self.assertEqual(mods["Schedule"]["screen_ids"], [5])  # first nav label in path
        self.assertNotIn("Jun 25 widget", mods)  # no junk modules
        self.assertNotIn("Some widget", mods)
        # order: Overview first, then nav-list order
        self.assertEqual([m["name"] for m in out["modules"]],
                         ["Overview", "Analytics", "Schedule", "Invoices"])

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
