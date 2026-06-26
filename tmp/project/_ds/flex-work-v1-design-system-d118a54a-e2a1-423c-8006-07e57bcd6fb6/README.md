# Flex Work V1 — Design System

Design-agent reference for **Dayforce Flex Work (DFW)** — the V1 component library and brand.

> **Status:** Flex Work V1 is being gradually phased out and replaced by the **Everest** design system. Use this system when working on existing Flex Work V1 surfaces or assets; new work may target Everest instead.

---

## What is Flex Work?

**Dayforce Flex Work** is a workforce / shift-staffing marketplace. It connects gig workers ("talent") with shifts and jobs posted by businesses, and gives staffing operators a back-office to manage candidates, bookings, shifts, applicants, agencies and clients.

There are two broad surfaces in the product:

1. **Operator / Booking dashboard (web)** — the B2B back-office where the `@jjj/components` library is used. Heavy on data tables, filters, applicant & client cards, charts (funnel, half-donut, area), maps with radius filters, and saved searches. Audience: recruiters, account managers, booking managers, activation reps.
2. **Worker / Talent login & app** — gig workers sign in (email → password, or phone → SMS) to "access your gigs." The `loginScreen` component covers this multi-variant auth flow.

The copy and the data-table filter vocabulary (candidates, tiers, accreditations, bookings, shifts, agencies, legal entities, MA score, worker score) confirm this is a **staffing/marketplace operations** product, not a generic SaaS app.

### History
The Flex Work V1 design system and component library was **originally designed and developed by Jitjatjo (JJJ) in 2016**, and later **acquired by Dayforce as part of the JJJ International Inc. acquisition in 2025**. Package and code namespaces still reflect the JJJ origin (`@jjj/components`, `@jjj/dash`, GitLab group `jjj-apps`).

---

## Sources

Everything here was reconstructed from the read-only codebase that was provided:

- **`webcore-components/`** — the `@jjj/components` package (`v3.1.2`, "DFW React components implementation").
  - Repo: `git+ssh://git@gitlab.com/jjj-apps/jjj-platform/shared/webcore-components.git`
  - Stack: **React 18**, **Ant Design 4.23.6**, **styled-components 5.3.1** + **styled-theme** (palette via `palette('primary', 0)` etc), Less for the antd theme, Storybook 6.5 for docs.
  - Brand font **Gilroy** bundled at `src/fonts/Gilroy/` (OTF/TTF/WOFF/WOFF2).
  - Logo at `src/assets/dfw_logo.svg` (black "FlexWork" wordmark).

> ⚠️ **Palette caveat.** The actual color palette values live in a separate package, **`@jjj/dash/src/settings/themes`** (imported by the Storybook theme decorator), which was **not** included. The colors in `colors_and_type.css` are reconstructed: values tagged *(observed)* are hard-coded hex pulled straight from component source; the rest are inferred to fit the styled-theme palette indices the components reference. If you can share `@jjj/dash`, the palette can be made exact.

---

## Content Fundamentals

How Flex Work writes copy, drawn from the i18n strings (`src/i18n/translations/en-US.json`) and component labels.

- **Voice — direct, second person, action-first.** Copy speaks to *you* and tells you what to do next: *"Enter your email address to get started with Dayforce Flex Work."*, *"Enter your phone number to access your gigs."*, *"Please enter your username and an email will be sent to you shortly to reset your password."*
- **Warm but plain.** Friendly without being cute: *"Welcome to Flex Work"*, *"Welcome back"*, *"Welcome!"*. Greetings are short; supporting subtitles do the explaining.
- **Casing — Title Case for buttons & labels, sentence case for descriptions.** Buttons: *"Continue with Password"*, *"Continue with SSO"*, *"Continue with SMS"*, *"Reset Password"*, *"Save Search"*. Field labels are Title Case (*"Email address"*, *"Confirm Password"*, *"Mobile Number"*). Helper/subtitle sentences are sentence case and end with a period.
- **Buttons are explicit verbs.** "Continue with X", "Save", "Apply", "Confirm", "Clear", "Remove", "Update", "Submit". Rarely a bare "OK".
- **Operator vocabulary is domain-specific and consistent:** *candidates, applicants, workers, talent, tiers, accreditations, bookings, shifts, backups, pools, agencies, legal entities, markets, districts, sectors, account/booking/sales/activation reps, MA score, worker score, saved searches.* Use these exact terms on operator surfaces.
- **Errors are calm and instructive,** never blaming: *"Oops, Something Went Wrong!"* / *"This view didn't load correctly."* / *"Error retrieving information, please try again later."* / *"Name has already been taken."*
- **No emoji in product copy.** The only glyphs used as UI are a gear *⚙* and *×* on a dev-only debug toggle — not part of the real product surface. Brand/product copy is emoji-free.
- **Numbers & units spelled close to data:** "Within last week", "Within 90 days", "Last {{days}} days", "Miles", "OT" (overtime badge). Interpolation uses `{{var}}` (i18next).

