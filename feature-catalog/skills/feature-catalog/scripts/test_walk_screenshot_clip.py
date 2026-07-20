import unittest
from walk_prototype import screenshot_clip


class TestScreenshotClip(unittest.TestCase):
    def test_uses_css_content_size(self):
        m = {"cssContentSize": {"x": 0, "y": 0, "width": 1440, "height": 3200}}
        self.assertEqual(screenshot_clip(m),
                         {"x": 0, "y": 0, "width": 1440, "height": 3200, "scale": 1})

    def test_caps_height(self):
        m = {"cssContentSize": {"x": 0, "y": 0, "width": 1440, "height": 99999}}
        self.assertEqual(screenshot_clip(m, max_px=20000)["height"], 20000)

    def test_rounds_floats(self):
        m = {"cssContentSize": {"x": 0, "y": 0, "width": 1440.7, "height": 900.2}}
        c = screenshot_clip(m)
        self.assertEqual((c["width"], c["height"]), (1441, 900))

    def test_falls_back_to_content_size(self):
        m = {"contentSize": {"x": 0, "y": 0, "width": 800, "height": 600}}
        self.assertEqual(screenshot_clip(m),
                         {"x": 0, "y": 0, "width": 800, "height": 600, "scale": 1})

    def test_none_when_missing(self):
        self.assertIsNone(screenshot_clip({}))

    def test_none_when_zero(self):
        self.assertIsNone(screenshot_clip({"cssContentSize": {"width": 0, "height": 0}}))


if __name__ == "__main__":
    unittest.main()
