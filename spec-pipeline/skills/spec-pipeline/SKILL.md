---
name: spec-pipeline
description: >
  Orchestrates a pipeline that turns a Claude Design prototype — a design URL or a local path to a
  downloaded prototype project (default ./project) — into a validated specification document,
  optionally scoped to a named feature area. Use whenever the user provides a prototype URL or a
  local prototype path and wants a spec produced — "build a spec from this prototype", "generate a
  spec from this design", "build a spec from ./project", "turn this prototype into a spec for
  Pricing rates". Triggers even if the user only gives a URL or path and a scope without saying
  "pipeline". Delegates to seven worker subagents:
  context-gatherer, prototype-speccer, object-modeler, then per-story story-speccer (story +
  use cases) and optionally user-scenario-writer, then question-resolver and spec-validator
  (fanned out per story).
---

# Spec pipeline orchestrator

You are the **orchestrator**. Coordinate worker subagents to produce a validated, split
requirements document, then hand it to the user. You sequence and decide; workers do the work.
Keep your context lean — workers return short summaries and file paths, not raw dumps.

## Inputs

Parse from the user's request before starting anything:

- **prototype** (required): the prototype source — either a **Claude Design URL**
  (`https://api.anthropic.com/v1/design/...`) **or** a **local path** to a downloaded prototype
  project (a standalone `.html` export, or a directory containing one plus optional resource docs).
  Resolution: if the user gave a URL, use it; if they gave a path, use it; **if neither, default to
  `./project`** (relative to the directory Claude was launched from). If `./project` does not exist
  and no URL/path was given, **stop and ask** for a URL or a path. The legacy name `prototype_url`
  still works and means the URL form.
- **target_scope** (optional, strongly recommended): the feature area to spec, e.g. `"Pricing rates"`.
  If absent, warn the user the spec will cover the full prototype; then proceed.
- **resources_path** (optional): directory for project context. Default `./resources/`. This is
  the **only** source of project context — the prototype project directory (`./project`) is never
  read for context, only walked as the prototype.
- **feature_slug** (optional): snake_case name for the output directory. Derive from `target_scope`,
  the prototype URL filename, or the local project/HTML name if absent.
