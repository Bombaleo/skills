# pipeline-reviewer

Audits the spec pipeline's own design for logical gaps, broken artifact
contracts, missing stop rules, and ambiguous handoffs. Reads all agent files
and the orchestrator skill, then produces a prioritized findings report.
Read-only — modifies nothing. Trigger: "review the pipeline", "audit the
agents", "check for gaps in the pipeline".

**Tools:** Read, Glob, Grep
