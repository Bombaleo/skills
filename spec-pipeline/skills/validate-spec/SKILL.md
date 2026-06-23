---
name: validate-spec
description: >
  Validates a draft specification against gathered project context and emits a structured
  pass/needs-revision verdict. Use when a spec needs to be checked against context — "validate
  this spec", "check the spec against our resources", or when an orchestrator needs a
  machine-readable verdict. Accepts an optional target_scope to restrict checking to one feature
  area. Always emits the verdict as JSON.
---

# Validate spec against context

You are an **evaluator**, not an author. Read the draft spec and project context, judge whether
the spec is consistent with and adequately covered by the context, and report structured JSON so
an orchestrator can decide accept-or-revise.

Do not rewrite the spec. Find and describe problems precisely enough that someone else can fix them.

(Inside the spec pipeline this work is done by the `spec-validator` agent, fanned out per story.
This skill is the standalone, single-shot equivalent — same checks, same output schema.)

## Inputs

- **spec**: what to validate. Either a single spec file, or a split-spec directory in the
  pipeline layout (default `.specwork/`): `main.md` + `glossary.md` + `objects.md` +
  `us_<slug>/story.md` + `us_<slug>/use_cases/uc_*.md` + optionally
  `us_<slug>/user_scenarios/sc_*.md`. With a directory, validate every file present; an absent
  `user_scenarios/` directory is normal (scenarios are opt-in), not a gap.
- **context**: `.specwork/context.md` by default (or a path the caller gives you).
- **target_scope** (optional): e.g. `"Pricing rates"`. When provided, restrict your checks to
  claims within that scope. Ignore spec sections and context evidence clearly outside it. Still
  flag global constraints (auth, rate limits, data formats) if they affect the scope.

If the context file is missing, or no spec file is found at the given location, stop and report
that clearly — do not guess.

## What to check

1. **Contradictions** — spec says X, context says Y (timeout, limit, rule, data type, entity name).
2. **Coverage gaps** — context defines a requirement the spec fails to address; or a structural
   gap in the split layout (story without use cases, AC theme exercised by no use case, missing
   Affected Objects / Object State Changes sections).
3. **Unsupported claims** — spec asserts behavior with no basis in context and not a reasonable
   default; or references an object name or state label not defined in `objects.md`.
4. **Resolvable ambiguities** — spec is vague where context is specific.

Only flag what you can tie to evidence in the context or to a clear internal inconsistency.
No invented requirements. No style feedback.

## Severity

- **high** — contradiction or missing requirement that would cause the wrong thing to be built.
- **medium** — gap or ambiguity likely causing rework, not an outright defect.
- **low** — minor inconsistency.

## Verdict rule

- `"needs_revision"` if any **high** severity, or **≥ 3 medium** severity discrepancies.
- Otherwise `"pass"`.

## Output

Write to `.specwork/validation.json` (or caller-specified path):

```json
{
  "verdict": "pass | needs_revision",
  "summary": "One-paragraph plain-language assessment.",
  "uncovered_requirements": [
    {
      "id": "R1",
      "requirement": "Concise statement of the requirement from context.",
      "evidence": "Where in context it is defined, e.g. resources/api.md:42"
    }
  ],
  "discrepancies": [
    {
      "id": "D1",
      "type": "contradiction | coverage_gap | unsupported_claim | ambiguity",
      "severity": "high | medium | low",
      "spec_location": "us_example_story/story.md § Acceptance Criteria",
      "issue": "What is wrong, stated concretely.",
      "evidence": "Where in context this is grounded, e.g. resources/api.md:42"
    }
  ]
}
```

- `spec_location` always starts with the file path relative to the spec directory (e.g.
  `"us_example_story/use_cases/uc_002_upload.md § Extensions"`) — orchestrators route revisions
  to different workers based on this path.
- `uncovered_requirements` — requirements found in context that the spec does not address at all
  (no section, no mention). Scoped to `target_scope` when provided. Empty array if none.
- `discrepancies` — requirements the spec does address but incorrectly or incompletely.
- No discrepancies and no uncovered requirements → `verdict: "pass"`, both arrays empty.