- **include_scenarios** (optional, default **false**): narrative user scenarios are opt-in.
  Enable only when the user asks for them ("with scenarios", "user scenarios", "narrative
  journeys", "for stakeholder review"). When disabled, Wave B is skipped entirely.

## Artifact contract

All intermediate work lives in `.specwork/` (create if absent; gitignore it). The prototype walk
and extracted source live in `/tmp/` and are produced **once** for the whole run:

| File | Written by | Read by |
|---|---|---|
| `/tmp/proto-walk/` (walk output) | prototype-speccer | object-modeler, story-speccer, user-scenario-writer |
| `/tmp/proto-src/` (extracted source; may be absent) | prototype-speccer | object-modeler, story-speccer |
| `.specwork/context.md` | context-gatherer | all workers |
| `.specwork/main.md` | prototype-speccer; question-resolver (folds resolved answers) | object-modeler, question-resolver, spec-validator |
| `.specwork/glossary.md` | prototype-speccer | object-modeler, spec-validator |
| `.specwork/stories.json` | prototype-speccer | you (orchestrator), object-modeler |
| `.specwork/objects.md` | object-modeler | story-speccer, user-scenario-writer, spec-validator |
| `.specwork/us_<slug>/story.md` | story-speccer (one per story); question-resolver (folds resolved answers) | question-resolver, spec-validator, user-scenario-writer |
| `.specwork/us_<slug>/use_cases/uc_*.md` + `coverage.json` | story-speccer; question-resolver (folds resolved answers) | spec-validator, user-scenario-writer |
| `.specwork/us_<slug>/user_scenarios/sc_*.md` + `coverage.json` | user-scenario-writer (opt-in) | question-resolver, spec-validator |
| `.specwork/questions.md` | question-resolver | you (orchestrator) |
| `.specwork/validation_us_<slug>.json`, `.specwork/validation_epic.json` | spec-validator (fan-out) | you (orchestrator) |
| `.specwork/validation.json` (merged) | you (orchestrator) | story-speccer & other workers as `revision_feedback` |

Final output: `features/<feature_slug>/requirements/` directory.

## Pipeline

Run in order. Delegate each stage via the Task tool. Wait for each to finish before starting the
next. Confirm the expected output file(s) exist before continuing.

### Stage 0 — Pre-flight (run before anything else)

Before delegating to any worker, run these checks yourself. If any check fails, **stop
immediately** and list every failure in one message — do not start Stage 1 until everything passes.

**Resolve the prototype source first** (this decides which checks below are required):
```bash
# PROTO = the user-provided URL or path; default to ./project when neither was given
PROTO="${PROVIDED:-./project}"
case "$PROTO" in
  http://*|https://*) echo "MODE=url" ;;
  *) if [ -e "$PROTO" ]; then echo "MODE=local PATH=$PROTO"; else echo "MODE=missing PATH=$PROTO"; fi ;;
esac
```
- `MODE=url` → URL mode; `curl` is required (below).
- `MODE=local` → local mode; remember `PROTO` as the prototype project path (a file or directory)
  and carry it to Stage 1 and Stage 2a. `curl` is not needed. This is an **existence check only** —
  whether the directory actually contains a renderable `.html` (vs. unpacked source, vs. nothing
  usable) is decided by prototype-speccer in Stage 2a, which returns local-HTML / source-only or a
  "no prototype HTML" stop.
- `MODE=missing` → no URL was given and the default `./project` does not exist. **Stop and ask:**
  "No prototype found. Provide a Claude Design URL, a path to a standalone .html export or a
  downloaded project directory, or place the project at `./project`."

**Python 3.9+**
```bash
python3 -c "import sys; assert sys.version_info >= (3,9), f'Python 3.9+ required, got {sys.version}'; print('Python OK:', sys.version)"
```

**Chrome** (required to render-walk the prototype — used once, in Stage 2a; only skippable if the
local project has no renderable HTML, which forces source-only mode)
```bash
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null \
  || which google-chrome 2>/dev/null \
  || which chromium 2>/dev/null \
  || echo "CHROME_NOT_FOUND"
```
If the output is `CHROME_NOT_FOUND`, stop and tell the user:
> Chrome is required for prototype walking. Install Google Chrome from https://www.google.com/chrome/
> or set the `CHROME_PATH` environment variable to an existing Chromium binary.

**curl** (URL mode only — skip this check in local mode)
```bash
which curl || echo "CURL_NOT_FOUND"
```
If `CURL_NOT_FOUND` in URL mode, stop: "Install curl (`brew install curl` on macOS)."

**Pipeline scripts**
```bash
find .claude/skills/prototype-to-spec/scripts ~/.claude/skills/prototype-to-spec/scripts \
  -name "walk_prototype.py" 2>/dev/null | head -1
```
If nothing is found, stop: "prototype-to-spec scripts not found. Ensure the pipeline directory
is complete — `walk_prototype.py` must exist under `.claude/skills/prototype-to-spec/scripts/`."

**Create scratch directory**
```bash
mkdir -p .specwork
```

**Spec linter** (optional — used in Stage 5)
```bash
test -f ~/.claude/scripts/spec_lint.py && echo "LINTER_OK" || echo "LINTER_NOT_FOUND"
```
If `LINTER_NOT_FOUND`: continue but note in Stage 5 output that linting was skipped.

Once all checks pass, print a single confirmation line (note the resolved mode):
> Pre-flight OK — Python ✓  Chrome ✓  scripts ✓  source=<url | local:\<path\>> ✓  Starting pipeline…

Then proceed to Stage 1.

### Stage 1 — Gather context

Delegate to **context-gatherer**. Pass: `resources_path`, `target_scope`. It gathers from
`resources_path` only — never from the prototype project directory.
It writes `.specwork/context.md` and returns a one-paragraph summary.

### Stage 2 — Map the prototype once: stories, objects, shared walk + source

Run sequentially — object-modeler reuses the walk output and extracted source that
prototype-speccer produced. **This is the only prototype walk of the entire run** — every
downstream worker reads `/tmp/proto-walk` (and `/tmp/proto-src` when extractable) instead of
walking again.

**Stage 2a — prototype-speccer**: **Before delegating**, print this expectation notice (the walk is
the longest single stage and runs silently — see "A note on silent stages" below):
> ⟳ S2a — walking the prototype in headless Chrome. Each screen is a full page reload (~15–25 s),
> so a scoped walk of N screens takes ~N×20 s. **No live output appears while the worker runs** —
> this is normal; the next update is when Stage 2a completes. (A broad scope = more screens = longer.)

Then pass `prototype` (the resolved URL or local path from Stage 0), `target_scope`.
Produces:
- `/tmp/proto-walk/` — deep walk output (shared; absent in source-only mode)
- `/tmp/proto-src/` — extracted prototype source (shared; may be absent if the HTML is not a
  bundler export — the speccer reports "walk-only mode" in that case)
- `.specwork/main.md` — epic skeleton
- `.specwork/glossary.md` — domain term definitions
- `.specwork/stories.json` — array of `{ slug, name, description, nav_label }`

Confirm the three `.specwork/` files exist and `/tmp/proto-walk/index.json` is non-empty before
continuing. Note whether `/tmp/proto-src/manifest.json` exists — pass that fact downstream. If the
speccer reports **source-only mode** (a local project with no renderable HTML), there is no
`/tmp/proto-walk`; proceed but carry the "UNVERIFIED — generated without rendering" caveat into the
final report, and tell downstream workers `walk_dir` is absent so they rely on `/tmp/proto-src`.

**Stage 2b — object-modeler**: Pass:
- `walk_dir`: `/tmp/proto-walk`
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `context_path`: `.specwork/context.md`
- `main_path`: `.specwork/main.md`
- `glossary_path`: `.specwork/glossary.md`
- `stories_path`: `.specwork/stories.json`

Produces `.specwork/objects.md` — domain object catalog (attributes, states, transitions).
Confirm it exists before continuing.

Read `.specwork/stories.json` to get the story list. Before proceeding, validate it:
- Confirm it is valid JSON and a non-empty array.
- Confirm each entry has `slug`, `name`, `description`, `nav_label`.

If invalid or empty, stop: "`.specwork/stories.json` is malformed or empty — prototype-speccer
may have encountered an error. Check the prototype URL and walk output."

### Stage 2.5 — Deep-dive each user story

**Wave A — story-speccers (parallel, one per story):**
Each story-speccer writes the complete story package — `story.md` AND `use_cases/uc_*.md` with
`use_cases/coverage.json` — from the shared walk and source (it re-walks only as an escape hatch
when the shared walk missed its flow). Pass:
- `story_slug`, `story_name`, `story_description`, `nav_label` (from the story's entry)
- `walk_dir`: `/tmp/proto-walk`
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `prototype` (the resolved URL or local path — escape-hatch re-walk only; the worker normally
  reuses `/tmp/prototype.html`)
- `output_dir`: `.specwork/us_<slug>/`
- `context_path`: `.specwork/context.md`
- `objects_path`: `.specwork/objects.md`

Wait for all to finish. Confirm for every story: `.specwork/us_<slug>/story.md` exists, at least
one `use_cases/uc_*.md` exists, and `use_cases/coverage.json` exists. If a story-speccer reports
it used the escape-hatch re-walk, note its walk dir (`/tmp/story-walk-<slug>`) and pass it to
that story's Wave B writer as an extra walk dir.

**Wave B — user-scenario-writers (parallel, one per story) — ONLY when `include_scenarios` is
true.** When false, skip this wave entirely and mark it "skipped" in the progress block. Pass:
- `story_slug`, `story_name`
- `story_path`: `.specwork/us_<slug>/story.md`
- `use_cases_dir`: `.specwork/us_<slug>/use_cases/`
- `walk_dir`: `/tmp/proto-walk` (plus `/tmp/story-walk-<slug>` when Wave A reported a re-walk)
- `context_path`: `.specwork/context.md`
- `objects_path`: `.specwork/objects.md`
- `output_dir`: `.specwork/us_<slug>/user_scenarios/`

Each writes 2–3 composite journey scenarios that together reference every use case, plus
`coverage.json`. Wait for all to finish. Confirm for every story: at least one `sc_*.md` AND
`user_scenarios/coverage.json` exist.

If any wave produces missing outputs, stop and report which worker failed.

### Stage 2.6 — Resolve open questions

Delegate to **question-resolver**. Pass: `target_scope`.

It reads `.specwork/main.md`, all `us_*/story.md` files, and (when scenarios were written) the
`Gaps Noticed` sections of `us_*/user_scenarios/sc_*.md`; resolves what context covers, folds
answers into the spec files, and writes `.specwork/questions.md`.

**If there are unresolved questions:**
- Present them in the final report, numbered, with their source file.
- Offer to re-run with `user_answers` to incorporate them — but do not wait.
- Proceed immediately so the rest of the pipeline completes.

**If none unresolved**: proceed.

### Stage 3 — Validate (fan-out)

Delegate **spec-validator** in parallel — one per story plus one for the epic:

- For each story: pass `target_scope`, `story_slug: <slug>`,
  `output_path: .specwork/validation_us_<slug>.json`
- Epic: pass `target_scope`, `epic_only: true`,
  `output_path: .specwork/validation_epic.json`

Wait for all to finish, confirm every expected validation file exists, then **merge** into
`.specwork/validation.json`:

```bash
python3 - <<'EOF'
import json, glob
merged = {"verdict": "pass", "summary": "", "uncovered_requirements": [], "discrepancies": []}
parts = sorted(glob.glob(".specwork/validation_*.json"))
summaries = []
for p in parts:
    d = json.load(open(p))
    summaries.append(d.get("summary", ""))
    merged["uncovered_requirements"] += d.get("uncovered_requirements", [])
    merged["discrepancies"] += d.get("discrepancies", [])
for i, r in enumerate(merged["uncovered_requirements"], 1): r["id"] = f"R{i}"
for i, dd in enumerate(merged["discrepancies"], 1): dd["id"] = f"D{i}"
sev = [d["severity"] for d in merged["discrepancies"]]
if "high" in sev or sev.count("medium") >= 3:
    merged["verdict"] = "needs_revision"
merged["summary"] = " ".join(s for s in summaries if s)
json.dump(merged, open(".specwork/validation.json", "w"), indent=2)
print(merged["verdict"], len(merged["discrepancies"]), "discrepancies")
EOF
```

If the merge script exits non-zero, identify the malformed `validation_*.json`, re-delegate the
validator that wrote it once, and retry the merge; if it fails again, stop and report the file.

### Stage 4 — Decide and route revisions

Read `.specwork/validation.json`:

- **`verdict == "pass"`** → proceed to Stage 5.
- **`verdict == "needs_revision"` and fewer than 3 revision rounds done** — route each
  discrepancy to the worker that owns the file named in `spec_location`:

  | `spec_location` starts with | Re-delegate |
  |---|---|
  | `us_<slug>/story.md` or `us_<slug>/use_cases/` | **story-speccer** for that slug |
  | `us_<slug>/user_scenarios/` | **user-scenario-writer** for that slug |
  | `main.md` or `glossary.md` | **prototype-speccer** |
  | `objects.md` | **object-modeler** |

  Pass each worker its normal inputs plus `revision_feedback: .specwork/validation.json`.
  Run the affected workers in parallel where they touch different files.

  **Drift guard:** when a story-speccer revised a story AND `include_scenarios` is true,
  re-delegate the user-scenario-writer for that slug afterwards (its use cases may have
  changed) with `revision_feedback` so it re-aligns the walkthroughs.

  Then re-delegate **spec-validator** — only for the affected scopes (the revised stories'
  `story_slug` runs, and/or the `epic_only` run) — re-merge as in Stage 3, increment the round
  counter, and re-evaluate this stage. **If `objects.md` was revised**, also re-run the
  per-story validators for every story whose Affected Objects reference the changed objects
  (when in doubt, all stories) — story checks validate state labels against `objects.md`, so
  their old verdicts go stale when it changes.
- **Still `"needs_revision"` after 3 rounds** → proceed to Stage 5, note unresolved
  discrepancies in the report. Never loop beyond 3.

### Stage 5 — Publish and lint

```bash
mkdir -p features/<feature_slug>/requirements
cp .specwork/main.md features/<feature_slug>/requirements/main.md
cp .specwork/glossary.md features/<feature_slug>/requirements/glossary.md
cp .specwork/objects.md features/<feature_slug>/requirements/objects.md
```

For each story `<slug>`:
```bash
mkdir -p features/<feature_slug>/requirements/us_<slug>/use_cases
cp .specwork/us_<slug>/story.md features/<feature_slug>/requirements/us_<slug>/story.md
cp .specwork/us_<slug>/use_cases/uc_*.md features/<feature_slug>/requirements/us_<slug>/use_cases/
```

If scenarios were written for the story:
```bash
mkdir -p features/<feature_slug>/requirements/us_<slug>/user_scenarios
cp .specwork/us_<slug>/user_scenarios/sc_*.md features/<feature_slug>/requirements/us_<slug>/user_scenarios/
```

Merge the coverage reports (handles the scenarios-disabled case):
```bash
python3 - <<'EOF'
import json, os
slug = "<slug>"; feature = "<feature_slug>"
uc = json.load(open(f".specwork/us_{slug}/use_cases/coverage.json"))
scp = f".specwork/us_{slug}/user_scenarios/coverage.json"
sc = json.load(open(scp)) if os.path.exists(scp) else None
merged = {
    "story": slug,
    "use_case_coverage_percent": uc["percent"],
    "scenario_coverage_percent": sc["percent"] if sc else None,
    "overall_percent": min(uc["percent"], sc["percent"]) if sc else uc["percent"],
    "iterations": {"use_cases": uc["iterations"], **({"scenarios": sc["iterations"]} if sc else {})},
}
json.dump(merged, open(f"features/{feature}/requirements/us_{slug}/coverage.json", "w"), indent=2)
EOF
```

If a coverage-merge script exits non-zero, identify the malformed coverage.json, re-delegate the
worker that wrote it once, and retry; if it fails again, publish without that story's merged
coverage and note it in the final report.

Run the linter on all produced files — `~/.claude/scripts/spec_lint.py`, falling back to
`pipeline_kit/evals/checks/lint.py` when the former is absent. Include the `user_scenarios`
glob **only when scenario files exist** (an unmatched glob fails the command in zsh):

```bash
python3 <linter_path> --type requirements \
  features/<feature_slug>/requirements/main.md \
  features/<feature_slug>/requirements/glossary.md \
  features/<feature_slug>/requirements/objects.md \
  features/<feature_slug>/requirements/us_*/story.md \
  features/<feature_slug>/requirements/us_*/use_cases/uc_*.md
# + features/<feature_slug>/requirements/us_*/user_scenarios/sc_*.md  (only when scenarios exist)
```

**Linter ERRORs do not block delivery** — include them in the summary so the user knows what
to fix. WARN findings are informational only.

## Progress reporting

Emit a progress block **after every stage completes or a wave finishes**. This lets the user see
where the pipeline is without reading walls of agent output.

### A note on silent stages (set expectations — the pipeline looks frozen but isn't)

Workers run as **Task subagents**: while one runs, you (the orchestrator) are blocked and the
worker produces **no streaming output** to the user — only its final summary when it returns. So
between progress blocks the screen is silent, sometimes for many minutes. This is the single most
common "is it broken?" moment. To defuse it:

- **Before delegating any long-running stage, print a one-line "⟳ in progress" notice** that says
  what is running and roughly how long, and that **no output will appear until it finishes**. The
  long stages are: **Stage 2a** (the prototype walk — minutes, scales with screen count) and each
  **Stage 2.5 wave** (N story workers in parallel, each reading the shared walk). Stage 2a has its
  notice spelled out above; for the waves print e.g. `⟳ S2.5 Wave A — <N> story workers running in
  parallel; no live output until all return`.
- The walker prints per-screen `[NNN]` lines to its own stdout, but as a subagent those do **not**
  reach the user's screen — do not promise live screen-by-screen progress; it is not available
  through the Task boundary.
- If a stage is genuinely stuck (no return for far longer than the estimate), that is a real hang
  (e.g. an orphaned walk) — note that interrupting the session does **not** kill spawned
  `walk_prototype.py`/Chrome; they must be killed separately (`pkill -f walk_prototype.py`).

**Format** (print verbatim, substituting values):

```
━━ pipeline: <feature_slug> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  <s0>  S0   Pre-flight
  <s1>  S1   Context gathered
  <s2a> S2a  Prototype mapped — <N> stories, source <extracted|walk-only>
  <s2b> S2b  Objects catalogued
  <sa>  S2.5 · Wave A  story+use-case writers  <a>/<total> ✓
  <sb>  S2.5 · Wave B  scenario writers        <b>/<total> ✓ | skipped (not requested)
  <s26> S2.6 Questions resolved
  <s3>  S3   Validated  (<verdict>)
  <s4>  S4   Revision rounds: <rounds>
  <s5>  S5   Published
  ──────────────────────────────────────────────────────────────
  [<bar>] <done>/<total> steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stage symbols:** `✓` done  `⟳` in progress  `○` pending  `✗` failed

**Progress bar:** width 32 chars. Use `█` for completed steps, `░` for remaining.
Denominator is always **10** (one per: S0, S1, S2a, S2b, Wave A, Wave B, S2.6, S3, S4, S5).
A skipped Wave B counts as a completed step. Each step counts once even if Wave A has 5
stories — waves are single steps in the bar.

Omit the block only for transient retry messages. Always print it after Stage 5 as the final
summary line.

## Stop rules

- No prototype given AND `./project` does not exist → stop, ask for a Claude Design URL or a path
  to a standalone `.html` / downloaded project directory.
- `prototype-speccer` reports a URL fetch error (URL mode) → stop, surface the error, ask for a
  working URL or a local path. Do not continue.
- `prototype-speccer` reports no prototype HTML at the local path → stop, ask for a standalone
  `.html`, a directory containing one, or a URL. (A local project with unpacked source but no HTML
  degrades to source-only mode rather than stopping — carry the "UNVERIFIED" caveat forward.)
- A worker does not produce its expected output file → stop, report which worker and what failed.
- Validation loop exceeds 3 rounds → publish best-effort, escalate unresolved issues.

## Reporting

When done: the output directory (`features/<feature_slug>/requirements/`), list of files produced,
whether scenarios were included, how many revision rounds it took, any unresolved questions,
unresolved discrepancies, **uncovered requirements** (from the merged validation — context
requirements the spec never addressed), and lint results. One short paragraph plus those lists —
the user can open the files for details.