**Vibe:** professional, efficient, operations-grade. It should feel like a tool a busy staffing coordinator trusts — clear labels, confident verbs, no filler.

---

## Visual Foundations

- **Typography.** Two families, used deliberately:
  - **Gilroy** (geometric sans) for **display / headings / titles / buttons**. Weights 300–900 available; UI leans on **500 (medium)**, **600 (semibold)** and **700 (bold)**. Login title is Gilroy 600, 24px, `letter-spacing: -0.4px`.
  - **Helvetica / Helvetica Neue** for **body, data, table cells, chat messages** (explicitly set in `tab.style.js`, `chatMessage.style.js`, button link spans).
  - Type sizes observed: 28 (applicant name), 24 (login title), 20 (card header, bold), 16 (subtitle/large body), 14 (default body/table), 13 (inputs), 12 (meta/addons).
- **Color.** The brand color is **Dayforce Blue `#3067db`**, which carries primary actions, links and accents (and matches the blue "dayforce" wordmark). Neutrals are cool grays trending slightly blue. **Teal `#10aeba`** — the accent the original @jjj V1 code used — is retained as a secondary UI / data accent. Status colors: green `#0ed780` (success/toggle), red `#e13336` (danger), amber `#f6c651`/`#faad14` (warning), blue `#5699ee` (text links). A vivid **data-viz palette** (purple `#962bff`, teal, green, peach, coral, gold) is reserved for charts only — not for chrome.
- **Backgrounds.** Clean and flat — **white and very light cool-gray (`#f4f6f8`) fills**. No gradients, no photographic hero backgrounds, no repeating textures or patterns in the chrome. Imagery appears only as **user content** (applicant/worker avatar photos, map tiles).
- **Corner radii.** Distinctive mix: **pill buttons** (height/2 ≈ 21.5px, or fully round 100px on login), **large 24px rounded cards**, **small 4px** inputs/alerts/small-buttons, and a **3px** chat bubble. The pill button is the most recognizable shape in the system.
- **Cards.** White fill, **1px `#e4e9ee` border**, **24px radius**, **32px 24px padding**, and a soft **double drop shadow** `0 2px 4px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`. A "muted" card variant drops the shadow, goes transparent, and uses a lighter border.
- **Buttons.** Pill shaped, **Gilroy 700**, 41px tall default (30px small, 42px large), generous horizontal padding (33px). *Primary* = solid Dayforce Blue, white text, hover → darker blue. *Secondary* = light-blue fill, blue text. *Text* = blue `#5699ee`, no chrome. *Link* = dark, underlined-on-context. *Danger* = solid red. Disabled = 40% opacity; a "locked" variant shows a 🔒 (FontAwesome lock glyph) badge.
- **Inputs.** 40px tall, **4px radius**, 1px gray border, 13px Helvetica weight 500, white fill. Focus/hover lightens the border and background (no heavy focus ring / box-shadow). Error state fills the field with a light-red tint.
- **Shadows / elevation.** Restrained. Cards use the soft double shadow above; notifications use `1px 2px 6px #e0e0e0`; popovers/dev panels `0 4px 12px rgba(0,0,0,.15)`. No neumorphism, no glow.
- **Borders & dividers.** Hairline 1px in cool grays (`#e4e9ee`, `#e8edf1`). Dashed border available on dashed buttons.
- **Transparency / blur.** Essentially none in the chrome — surfaces are opaque. Overlays rely on standard modal scrims, not backdrop blur.
- **Animation.** Subtle and functional. A shared `transition()` util on interactive elements; login panel slides up + fades (`slideInUp`, 0.3s ease-out, translateY 20px); spinners rotate (`spin`, 2s linear infinite). **No bounces, no playful overshoot, no infinite decorative motion** on content.
- **Hover / press.** Hover = **darker shade** of the same color (primary blue → `#2553b8`), or a color shift to the brand on neutral controls. Press/active = same darker shade. Buttons don't scale on press. Disabled = reduced opacity + `not-allowed` cursor.
- **Layout.** Ant Design's 24-col grid; base **gutter 16px**. Tabs are 60px tall, Helvetica, active tab bold with an underline indicator. Tables are dense, white, hairline-bordered, with saved-search tags and footer pagination ("Showing X to Y of Z entries").
- **Imagery vibe.** Neutral/true-color user photos (avatars), Google Maps tiles for location. No filters, grain, or duotone applied by the brand.

