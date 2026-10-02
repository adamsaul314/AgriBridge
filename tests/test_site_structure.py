"""Structural tests for the AgriBridge static site.

Run from the repository root (or anywhere):

    python3 -m unittest discover -s tests -v

These tests need no third-party packages. They cover the things a static site
can break without a compiler: asset paths, internal links, canonical/sitemap
consistency, shared-chrome consistency, HTML balance and CSS hygiene. Behaviour
of the JavaScript itself is covered by the browser suite in tests/index.html.
"""

import glob
import os
import re
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PAGES = [
    "index.html",
    "about.html",
    "gallery.html",
    "faq.html",
    "servicesWorker.html",
    "servicesContractor.html",
    "contact.html",
    "country-check.html",
    "application-closed.html",
    "404.html",
]

# Pages that should be advertised to search engines.
PUBLIC_PAGES = [
    "index.html",
    "about.html",
    "gallery.html",
    "faq.html",
    "servicesWorker.html",
    "servicesContractor.html",
    "contact.html",
    "country-check.html",
]

VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


def read(name):
    return (ROOT / name).read_text(encoding="utf-8")


def page_texts():
    return {name: read(name) for name in PAGES}


class TagBalanceChecker(HTMLParser):
    """Collects the first structural error, if any, in an HTML document."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.error = None

    def handle_starttag(self, tag, attrs):
        if tag not in VOID_ELEMENTS:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in VOID_ELEMENTS:
            return
        if not self.stack:
            self.error = "unexpected closing </%s>" % tag
        elif self.stack[-1] == tag:
            self.stack.pop()
        elif self.error is None:
            self.error = "closing </%s> while <%s> was open" % (tag, self.stack[-1])


class FolderStructureTests(unittest.TestCase):
    def test_all_pages_exist(self):
        for name in PAGES:
            self.assertTrue((ROOT / name).is_file(), "missing page: " + name)

    def test_assets_live_under_assets(self):
        self.assertTrue((ROOT / "assets/css/styles.css").is_file())
        self.assertTrue((ROOT / "assets/js/app.js").is_file())
        self.assertTrue((ROOT / "assets/js/main.js").is_file())

    def test_legacy_asset_locations_are_gone(self):
        self.assertFalse((ROOT / "styles.css").exists(), "styles.css should have moved")
        self.assertFalse((ROOT / "script.js").exists(), "script.js should have moved")

    def test_pages_reference_new_assets(self):
        for name, html in page_texts().items():
            self.assertIn('href="assets/css/styles.css"', html, name)
            self.assertIn('src="assets/js/main.js"', html, name)

    def test_no_legacy_asset_references(self):
        for name, html in page_texts().items():
            self.assertNotIn('href="styles.css"', html, name)
            self.assertNotIn('src="script.js"', html, name)


class ReferenceTests(unittest.TestCase):
    def test_local_references_exist(self):
        missing = []
        for name, html in page_texts().items():
            for attr, url in re.findall(r'(src|href)="([^"]+)"', html):
                if url.startswith(("http://", "https://", "mailto:", "#", "javascript:", "data:", "//")):
                    continue
                if not (ROOT / url).exists():
                    missing.append("%s %s=%s" % (name, attr, url))
        self.assertEqual(missing, [], "missing local references:\n" + "\n".join(missing))

    def test_in_page_anchors_resolve(self):
        broken = []
        for name, html in page_texts().items():
            ids = set(re.findall(r'id="([^"]+)"', html))
            for anchor in re.findall(r'href="#([^"]+)"', html):
                if anchor not in ids:
                    broken.append("%s #%s" % (name, anchor))
        self.assertEqual(broken, [], "broken in-page anchors:\n" + "\n".join(broken))

    def test_blank_target_links_are_hardened(self):
        offenders = []
        for name, html in page_texts().items():
            for tag in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", html):
                if "noopener" not in tag or "noreferrer" not in tag:
                    offenders.append("%s: %s" % (name, tag))
        self.assertEqual(offenders, [], "target=_blank links missing rel:\n" + "\n".join(offenders))


class SeoTests(unittest.TestCase):
    def test_every_page_has_a_unique_description(self):
        descriptions = {}
        for name, html in page_texts().items():
            match = re.search(r'<meta name="description" content="([^"]*)"', html)
            self.assertIsNotNone(match, name + " has no meta description")
            descriptions[name] = match.group(1)
        self.assertEqual(len(descriptions), len(set(descriptions.values())),
                         "meta descriptions are not unique")

    def test_canonical_matches_page(self):
        for name, html in page_texts().items():
            match = re.search(r'<link rel="canonical" href="([^"]+)"', html)
            self.assertIsNotNone(match, name + " has no canonical")
            expected = "/" if name == "index.html" else "/" + name
            self.assertTrue(match.group(1).endswith(expected),
                            "%s canonical should end with %s" % (name, expected))

    def test_sitemap_lists_public_pages(self):
        sitemap = read("sitemap.xml")
        locs = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))
        expected = set()
        for name in PUBLIC_PAGES:
            suffix = "/" if name == "index.html" else "/" + name
            expected.add("https://agribridgerecruitment.com" + suffix)
        self.assertEqual(locs, expected, "sitemap does not match the public pages")

    def test_noindex_pages_are_not_in_sitemap(self):
        sitemap = read("sitemap.xml")
        self.assertNotIn("application-closed.html", sitemap)
        self.assertNotIn("404.html", sitemap)

    def test_robots_points_at_sitemap(self):
        self.assertIn("Sitemap: https://agribridgerecruitment.com/sitemap.xml", read("robots.txt"))


class SharedChromeTests(unittest.TestCase):
    NAV_PATTERN = re.compile(
        r'<nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm py-3">.*?</nav>',
        re.S,
    )

    def navs(self):
        return {
            name: (self.NAV_PATTERN.search(html).group(0) if self.NAV_PATTERN.search(html) else None)
            for name, html in page_texts().items()
        }

    def test_each_page_has_one_navbar(self):
        for name, nav in self.navs().items():
            self.assertIsNotNone(nav, name + " has no navbar")

    def test_navbar_is_identical_everywhere(self):
        navs = self.navs()
        reference_name = next(iter(navs))
        reference = navs[reference_name]
        for name, nav in navs.items():
            self.assertEqual(nav, reference, "%s navbar differs from %s" % (name, reference_name))

    def test_navbar_is_accessible(self):
        for name, nav in self.navs().items():
            self.assertIn('aria-controls="navbarNav"', nav, name)
            self.assertIn('aria-expanded="false"', nav, name)

    def test_scripts_are_ordered(self):
        for name, html in page_texts().items():
            bundle = html.find("bootstrap.bundle.min.js")
            main = html.find("assets/js/main.js")
            self.assertNotEqual(bundle, -1, name + " missing bootstrap bundle")
            self.assertNotEqual(main, -1, name + " missing main.js")
            self.assertLess(bundle, main, name + " must load bootstrap before main.js")


class HtmlHygieneTests(unittest.TestCase):
    def test_tags_are_balanced(self):
        for name, html in page_texts().items():
            checker = TagBalanceChecker()
            checker.feed(html)
            self.assertIsNone(checker.error, "%s: %s" % (name, checker.error))
            self.assertEqual(checker.stack, [], "%s has unclosed tags: %s" % (name, checker.stack))

    def test_no_inline_style_attributes(self):
        offenders = [name for name, html in page_texts().items() if 'style="' in html]
        self.assertEqual(offenders, [], "inline styles found in: " + ", ".join(offenders))

    def test_no_commented_out_markup(self):
        offenders = [name for name, html in page_texts().items() if "<!-- <" in html]
        self.assertEqual(offenders, [], "commented-out markup in: " + ", ".join(offenders))

    def test_html_language_is_set(self):
        for name, html in page_texts().items():
            self.assertIn('<html lang="en">', html, name)


class MediaHostingTests(unittest.TestCase):
    MEDIA_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
                        ".mp4", ".mov", ".avi", ".mkv")
    BUCKET = "https://storage.googleapis.com/agribridge"
    # Small, stable brand chrome that deliberately stays in the repo.
    CHROME = {
        "assets/images/hero-poster.jpg",
        "assets/logos/agribridge-logo.png",
        "assets/logos/Transparent Logo.png",
        "assets/logos/Favicon Transparent.ico",
    }

    def tracked_files(self):
        result = subprocess.run(["git", "ls-files"], cwd=ROOT,
                                capture_output=True, text=True, check=True)
        return result.stdout.splitlines()

    def test_only_brand_chrome_media_is_tracked(self):
        tracked_media = {
            path for path in self.tracked_files()
            if path.startswith("assets/") and path.lower().endswith(self.MEDIA_EXTENSIONS)
        }
        self.assertEqual(tracked_media, self.CHROME,
                         "tracked media differs from the chrome allowlist: " +
                         ", ".join(sorted(tracked_media ^ self.CHROME)))

    def test_gallery_and_hero_video_are_not_tracked(self):
        tracked = self.tracked_files()
        self.assertFalse(any(p.startswith("assets/gallery/") for p in tracked),
                         "gallery media should not be tracked")
        self.assertFalse(any(p.startswith("assets/videos/") for p in tracked),
                         "video should not be tracked")

    def test_brand_chrome_is_served_locally(self):
        for name, html in page_texts().items():
            self.assertIn('href="assets/logos/Favicon Transparent.ico"', html, name + " favicon")
            self.assertIn('src="assets/logos/agribridge-logo.png"', html, name + " navbar logo")
            self.assertIn('src="assets/logos/Transparent Logo.png"', html, name + " footer logo")

    def test_open_graph_image_is_local(self):
        expected = "https://agribridgerecruitment.com/assets/images/hero-poster.jpg"
        for name, html in page_texts().items():
            for tag in re.findall(r'<meta[^>]*(?:property="og:image"|name="twitter:image")[^>]*>', html):
                self.assertIn(expected, tag, name + ": " + tag)

    def test_gallery_thumbnails_are_on_the_bucket(self):
        html = read("gallery.html")
        grid = html[html.index('id="gallery-items"'):html.index('id="pagination"')]
        sources = re.findall(r'<img src="([^"]+)"', grid)
        self.assertTrue(sources, "gallery grid has no thumbnail images")
        for src in sources:
            self.assertTrue(src.startswith(self.BUCKET + "/thumbs/"),
                            "gallery thumbnail not on bucket: " + src)

    def test_hero_video_is_on_the_bucket(self):
        self.assertIn(self.BUCKET + "/hero.mp4", read("index.html"))

    def test_upload_script_covers_only_external_media(self):
        script = read("scripts/upload-media.sh")
        self.assertIn("assets/gallery/thumbs/*.webp", script)
        self.assertIn("assets/videos/hero.mp4", script)
        self.assertNotIn("hero-poster", script)
        self.assertNotIn("assets/logos", script)


class StyleSheetTests(unittest.TestCase):
    def test_braces_are_balanced(self):
        css = re.sub(r"/\*.*?\*/", "", read("assets/css/styles.css"), flags=re.S)
        self.assertEqual(css.count("{"), css.count("}"))

    def test_no_inline_style_dependent_selectors(self):
        css = read("assets/css/styles.css")
        self.assertNotIn('img[style', css)

    def test_shared_component_classes_are_defined(self):
        css = read("assets/css/styles.css")
        for selector in [".section-cta", ".subsection-title", ".media-cover", ".testimonial-photo"]:
            self.assertIn(selector, css, "missing stylesheet class " + selector)

    def test_stylesheet_uses_local_poster(self):
        css = read("assets/css/styles.css")
        self.assertIn('url("assets/images/hero-poster.jpg")', css)
        self.assertNotIn("storage.googleapis.com", css, "stylesheet should only use local chrome")


class JavaScriptTests(unittest.TestCase):
    EXPECTED_EXPORTS = [
        "runFeature",
        "prefersReducedMotion",
        "forEachNode",
        "clamp",
        "pageCount",
        "pageSlice",
        "nextLightboxIndex",
        "withDestination",
        "eligibleValues",
        "isEligible",
        "gateDecision",
        "initApplicationCards",
        "initFooterEmail",
        "initEligibilityGate",
        "applyGateOutcome",
        "initGateOutcome",
        "initGalleryThumbnails",
        "isVideoSource",
        "initGallery",
        "bootstrap",
    ]

    def test_app_is_an_es_module_with_expected_exports(self):
        app = read("assets/js/app.js")
        for name in self.EXPECTED_EXPORTS:
            self.assertRegex(app, r"export function %s\b" % re.escape(name),
                             "app.js does not export " + name)

    def test_app_has_no_side_effects_on_import(self):
        app = read("assets/js/app.js")
        # The module must not call bootstrap() at top level; main.js does that.
        self.assertNotRegex(app, r"(?m)^bootstrap\(\);", "app.js runs bootstrap on import")
        self.assertNotRegex(app, r"(?m)^document\.addEventListener",
                            "app.js wires DOM listeners on import")

    def test_main_imports_and_bootstraps(self):
        main = read("assets/js/main.js")
        self.assertRegex(main, r"""from ['"]\./app\.js['"]""")
        self.assertIn("bootstrap()", main)

    def test_browser_test_suite_exists(self):
        self.assertTrue((ROOT / "tests/index.html").is_file())

    def test_browser_suite_imports_exist(self):
        app = read("assets/js/app.js")
        exports = set(re.findall(r"export (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)", app))
        harness = read("tests/index.html")
        imported = []
        for names in re.findall(r"import\s*\{([^}]*)\}\s*from", harness):
            imported += [n.strip() for n in names.split(",") if n.strip()]
        self.assertTrue(imported, "browser suite imports nothing")
        missing = [n for n in imported if n not in exports]
        self.assertEqual(missing, [], "browser suite imports missing exports: " + ", ".join(missing))


if __name__ == "__main__":
    unittest.main(verbosity=2)