---

## Iconography

See **ICONOGRAPHY** section below.

### ICONOGRAPHY

Flex Work V1 draws on **several icon sources**, in priority order of what appears in the codebase:

- **FontAwesome 5.8.2 (Solid)** is the primary in-product icon set — bundled at `src/fontawesome/5.8.2/`, used via `@fortawesome/react-fontawesome` and via CSS content glyphs (e.g. the locked-button `\f023` lock). Stroke style: solid, filled. This is the dominant icon language.
- **Ant Design icons** (`@ant-design/icons`, `<Icon type="..." />`, `WarningFilled`, etc) come in with antd components — used for control affordances (carets, close ×, plus-circle, warning).
- **Ionicons** — a web-font (`public/fonts/ionicons.*`) is bundled, a legacy holdover; used sparingly.
- **Bespoke brand SVGs** live in `src/assets/` and `src/components/avatar/icons/` and are copied into `assets/` here:
  - `dfw_logo.svg` — the black **"FlexWork" wordmark** (primary logo).
  - `icon-arrow-forward.svg`, `icon-dnd.svg`, `icon-info-gray-small.svg` — small UI glyphs.
  - `logo-jjj-small-white.svg`, `logo-bench-small-white.svg` — small white badge logos overlaid on avatars (org / "bench").
  - `my-team-badge-big.svg` — "My Team Member" avatar badge.
- **Emoji:** not used as product iconography.
- **Unicode glyphs:** only `⚙` and `×` on a dev-only debug control — not part of the real surface.

**Guidance for new artifacts:** prefer **FontAwesome 5 Solid** to match the product. It's CDN-available — link `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css` (5.15.x is the closest CDN match to the bundled 5.8.2; glyph names are stable). Use the bundled brand SVGs from `assets/` for the logo and avatar badges. Do **not** hand-draw icons.

---

## Index / Manifest

Root files:

| File | What it is |
|------|------------|
| `README.md` | This file — context, sources, content + visual foundations, iconography, manifest. |
| `colors_and_type.css` | All design tokens — color CSS vars (primary/grayscale/semantic/status/charts), type scale, radii, shadows, spacing — plus semantic type classes. |
| `fonts/gilroy.css` | `@font-face` declarations for Gilroy (weights 300–900). |
| `fonts/*.woff2` | Gilroy webfont files. |
| `assets/` | Brand logo (`dfw_logo.svg`), avatar badges, UI glyph SVGs, app icons. |
| `preview/` | Design-system tab cards (colors, type, components, etc). |
| `components/` | Live components rebuilt 1:1 from the Figma "Flex Work Web Library": `Topbar.html` (top nav), `Sidebar.html` (side nav — Admin/Manager/Agency), `Footer.html`, `Table.html` (data table), `Section.html` (section card), shared `_nav.css` / `_table.css`. Icons via local FontAwesome Free 7.2.0. |
| `SKILL.md` | Agent Skill manifest for using this system in Claude Code. |
