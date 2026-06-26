/* =====================================================================
   Flex Work API · spec extension (part 8 — endpoint detail prose)
   ---------------------------------------------------------------------
   Hand-tuned `detail` paragraphs for every endpoint that didn't already
   carry one. Loaded after ext-7 so the final group / tag / rename layout
   is in place; this file only mutates ep.detail (additive — never
   overwrites an existing detail) and only fixes a small number of
   summary strings that referenced the legacy sourcingChannel enum.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  /* ------ Summary touch-ups for the engagementType collapse --------- */
  // Two summary strings still referenced the deleted sourcingChannel
  // field. Rewrite in place so endpoint pages don't contradict the
  // schema.
  var summaryFixes = {
    req_create:
      "Creates a requisition. Required fields vary by engagementType — frontline_shift and frontline_assignment require headcount, payRate, and a job; sow requires totalValue and at least one milestone; contractor requires a worker reference.",
    req_update:
      "Partial update. Only fields included in the body are changed. A handful of fields (engagementType, jobId, locationId) become immutable once the requisition moves out of draft.",
    sup_contract:
      "Snapshot of the supplier's currently-active master contract — markup percentage, payment terms, billing cadence, currency, and effective dates."
  };
  Object.keys(summaryFixes).forEach(function (id) {
    var ep = spec.paths.find(function (p) { return p.id === id; });
    if (ep) ep.summary = summaryFixes[id];
  });

  /* ------ Detail prose, one entry per endpoint ---------------------- */
  // Style guide: 2-3 sentences, second person, sentence case, anchored
  // to specific platform behavior (immutability rules, retry behavior,
  // related endpoints, who's allowed to call it). Skip filler. No
  // marketing language. Never end with an exclamation mark.
  var D = {

    /* ===== Auth ===================================================== */
    auth_revoke:
      "Revocation is immediate for access tokens and propagates through the bearer-cache within seconds; refresh tokens are invalidated synchronously. Useful for sign-out flows and for the kill-switch when a client suspects credential leakage. Repeated calls against an already-revoked token still return 204 — clients can safely retry on network errors without worrying about token state.",
    auth_sso_callback:
      "Validates the assertion against the IdP's signing certificate, replays the state nonce against the value handed back from /auth/sso/initiate, and ensures the assertion's audience matches the platform. Returns the same AuthResponse shape /auth/login returns on the password path, so downstream SDK code can be shared. Replayed callbacks (same state, same assertion) return 401 — the nonce is single-use.",
    auth_mfa_verify:
      "Pair with the mfaToken returned by /auth/login's 202 response. TOTP and SMS codes are accepted within a 30-second drift window; WebAuthn assertions are validated against the user's registered authenticators. Backup codes are single-use — once consumed they are removed from the user's reserve list and won't authenticate again.",
    auth_reset_pw:
      "Always returns 202 — the platform deliberately doesn't disclose whether the address matches an account, to thwart enumeration attacks. The reset email contains a one-time link valid for 30 minutes. Subsequent reset requests for the same address within 60 seconds are throttled silently to avoid email spam, but still return 202.",

    /* ===== Requisitions ============================================ */
    req_get:
      "Returns the full requisition envelope plus its embedded distribution list (suppliers it has been routed to and their state) and fill state (count of confirmed workers vs headcount target). Use /requisitions/{id}/audit for the change history rather than re-fetching this endpoint repeatedly.",
    req_update:
      "Patch-style update — omitted fields are left alone, explicit nulls clear the field. engagementType, jobId, and locationId are frozen the moment a requisition leaves draft to keep downstream distribution and pricing rules deterministic. Rate fields (payRate, billRate) remain editable but only affect engagements opened after the change.",
    req_cancel:
      "Moves the requisition to the cancelled state — open shifts are released back to the schedule pool, pending candidate submittals are auto-rejected with a system reason, and active workers are sent a notice via their configured channel. The record itself is retained for audit; spend already invoiced is preserved.",
    req_audit:
      "Returns every state transition, field-level change, and lifecycle event applied to one requisition, oldest first. Each entry carries the actor (user or workflow), the timestamp, and the before/after payload for the changed fields. Use this as the primary debugging surface when a requisition has unexpectedly closed or stalled.",

    /* ===== Workers ================================================= */
    wrk_list:
      "Default filters scope to workers with at least one active engagement; pass status=all to see every worker the org has ever engaged. Filter parameters compose with AND semantics. For supplier-scoped reads (an agency seeing only their submitted workers) the response is automatically filtered by the caller's principal scope — no extra parameter required.",
    wrk_get:
      "Returns the worker's full profile, currently-active engagement (one at a time), credential summary, and tenure rollup. Personally-identifying fields (full SSN, full bank account) are masked unless the caller holds the workers.pii.read scope. Stale-while-revalidate caching is safe up to 60 seconds.",
    wrk_assign:
      "The primary way to attach a worker to a requisition outside the supplier-submittal flow. Validates that the worker is qualified for the job (credentials, talent pool eligibility), that the engagement type matches, and that no scheduling conflict exists. Returns 409 with a structured conflict envelope if any of those fail — fix the conflicts and retry.",
    wrk_credentials:
      "Returns every credential record ever issued to one worker — active, expired, revoked, and pending verification. Pair with /worker-credentials/{id}:verify to manually attest a credential and with /compliance-checks:run to trigger a background re-check.",
    wrk_tenure:
      "Returns aggregate tenure across every requisition the worker has filled, including total hours worked, distinct engagements, longest continuous run, and rehire eligibility. Drives the tenure badges that show on candidate cards during supplier selection.",
    wrk_timeline:
      "Chronological merge of placements, shift starts and ends, credential events, feedback rows, and manager notes. Each entry carries a discriminator field so consumers can render heterogeneous events with one component. Returned newest first; use the `before` cursor to page backwards.",
    wrk_availability_set:
      "Replaces the worker's full weekly availability set — the call is destructive; days you don't include are cleared. Times are interpreted in the worker's home-location timezone. Schedule eligibility recomputes immediately for any open shifts the worker is being considered for.",

    /* ===== Suppliers =============================================== */
    sup_list:
      "Returns every supplier currently attached to the org, including those whose master contract has expired but still has open invoices. Filter by type (agency / eor / independent / sow) or by status (active / paused / offboarding) — the two enums combine.",
    sup_get:
      "Returns the supplier envelope with contract summary inlined (markup, payment terms, billing cadence, currency, certifications). Use /suppliers/{id}/contracts for the full revision history and /suppliers/{id}/scorecard for performance metrics.",
    sup_scorecard:
      "Rolling scorecard with fill rate, time-to-fill, retention, and quality scores computed over the last 90 days by default. Override the window with ?days=N. Drives the supplier sort order on the distribution surface and the quartile colors on the suppliers list.",

    /* ===== Timesheets ============================================== */
    ts_list:
      "Returns timesheets the caller can see. Manager principals get every timesheet for the workers under their org-unit; worker principals get only their own; supplier principals get every timesheet for their submitted workers. Filter by status (draft / submitted / approved / rejected / paid) or by payPeriod for narrower scopes.",
    ts_reject:
      "Moves a submitted timesheet back to draft, attaches the rejection reason and rejecting user to the audit trail, and sends the worker a push + email notification with the reason text. The worker can correct and resubmit; manager re-approval routes back through the original approval chain.",
    ts_submit:
      "Worker-side. Submits a draft (or in-progress) timesheet for approval. Validates that every shift in the period is either closed or has been manually accounted for. Triggers the approval workflow attached to the worker's engagement — most orgs default to manager approval followed by a finance review on totals over a threshold.",
    ts_update:
      "Partial update of entries on a draft timesheet — never on an approved one. To change an approved timesheet, file a correction request (which routes through the original approver) or post an adjustment (which audits separately and exports on the next payroll run).",
    ts_adjustment:
      "Post-approval correction. The original timesheet stays approved and immutable; the adjustment is its own row with a sign (positive or negative hours, positive or negative dollars) and links back. Picked up by the next /timesheets:export run automatically.",
    ts_export:
      "Bundles every approved timesheet matching the supplied filters into a payroll-ready export file (CSV or the platform's PXG format). Returns an Operation handle; poll /operations/{id} or subscribe to the operation.completed webhook for the resultUrl. Once a timesheet is exported it is locked from further adjustment without a reopen.",
    ts_correction_list:
      "Returns every correction request filed against a single approved timesheet, oldest first, including resolved ones. The resolution state is on each row — open, accepted (with the resulting adjustment id), or rejected (with reason).",
    ts_correction_create:
      "Worker-side. Routes the correction to the manager who originally approved the timesheet. Accepting it produces an adjustment row on the original timesheet; rejecting it closes the request with the manager's stated reason and a notification to the worker.",
    ts_correction_resolve:
      "Manager-side. Pass action=accept to mint the adjustment automatically (the platform computes the delta), or action=reject with a required reason that's shown to the worker. Either decision is final — corrections do not loop.",

    /* ===== Schedules =============================================== */
    sch_list_shifts:
      "Returns shifts across every schedule the caller has visibility into, with filters for location, jobId, status, and a from/to window. Returns up to 500 rows per page; use the open-shifts convenience endpoint when you specifically want the unfilled subset.",
    sch_publish:
      "Atomically moves every draft shift in the schedule to published. Worker notifications fan out in parallel via the channels each worker has configured. Republishing an already-published schedule is a no-op for unchanged shifts; modified shifts trigger an update notice with a diff.",
    sch_swap:
      "Worker A initiates; worker B must accept via /shifts/{id}:swap-accept (rendered as a notification action) before the assignment flips. Both workers must be qualified for the job; if either has a conflict on the swapped shift the swap fails on accept with 409. Either party can cancel the proposal up until acceptance.",
    sch_list:
      "Returns parent schedules — the weekly containers — not the underlying shifts. Each row carries a roll-up of shift count by status. For the actual shifts use /shifts (filterable) or /schedules/{id}/shifts (scoped to one schedule).",
    sch_create:
      "Creates an empty draft schedule scoped to a location and a week (specified by the Monday-of-week date). Schedule templates can pre-populate shifts; pass templateId to apply one at creation time. Publishing happens via /schedules/{id}:publish.",
    sch_shift_create:
      "Adds a single shift to a schedule. Pass workerId to assign immediately; omit it for an open shift the schedule will offer up via the pickup flow. Conflicts (worker already assigned in this window, time-off overlap, missing credential) are surfaced as 409 with a structured reason.",
    sch_shift_assign:
      "Direct assignment by a manager — bypasses the worker-side pickup flow. Validates eligibility (qualified job, no time-off conflict, credentials current) before persisting. Returns 409 on any eligibility failure with a structured reasons array so clients can render a fix-up screen.",
    sch_shift_drop:
      "Worker-side. Releases an assigned shift back into the open pool, applying the drop policy attached to the schedule — most orgs require N hours of notice and impose a soft cap on monthly drops. A worker over the cap receives 422 with a policy-violation envelope.",
    sch_shift_pickup:
      "Worker-side. Claims an open shift. Eligibility is evaluated atomically against current credentials, scheduling conflicts, and any pickup-cap rules. Multiple simultaneous pickups for the same shift are resolved on a first-write-wins basis at the database level — losers receive 409.",
    open_shifts:
      "Convenience filter on /shifts. Equivalent to /shifts?status=open&sort=startsAt:asc. Cached at the edge with a 15-second TTL — fine for schedule-board polling, not for clocking decisions.",

    /* ===== Invoices ================================================ */
    inv_list:
      "Paginated invoice list. Filter by supplierId, period (start/end), or status (issued / approved / disputed / paid / void). Supplier principals see only their own invoices; finance principals see every invoice on the org.",
    inv_get:
      "Returns the invoice header with its embedded line items, dispute history, applied tax rules, and payment state. For large invoices (>500 lines) use /invoices/{id}/lines with pagination instead — the embedded lines on this endpoint are capped at 100.",
    inv_lines:
      "Standalone, paginated read of the line items on an invoice. Useful when the parent envelope is already cached or when line counts exceed the embedded limit on /invoices/{id}. Each line carries a back-reference to the timesheet, milestone, or expense it was derived from.",
    inv_dispute:
      "Opens a dispute, halting the AP payment workflow for the invoice. Pass a reason string and an optional disputedAmount (if you only contest part of the invoice). Notification to the supplier is automatic. Resolution happens via /invoices/{id}:resolve-dispute.",
    inv_pay:
      "Typically called by the AP integration's payment-completed webhook, not by humans. Idempotent on the invoiceId — replaying the same call once the invoice is already paid is a no-op. The paidAt and reference fields are required so audit can reconcile against the bank statement.",

    /* ===== Locations =============================================== */
    loc_list:
      "Returns every worksite attached to the org, including archived ones (filter with ?archived=false to hide them). Locations carry their own timezone, tax jurisdiction, and operating-hours pattern; each requisition and schedule is anchored to exactly one location.",
    loc_create:
      "Creates a new worksite. The parent org-unit determines which approval chain, distribution rule set, and pricing rule scope the location inherits. Timezone is required — schedules at the location are evaluated in this zone, never the caller's.",
    loc_get:
      "Returns the location envelope with its parent chain, timezone, tax jurisdiction, operating-hours pattern, and any active geofence config. Pair with /locations/{id}/geofence for the geofence detail used by the clocking endpoints.",
    loc_update:
      "Patch-style. Changing timezone is heavyweight — every active schedule at the site is re-evaluated in the new zone, and any in-flight shifts get their start/end times re-rendered for downstream consumers. Changes are audit-logged.",
    loc_delete:
      "Soft archive. The location is hidden from new-requisition pickers but stays readable so historic data (timesheets, invoices, audit) still resolves. Returns 409 if any requisitions, schedules, or workers are still anchored to the location — close them first or move them.",

    /* ===== Jobs ==================================================== */
    jobs_list:
      "Returns the catalog the org has configured, with active jobs first. Jobs in frontline and professional categories are returned together; filter with ?category=frontline if you specifically need the frontline subset (the typical case for shift creation).",
    jobs_get:
      "Returns the job envelope including its default pay band (frontline only), required credentials, and category-level metadata. The credentials array drives eligibility checks when assigning workers to shifts on requisitions opened against this job.",
    jobs_delete:
      "Soft archive — existing requisitions, schedules, and engagements that reference the job continue to work; the job disappears from new-requisition pickers and the shift-creation form. To resurrect, PATCH the job with archived=false.",

    /* ===== Workflows =============================================== */
    wf_list:
      "Returns the workflow definitions installed on the org — both platform-supplied (canonical approval chains for requisitions, timesheets, expenses) and org-custom. Each carries a triggers array (event types that fan in) and a steps array.",
    wf_run:
      "Synchronous trigger for a workflow that doesn't have an event-based trigger registered. Pass the workflowId and the subjectId of the entity to run against. The response carries the run record; for workflows with long-running approval steps, poll /workflow-runs/{id} or subscribe to workflow.completed.",

    /* ===== Budgets ================================================= */
    bg_list:
      "Returns org budgets, with plan / committed / realized rolled up. Filter by fiscalYear or departmentId. Committed and realized are computed from in-flight engagements and paid invoices respectively — they're never set directly.",
    bg_get:
      "Returns one budget with its rollup matrix by category, location, and engagement type. Use this as the data source for budget burn-down charts and forecast pacing — the response includes the pacing trajectory the budget would land on if current spend velocity persists.",
    bg_update:
      "Patch-style update of the planned amount or tag metadata. Both committed and realized are computed fields — attempts to set them return 422. Plan adjustments are audit-logged and require the budgets.write scope.",
    bg_alerts:
      "Returns the spend-threshold alerts (80% / 95% / 100% by default) and which have already fired with the firedAt timestamp. Configure the threshold set on the budget itself; alert recipients fan out via the configured channels at the moment of firing.",

    /* ===== Webhooks (incl. former events, cdc, encryption) ========= */
    hk_list:
      "Returns the org's webhook subscriptions including their target URL, subscribed event types, signing-secret last-rotated timestamp, and last-delivery summary. Secrets are never returned — they're write-only.",
    hk_delete:
      "Removes a subscription. In-flight deliveries already queued continue to attempt for their full retry budget (up to 24 hours) and then drop; new events stop being queued immediately.",
    events_list:
      "Returns every event type a webhook subscription can listen for, grouped by resource. Each row carries the event name (e.g. requisition.created), a one-line description, and a sample payload. Use this to render the event-picker UI on a webhook-config screen.",
    hk_deliveries:
      "Returns recent delivery attempts for one subscription — last 7 days by default — including each attempt's HTTP status code, latency, response body excerpt, and retry generation. Critical for debugging when a consumer is missing events. Failed deliveries can be re-fired via /webhooks/{id}/deliveries/{deliveryId}:redeliver.",
    hk_rotate_secret:
      "Generates a new signing secret and returns it in the response — capture it on the call. The previous secret remains valid for 24 hours so consumers can roll over without dropping deliveries. After the overlap, the old secret stops verifying.",
    wh_enc_rotate:
      "For envelope-encrypted webhooks. Registers a new public key (RSA-OAEP-256 or X25519) and keeps the previous key valid for a 24-hour overlap. Each delivery carries the keyId it was encrypted under so consumers can route to the right private key.",

    /* ===== Organization (incl. former org-tree) ==================== */
    org_get:
      "Returns the org's profile — name, industry, country, default locale and currency, and configured surfaces. This is the read most home-page renderers issue on session bootstrap.",
    org_update:
      "Patch-style update. Name and industry changes are unrestricted; country changes require admin scope and trigger a downstream recompute of payroll, tax, and compliance defaults across every engagement. Audit-logged.",
    org_settings_get:
      "Runtime configuration — which engagement types are enabled, which supplier types are allowed, the org's industry profile, default locale and currency. Most UI bootstrap reads pull this once and cache it for the session.",
    org_settings_update:
      "Patch-style. Most settings are audit-logged and require the org.admin role. Disabling an engagement type that is in active use is allowed but doesn't affect in-flight engagements — they continue to operate until they close naturally.",
    org_flags_get:
      "Returns the org's feature flags with their currently-resolved values, including platform-wide rollouts. Driven by Flex Work's flag service; values can change mid-session, but most callers cache for the lifetime of the session.",
    org_flag_update:
      "Toggles one flag for the org. Effective at the next session refresh for most flags; a handful of high-risk flags (aiChat, contractorClassification) take a 5-minute propagation delay before any client sees the new value. Audit-logged.",
    ref_countries:
      "Returns every country the platform supports for legal entities, payroll, and tax. Each row carries the ISO 3166-1 alpha-2 code, display name, default currency, supported payroll providers, and a per-country compliance summary.",
    ref_locales:
      "Returns the locales the platform UI is translated into. Each row carries the BCP 47 tag, English name, native name, and translation completeness percentage. Use to populate locale pickers on the user-profile screen.",
    ref_industries:
      "Returns the industry presets shipped with the platform — healthcare, hospitality, energy, manufacturing, retail. Each preset bundles default job catalogs, credential types, and approval flows. Selecting a preset at org-onboarding time accelerates configuration.",
    orgtree_list:
      "Flat list of org units by default. Pass ?tree=true for the hierarchical representation (each row carrying its children inline). The flat shape is preferred for table renderers; the tree shape for sidebars.",
    orgtree_create:
      "Adds a node to the org tree. Parent must already exist; circular references are rejected. Newly-created nodes inherit the parent's approval chain and distribution rule set; override by setting them on this node after creation.",
    orgtree_get:
      "Returns one node with its parent chain (root → ... → self) and immediate children. The parent chain is precomputed so consumers can render a breadcrumb without additional reads.",
    orgtree_update:
      "Patch-style. Re-parenting a node by changing parentId moves its entire subtree along with it. The move is transactional and audit-logged; any approval chains or distribution rules attached to the moved subtree continue to apply.",
    orgtree_delete:
      "Deletes a leaf node. Returns 409 if the node has children or has locations / engagements anchored to it. To remove a non-leaf node, re-parent or delete its descendants first.",

    /* ===== Users =================================================== */
    users_list:
      "Paginated list of internal users on the org. Includes invited (not yet accepted), active, and deactivated by default; filter with ?status= to narrow. Workers are not users — they live under /workers.",
    users_invite:
      "Creates a user record in the invited state, attaches the supplied role, and sends an invitation email with a one-time signup link valid for 7 days. The user appears immediately on /users; until they accept, their lastSeenAt is null.",
    users_get:
      "Returns one user envelope — name, email, role, scope, last seen, status. The email field is masked for callers outside the user's home org-unit unless they hold the users.pii.read scope.",
    users_update:
      "Patch-style. Most commonly used to change role or scope. Changing a user's role takes effect at the next request; the user does NOT need to re-authenticate. Audit-logged.",
    users_deactivate:
      "Soft delete. All active sessions for the user are revoked synchronously, their email is reserved (so the address can't be re-invited without admin override), and their record is retained for audit. Reactivate via PATCH with status=active.",
    users_resend:
      "Sends a fresh invitation email and resets the link's 7-day expiry. Idempotent — multiple calls within 60 seconds are throttled but return 202 so callers can fire the action without checking state first.",

    /* ===== Me ====================================================== */
    users_me:
      "Returns the user record for the bearer token's principal. The single most common bootstrap call — most clients issue it on session start. Cached for the session lifetime is safe; clients listening for live role changes should subscribe to user.role-changed.",
    me_prefs_get:
      "Returns the calling user's UI preferences — theme, density, locale, timezone, week-start, last-used home tab. Defaults are seeded from the org's defaults on first sign-in.",
    me_prefs_set:
      "Patch-style update of UI preferences. Changes take effect immediately for the calling session; other sessions of the same user pick up the new preferences on their next page navigation.",

    /* ===== Roles =================================================== */
    roles_list:
      "Returns both built-in (Admin, Manager, Approver, Recruiter, Supplier, Worker) and org-custom roles. Each row carries its permission bundle, member count, and whether it can be edited.",
    roles_create:
      "Creates a custom role. Pick from the permission catalog at /permissions; built-in roles cannot be cloned by id but can be used as a starting point by reading their permission bundle and POSTing it under a new name.",
    roles_update:
      "Patch-style. Built-in roles always return 403 — they are managed by the platform. Custom-role updates are audit-logged and take effect at each member's next request.",
    roles_delete:
      "Permanently removes a custom role. Returns 409 if any users still hold the role — reassign or deactivate them first. Built-in roles always return 403.",
    permissions_list:
      "Returns the full catalog of permissions the platform recognizes, with human-readable descriptions and the resource each governs. Use to render permission-picker UIs when authoring a custom role.",

    /* ===== Config ================================================== */
    cfg_engtypes_get:
      "Returns the engagement types currently enabled for the org, with display labels and the per-type required-field set. Drives the engagement-type filter on lists and the engagement picker at requisition intake.",
    cfg_engtypes_set:
      "Bulk replace. Pass the full set of enabled engagement types — anything not in the request is disabled. Disabling a type currently in use is allowed but doesn't affect in-flight engagements.",
    cfg_suptypes_get:
      "Returns enabled supplier types (Agency, EOR, Independent Contractor, SOW vendor) for the org. Drives the supplier-type filter and the supplier-onboarding flow.",
    cfg_suptypes_set:
      "Bulk replace of enabled supplier types. Disabling a type that's in use is allowed but no new suppliers of that type can be onboarded until it's re-enabled.",
    cfg_jobcats_get:
      "Returns enabled job-catalog categories — frontline, professional, or both. Most orgs enable just one; mixed orgs (e.g. healthcare with both clinical frontline and IT professional) enable both.",
    cfg_jobcats_set:
      "Bulk replace. Disabling a category in active use hides its jobs from new-requisition pickers but keeps existing engagements working until they close.",
    cfg_workertypes_set:
      "Bulk replace of the worker-type configuration. Changes only take effect for new engagements — workers already engaged keep their assigned worker type for the life of that engagement.",

    /* ===== Notifications =========================================== */
    notif_list:
      "Returns the calling user's inbox, newest first, capped at 200 entries. Includes read and unread by default; filter with ?status=unread for a count-only call (use the X-Unread-Count response header rather than counting the array).",
    notif_mark_read:
      "Marks one notification read and decrements the unread counter. Idempotent — re-marking an already-read notification is a no-op. The change is reflected immediately for other sessions of the same user.",
    notif_mark_all_read:
      "Bulk-marks every unread notification in the calling user's inbox. Returns the resulting unread count (always 0) in the response header. Useful as the action on a clear-all button.",
    notif_prefs_get:
      "Returns the user's per-channel notification preferences — in-app, email, push — grouped by event category. Each event-category × channel cell is a boolean.",
    notif_prefs_set:
      "Partial update of notification preferences. Changes take effect for events fired after the call; queued or in-flight notifications continue to honor the pre-change preferences.",

    /* ===== Requisition templates =================================== */
    tpl_list:
      "Returns saved templates available at intake. Most orgs maintain templates per location × job pair for high-frequency requisitions; the list is filterable by both. Each template carries its parameter set and (optionally) an RRULE recurrence schedule.",
    tpl_create:
      "Saves a requisition shape as a template. Optional schedule (RRULE) makes it auto-fire on a cadence — daily, weekly, every-other-Monday — useful for recurring shift-need patterns. Templates with schedules go through /requisition-templates/{id}:pause when you need to suppress them temporarily.",
    tpl_get:
      "Returns the template envelope — its parameter values, its schedule (if any), the last-fired timestamp, and the count of requisitions ever spawned from it.",
    tpl_update:
      "Patch-style update. Editing a template never affects requisitions already spawned from it — only future fires. Pause / resume the recurrence via the action endpoints rather than patching the schedule field directly.",
    tpl_delete:
      "Permanently removes a template. Requisitions already created from it are unaffected. Templates with active recurrences must be paused first — DELETE on an active recurrence returns 409 to prevent accidental loss of scheduled fires.",
    tpl_schedule_get:
      "Returns the RRULE recurrence attached to a template, its next-fire timestamp, the timezone the rule is evaluated in, and the count of fires so far.",
    tpl_pause:
      "Pauses the template's recurrence. No new requisitions fire until /resume; the next-fire timestamp is preserved. Requisitions already open are unaffected. Use this for pause-on-vacation scenarios where you don't want to forget to re-enable.",
    tpl_resume:
      "Resumes a paused recurrence. The next fire time is recomputed from the original RRULE, skipping any missed dates while paused — the platform does not backfill missed fires. Returns the updated next-fire timestamp.",

    /* ===== Candidates ============================================== */
    cand_list:
      "Returns submittals across requisitions. Manager principals see every submittal under their org-unit; supplier principals see only their own submitted candidates. Filter by stage to scope to the screening / interview / offer subset.",
    cand_submit:
      "Supplier-side. Submits a candidate against an open requisition. The candidate is created if their email doesn't match an existing worker; otherwise the existing worker record is reused (tenure carries forward). Distribution-rule eligibility is checked before persisting; ineligible submittals return 422.",
    cand_get:
      "Returns one submittal envelope, including the candidate's resume/profile, all stage transitions to date, feedback rows, and the requisition snapshot at submission time.",
    cand_advance:
      "Moves a candidate forward through the configured pipeline (submitted → screening → interview → offer → hired). Each transition is logged with the actor and a free-text note. Bypass stages by passing the targetStage explicitly — useful for direct-hire flows.",
    cand_hire:
      "Converts a submittal into a hired worker. Creates or reuses the worker record, opens an engagement against the requisition, copies start/end dates and rate from the requisition (or accepts overrides in the body), and kicks off the onboarding workflow. Returns the new worker and engagement ids.",
    cand_reject:
      "Rejects a submittal at any stage. The supplier sees the reason on their dashboard. Rejected candidates can still be re-submitted to other requisitions — rejection is per-requisition, not per-candidate.",

    /* ===== SOW ===================================================== */
    sow_list:
      "Paginated list of Statements of Work, scoped to ones the caller has visibility into. Filter by supplierId, status (draft / active / completed / cancelled), or by the date a milestone is due. Supplier principals see only their own SOWs.",
    sow_create:
      "Creates a SOW in draft state. The totalValue, scope description, and engagement window are required; milestones can be added in the same call by including a milestones array, or separately via /sows/{id}/milestones. Draft SOWs are mutable until /sows/{id}:activate is called.",
    sow_get:
      "Returns the SOW envelope with its milestones inlined. Each milestone carries its due date, value, current state, and (if completed) the approval reference. For very large milestone lists use /sows/{id}/milestones with pagination instead.",
    sow_update:
      "Patch-style. The set of mutable fields shrinks the moment a SOW transitions out of draft — totalValue, supplierId, and the engagement window all become immutable once active. Scope and milestone changes require a contract amendment, not a patch.",
    sow_milestones_list:
      "Returns the milestone schedule for one SOW, in due-date order. Each row carries its current state (planned / in_progress / completed / approved / paid), value, and any blocker reason.",
    sow_milestones_create:
      "Appends a milestone to a SOW. The sum of milestone values cannot exceed the SOW's totalValue — over-allocation returns 422. Order is by dueAt; out-of-order inserts are allowed and the list is re-sorted on read.",
    sow_milestone_complete:
      "Supplier-side. Marks a milestone complete and queues it for buyer approval. Attach deliverable evidence (file references via the attachments tag) before marking complete — most buyer SLAs require evidence.",
    sow_milestone_approve:
      "Buyer-side. Approves a completed milestone, releases the milestone's value to invoice generation, and (in orgs with auto-invoice on) fires the invoice creation workflow. Audit-logged with the approving user. Rejection routes back through /milestones/{id}:reject.",

    /* ===== Contractors ============================================= */
    ctr_list:
      "Returns the subset of workers engaged as 1099 independent contractors. Includes both active and offboarded contractors; pass ?status=active to narrow. For all workers regardless of engagement type, use /workers.",
    ctr_onboard:
      "Starts the contractor onboarding flow. Creates a worker record, queues the W-9 tax form via the signing surface, opens a /banking record for direct-deposit collection, and runs the classification test suite to confirm 1099 status. Returns 202 with an Operation handle.",
    ctr_classification_get:
      "Returns the latest classification result — IRS 20-factor test, ABC test (where applicable by state), exclusivity flag, tenure flag, and an overall risk score. Re-run via /contractors/{id}/classification:evaluate when underlying engagement facts change.",
    ctr_classification_run:
      "Runs the classification test suite against the contractor's current engagement facts and persists the new result. Idempotent within a 24-hour window — repeated calls reuse the cached result unless force=true is passed.",

    /* ===== Credentials ============================================= */
    cred_list:
      "Returns the credential catalog — definitions the org tracks. Each definition carries a name, optional expiry window (in days), and whether it requires document upload for issuance.",
    cred_create:
      "Adds a credential type to the catalog. Most orgs seed their catalog from the industry preset at org-onboarding and extend it from there. New credentials become available to workers on their next worker-credentials POST.",
    wcred_list:
      "Issued worker credentials, filterable by worker, credential type, or expiry window (?expiringWithinDays=N). Includes pending, verified, expired, and revoked states.",
    wcred_create:
      "Records that a worker has earned a credential. Starts in `pending` until /worker-credentials/{id}:verify is called manually OR an automated verification source attests it. Pending credentials don't satisfy job-eligibility checks for shift assignment.",
    wcred_verify:
      "Manually attests a credential, attaching the verifying user, the source (HR, supplier, automated check), and an optional reference (license number, certificate id). Verified credentials immediately satisfy job-eligibility checks.",
    compliance_run:
      "Triggers a compliance check — I-9, OSHA-10, background, drug screen, depending on the policy attached to the worker's engagement. Returns 202 with an Operation handle. Results post to /workers/{id}/credentials when complete and fire the compliance.completed event.",

    /* ===== Distribution ============================================ */
    dist_list:
      "Returns distribution rules that control how requisitions fan out to suppliers. Rules can scope at three levels — global org, org-unit, or location — with the most-specific scope winning. Each rule names a strategy (e.g. broadcast / waterfall / round-robin) and a supplier set.",
    dist_create:
      "Creates a scoped rule. Pass scope=global/orgUnit/location with the matching scopeId. Multiple rules within the same scope return 409 — to override a parent-scope rule, create it at a more-specific scope rather than editing the parent.",
    dist_update:
      "Patch-style update of a rule's strategy or supplier list. Changes take effect for requisitions distributed AFTER the change; in-flight distributions continue to honor the pre-change rule until they close.",
    dist_delete:
      "Removes a scoped rule. Subsequent requisitions at that scope fall back to the next-broader scope's rule (org-unit → global). Returns 204; deleting a non-existent rule is a no-op.",
    dist_resolve:
      "Returns the effective rule a requisition WOULD use given its location and org-unit, plus the scope it resolved from. Use to render the distribution preview on a requisition-intake screen before submitting.",

    /* ===== Pricing ================================================= */
    price_list:
      "Returns pay / bill rate cards keyed by job + location + shift differential. The lookup resolution is location → org-unit → global, with the most-specific match winning. Used at requisition intake to suggest defaults and at invoice time to compute totals.",
    price_create:
      "Adds a rate-card row. The unique key is (jobId, locationId, shiftDifferentialId) — duplicates return 409. Effective dates allow rate changes that don't disturb in-flight engagements; only requisitions opened after effectiveStart adopt the new rates.",
    price_update:
      "Patch-style update of an existing rate-card row. As with create, changes are effective-dated; existing engagements keep their original rate for the life of the engagement.",
    price_delete:
      "Removes a rate-card row. Requisitions and engagements that already inherited the rate are unaffected — they retain the snapshot taken at intake.",
    fund_list:
      "Per-supplier funding rules — invoice factoring terms, payment timing (net 30 / net 45 / net 60), currency, and any early-pay discount tiers. One funding rule per supplier; missing ones fall back to the org's default payment terms.",
    fund_update:
      "Patch-style. Changing payment timing applies to invoices issued after the change; in-flight invoices keep their original terms. Currency changes are heavyweight and require finance sign-off; the platform enforces this via the funding.write scope.",
    tax_list:
      "Tax rules by jurisdiction. Used at invoice time to compute applicable tax (US state sales tax, Canadian GST/HST/PST, VAT for EU). Rules are kept in sync with regulatory updates by the platform's tax-content provider; orgs can override for special exemptions.",
    tax_calc:
      "Computes applicable tax for a given amount and jurisdiction. Returns the resolved rate, the source rule, and the calculated tax amount. Use for client-side previews on invoice creation; the authoritative computation happens server-side at invoice issue time.",

    /* ===== Policies ================================================ */
    policy_list:
      "Returns the policy packs installed on the org with their scope (global / org-unit / location). Each pack bundles a set of policies — background check, drug screen, dress code, attendance — that apply when a worker is engaged in the pack's scope.",
    policy_create:
      "Installs a policy pack at a given scope. Policies in the pack are evaluated against newly-engaged workers at engagement-start time; existing workers are unaffected until the pack is explicitly re-applied via /policies/{id}:apply.",
    policy_update:
      "Patch-style update of an installed pack — name, scope, included policies. Re-evaluation against existing workers requires an explicit :apply call; patch alone doesn't re-scan.",
    policy_apply:
      "Re-evaluates the policy pack's scope and applies it to every matching worker. Heavyweight — returns 202 with an Operation handle, and the operation may take several minutes for large worker sets. Idempotent: workers who already satisfy the policy are unchanged.",

    /* ===== Talent pools ============================================ */
    pool_list:
      "Returns the named worker pools the org has configured. Pools can be rule-driven (auto-populated from job + credential + location predicates) or manually curated; the type is on each row.",
    pool_create:
      "Creates a pool. For rule-driven pools the membership is computed on read; for manual pools, populate via /talent-pools/{id}/members. Rule-driven pools refresh on a 5-minute cadence — pass autoRefresh=false to disable.",
    pool_members:
      "Returns the workers currently in a pool. For rule-driven pools this is the latest-computed snapshot; force a refresh with /talent-pools/{id}:refresh. Pagination cursor is stable across refreshes.",

    /* ===== Time off ================================================ */
    to_list:
      "Returns time-off requests visible to the caller. Worker principals see only their own; managers see every request under their org-unit. Filter by status (pending / approved / rejected / cancelled) or by date range.",
    to_create:
      "Worker-side. Submits a request for time off. Conflicts with assigned shifts in the requested window are detected at create time and returned in the response so the worker can see what needs to be released. Routes through the worker's manager-approval chain.",
    to_approve:
      "Approves a pending request. Any of the worker's assigned shifts in the approved window are automatically released back to the open pool, with notifications fanning out to schedule consumers. Audit-logged with the approving user.",
    to_reject:
      "Rejects a pending request with a required reason that's shown to the worker on the mobile app. Assigned shifts in the requested window are unaffected; the worker stays on the schedule.",

    /* ===== Analytics =============================================== */
    metrics_list:
      "Returns the catalog of pre-built metrics — names like fill_rate, time_to_fill, cost_per_hour, retention_at_90d. Each metric carries its dimensions (the fields you can group / filter by) and the supported time grains. Use to render a metric-picker UI.",
    insights_list:
      "Returns named insights — auto-generated summaries of spend trends, supplier performance, risk indicators, and capacity outlook. Each insight carries a title, body (Markdown), and a structured supporting-data envelope so consumers can render charts inline.",

    /* ===== Dashboards ============================================== */
    dash_get:
      "Returns the calling user's dashboard layout — tabs in order, widgets per tab, and per-widget configuration (filters, time range, group-by). Most home pages issue this on session start and re-issue on tab switches.",
    dash_update:
      "Replaces the entire dashboard layout. The body is the full tabs + widgets structure; partial updates aren't supported on this endpoint (use the more granular /dashboards/widgets/{id} endpoints for one-widget edits). Saves are user-scoped — not org-shared.",
    dash_widgets:
      "Returns the widget catalog — every widget available for placement, with its supported metrics, required configuration shape, and a preview thumbnail URL. Use to render the add-widget picker on the dashboard surface.",

    /* ===== System ================================================== */
    sys_health:
      "Returns the current operational status of the platform — overall green/yellow/red, per-region status, and any active incidents. Unauthenticated — safe to poll from status pages. Cached at the edge with a 30-second TTL.",
    sys_regions:
      "Returns the data-residency regions the platform offers (US, EU, CA, AU) and the region the caller's org sits in. Region is set at org-onboarding and cannot be changed without a data-migration project — surface read-only.",

    /* ===== API keys ================================================ */
    api_keys_list:
      "Returns the API keys provisioned by the org, including their scopes, optional client certificate binding, and last-used timestamp. The secret value itself is NEVER returned — it's shown once at creation and must be captured then.",
    api_keys_create:
      "Provisions a new API key. The full secret is returned ONCE in the response body — capture it on creation; subsequent reads return only the prefix. Optionally bind to a client certificate (mTLS) and / or an IP allowlist by configuring on the key after creation.",
    api_keys_delete:
      "Permanently revokes an API key. Any in-flight requests using the key fail with 401 immediately; the platform does not provide a grace period. To rotate without downtime, provision a new key first and migrate clients before deleting the old one.",
    ipallow_get:
      "Returns the CIDR allowlist for one API key. An empty list means no restriction. Each entry carries the CIDR block, a description, and the timestamp added — useful for periodic security reviews.",

    /* ===== AI ====================================================== */
    ai_chat:
      "Sends a user message to the assistant, augmented with the current org context (visible requisitions, recent timesheets, schedule view). Beta — requires X-Flexwork-Labs: aiChat. Responses are streamed via server-sent events when Accept: text/event-stream is sent; otherwise buffered and returned as a single JSON envelope.",
    ai_summarize_req:
      "Returns a one-paragraph LLM-generated summary of a requisition's status, candidate pipeline, fill state, and risk factors. Cached for 5 minutes per requisition; pass refresh=true to force a fresh generation.",

    /* ===== Expenses ================================================ */
    exp_list:
      "Paginated list of expense lines. Worker principals see only their own expenses; managers see every expense under their org-unit. Filter by worker, requisition, status, or by week (incurredAfter / incurredBefore).",
    exp_submit:
      "Worker-side. Submits a receipt-backed expense line. Upload the receipt to /files first and pass receiptFileId here. The expense category is validated against the org's expense policy at submit time — over-policy amounts are accepted but flagged for additional approval.",
    exp_approve:
      "Approves an expense for reimbursement. Adds the amount to the next payroll export for that worker. Approvals are routed by the policy attached to the worker's engagement; reach this endpoint through the inbox approval action, not directly, for the audit trail to be complete.",
    exp_reject:
      "Rejects an expense with a required reason that's shown to the worker on the mobile app. The worker can correct and resubmit; resubmission re-enters the approval flow from the start.",
    expolicy_put:
      "Replaces the active expense policy for the org. The previous policy is archived (still readable for audit and for in-flight expense validation snapshots). In-flight expenses keep their original validation snapshot — they're not retroactively re-validated against the new policy.",

    /* ===== Saved views ============================================= */
    views_list:
      "Returns the calling user's saved list-views plus any views shared org-wide by other users. Filter by ?resource= to scope to one resource type or by ?shared= to scope to shared / private. Default views (one per resource per user) are marked default=true.",
    views_create:
      "Saves the current filter, column, and sort configuration for fast recall. Private by default; pass shared=true to make the view visible org-wide. Only one default view per (user, resource) — POSTing default=true clears the previous default automatically.",
    views_update:
      "Patch-style update. Only the view's owner can update a private view; admins can update shared views. Updating an org-shared view affects every user who's adopted it as their default.",
    views_delete:
      "Permanently deletes the view. Users who had it as their default fall back to the platform default for the resource. Deleting a shared view requires the views.shared.delete scope.",

    /* ===== Files (incl. former attachments) ======================== */
    files_get:
      "Returns the file's metadata plus a freshly-minted signed download URL valid for 15 minutes. Re-issue this endpoint to refresh the URL — there is no extend-this-link operation.",
    files_delete:
      "Soft-deletes the file. Records that reference the file by id continue to resolve to a tombstone; the signed URL stops working immediately. Retention policy on the category determines when the underlying blob is purged from storage (7 years for receipts and contracts, 90 days for misc).",
    attachments_create:
      "Binds an uploaded /files record to an entity (requisition / worker / timesheet / invoice / candidate / SOW / comment). The same file can be attached to multiple entities — each binding is its own attachment record. Pair with /comments to surface attachments inline in a thread.",
    attachments_list:
      "Returns every file attached to one entity. The {resource} segment is one of requisitions / workers / timesheets / invoices / candidates / sows / comments. Each file in the response carries a freshly-minted signed download URL valid for 15 minutes.",
    files_upload_patch:
      "Appends the next chunk to a resumable upload, per tus.io 1.0. Send as Content-Type: application/offset+octet-stream with Upload-Offset and Upload-Length headers. The server returns the new Upload-Offset on success; resume from the returned offset on disconnect.",
    files_upload_get:
      "Returns the current Upload-Offset and remaining bytes for an in-flight resumable upload. Issue this on reconnect to know where to resume from. Includes the configured Upload-Length so progress UIs can render an accurate bar.",
    files_upload_cancel:
      "Aborts an in-flight resumable upload. Already-uploaded bytes are discarded immediately — there is no resume after cancel. Issue when the user explicitly cancels in the UI or when an upload session has stalled past your tolerance.",

    /* ===== Devices ================================================= */
    devices_register:
      "Registers a mobile device's push token so the user receives push notifications. Idempotent on pushToken — re-registering refreshes lastSeenAt. Tokens persist across app launches; only re-register on token rotation or on first install.",
    devices_delete:
      "Stops sending push notifications to this device. Called automatically by mobile-app uninstall handlers via APNs / FCM unregister callbacks. Safe to call from logout flows even if no device is registered.",

    /* ===== MSP ===================================================== */
    msp_scope_get:
      "Returns the calling user's current cross-program scope — which client programs are visible in list calls. An empty programs array means no filter applied (all programs the user has access to). The active program is highlighted for UI rendering.",
    msp_scope_set:
      "Replaces the calling user's cross-program scope. Subsequent list calls automatically filter to the selected programs. Persistent across sessions — survives sign-out and back in.",

    /* ===== Rosters ================================================= */
    bookings_create:
      "Creates a hospitality booking — one banquet event with its setup / service / teardown windows, guest count, and captain. The companion roster is created empty; add positions via /bookings/{id}/positions to fan out shifts onto the schedule.",
    bookings_get:
      "Returns one booking with its roster summary inlined — position counts, fill state per position, captain, and the event timeline. For the full position-by-position lineup use /bookings/{id}/roster.",
    bookings_update:
      "Patch-style. Changing eventDate or any of the setup/service/teardown windows cascades to every position's fan-out shift on the schedule — workers already assigned receive update notifications. Guest-count changes don't auto-resize positions; resize manually via the positions endpoints.",
    bookings_roster_get:
      "Returns every position on a booking with its current primary lineup (assigned workers) and standby lane (backups). Each position carries a fill state — open / partial / filled / overflow — that drives the booking's overall progress indicator.",
    bookings_positions_create:
      "Adds a new role to a booking — e.g. 8 banquet servers, 4 bartenders, 2 captains. Each position fans out to its own set of shifts on the schedule (one shift per slot). Conflicts with existing assigned workers in the time window return 409 with a structured reason envelope.",
    positions_assign:
      "Sets the primary lineup (and optional standby lineup) for a position. Each lineup is an ordered list of worker ids. The platform checks every worker for conflicts and credential eligibility; returns 409 with a per-worker failure reason on any conflict.",

    /* ===== Comments ================================================ */
    comments_create:
      "Adds a comment to a polymorphic thread (any requisition / worker / timesheet / invoice / candidate / SOW). @-mentions referenced in the mentions array fan out to the inbox endpoint as notifications and resolve against the caller's org-unit scope (mentioning someone you can't see returns 422).",
    comments_update:
      "Edits the body of a comment. Only the author can edit. The original body is retained in audit; clients can show an `edited` indicator using the editedAt timestamp.",
    comments_delete:
      "Soft-deletes a comment. The thread retains a tombstone so replies still parent correctly. Hard-deletion (purge from audit) requires a privacy-erasure request — see the privacy tag.",

    /* ===== Feedback ================================================ */
    feedback_list:
      "Returns end-of-shift feedback rows for one worker, newest first. Each row carries a rating, free-text notes, tag selections (e.g. punctual, prepared, helpful), and a back-reference to the shift it was attached to.",
    feedback_summary:
      "Returns the worker's rolling rating average and tag histogram across a configurable window (?windowDays=N, default 90). Drives the rating chip on worker cards and the rehire-eligible flag during offboarding.",

    /* ===== Signing ================================================= */
    signing_create:
      "Routes a document through the configured provider (DocuSign / Adobe Sign / native signer) to a list of signers in order. Each signer's signing link is delivered via the configured channel (email by default; SMS for mobile-first orgs). Status updates fire the document.signed event when complete.",
    signing_get:
      "Returns the current status of a signing request and the per-signer state — pending / viewed / signed / declined / expired. Includes the audit trail with timestamps and IP addresses (subject to regional privacy redaction).",
    signing_remind:
      "Sends a reminder email to the next signer in the chain. No-op if the request has already been signed or voided. Rate-limited to one reminder per signer per 12 hours; subsequent calls within the window return 429.",
    signing_void:
      "Cancels an in-flight request. Once voided, signers' signing links return an error page. The audit trail is retained. Voiding a fully-signed request is not allowed (it's already complete) — returns 409.",

    /* ===== Favorites & activity ==================================== */
    favorites_list:
      "Returns the calling user's favorited entities across all resource types (requisitions, workers, suppliers, candidates, dashboards), newest favorited first. Drives the favorites menu in the global nav.",
    favorites_create:
      "Favorite an entity. Idempotent on (resource, subjectId) — re-favoriting an already-favorited entity is a no-op and returns the existing favorite. Free-form across resources; the resource type is recorded so consumers can render mixed lists.",
    favorites_delete:
      "Unfavorites an entity. Returns 204 even if the entity wasn't favorited — clients can issue this freely without first checking state.",
    activity_me:
      "Returns a chronological feed of the calling user's actions across the platform — what they viewed, created, edited, approved. Drives the recent-activity surface on the home dashboard and powers the omnisearch's recency boost.",

    /* ===== Help ==================================================== */
    help_articles_list:
      "Returns the help-center table of contents. Each row carries a title, slug, category, and an estimated read time. Cached aggressively (edge TTL 1 hour) — safe to fetch on every page load.",
    help_article_get:
      "Returns one article in Markdown along with contextual cross-links and related metric / tag references. The body is sanitized; consumers can render it directly without further escaping.",
    help_search:
      "Substring + semantic search across the help-center content tree. Returns articles with relevance scores and highlighted snippets. Used by the in-product help drawer's search box and by the omnisearch palette as a fallback when no entity matches.",

    /* ===== FX ====================================================== */
    fx_convert:
      "Converts an amount from one currency to another using the platform's published reference rate. Returns the resolved rate, the rate's source (the FX data provider used for the snapshot), and the timestamp the rate was sourced. Rates refresh nightly; intra-day fluctuations are not modeled.",

    /* ===== Reports ================================================= */
    reports_list:
      "Returns the org's scheduled reports — each one is a saved /metrics/query plus a delivery schedule (RRULE) and a destination (email recipients list or SFTP target). Surfaces the next-run timestamp inline.",
    reports_create:
      "Schedules a saved query to run on the supplied RRULE cadence and deliver the result to email or SFTP. The query's metric, dimensions, filters, and time window are captured in the report definition; changes to the underlying metric catalog don't retroactively change scheduled reports.",
    reports_run:
      "Manually triggers a report run outside its schedule. Returns an Operation handle; the result is delivered to the configured channels AND attached to the operation's resultUrl for immediate inspection. Use to test report configuration without waiting for the next scheduled fire.",

    /* ===== Async jobs ============================================== */
    ops_list:
      "Paginated list of long-running operations the caller has visibility into — imports, exports, bulk-publish, distribution fan-outs, AI summary generations. Each row carries its type, status, progress (0..1), start timestamp, and (when complete) result URL or error envelope.",
    ops_cancel:
      "Cancels a running operation. Operations already completed are returned as-is; queued operations are removed; in-flight operations interrupt at the next safe checkpoint — most operations honor cancel within a few seconds. Already-cancelled operations return 409.",

    /* ===== Discovery =============================================== */
    cdc_asyncapi:
      "Returns the AsyncAPI 2.6 description of the CDC stream and webhook channels. Use to generate type-safe consumer SDKs in Go, Java, TypeScript, or Python via the standard AsyncAPI generator. Refreshed on every API version bump.",
    disc_oauth:
      "RFC 8414 metadata describing the platform's OAuth endpoints, supported grants, scopes, and response types. Consumed by every standard OAuth client SDK without configuration. Cached at the edge with a 1-hour TTL.",
    disc_oidc:
      "OpenID Connect Discovery 1.0 metadata. Consumed by every OIDC-compatible SDK (AppAuth, Auth0, Okta, native iOS/Android SDKs). Endpoint paths match /auth/* — the discovery document is just a stable handoff point for SDKs that prefer convention over configuration.",
    disc_jwks:
      "Public keys used to verify access-token signatures. Rotated quarterly with a 30-day overlap — clients that cache key sets should re-fetch on first signature-validation failure rather than rely on a fixed TTL.",
    disc_openapi:
      "The platform's OpenAPI 3.1 document. Use to generate SDKs, render external reference documentation, or to drive contract tests. Refreshed on every API version bump.",
    disc_saml:
      "Flex Work's SP metadata XML for SAML 2.0 IdP setup. Upload directly to Okta / Entra ID / Ping / OneLogin to configure SSO. Re-issued only on certificate rotation (quarterly).",
    disc_compliance:
      "Returns the platform's compliance attestations — SOC2 Type II, ISO 27001, HIPAA, GDPR DPA — with last-attestation dates and downloadable evidence packs (PDF). Suitable for procurement reviews and security questionnaires.",

    /* ===== SCIM ==================================================== */
    scim_users_get:
      "Returns one user in SCIM 2.0 envelope, mapped from /users/{id}. The SCIM schema is the standard urn:ietf:params:scim:schemas:core:2.0:User; the platform also supports common extensions (Okta's roles, Entra ID's accountEnabled).",
    scim_users_patch:
      "RFC 7644 PATCH operation — a sequence of add / replace / remove operations applied in order. The platform handles common IdP quirks (Okta's roles extension, Entra ID's accountEnabled) without translation on the client side.",
    scim_users_delete:
      "SCIM DELETE — soft-deactivates the user. Equivalent to /users/{id} DELETE. The record is retained for audit; re-provisioning the same email re-activates the original record rather than creating a duplicate.",
    scim_groups_list:
      "Returns the org's roles as SCIM groups. Group membership corresponds to role assignment. Pagination follows RFC 7644 with startIndex + count.",

    /* ===== mTLS ==================================================== */
    mtls_list:
      "Returns every client certificate bound to one API key. Up to four certificates per key are supported simultaneously to allow zero-downtime rotation — provision the new cert, rotate clients over, then remove the old cert.",

    /* ===== Privacy ================================================= */
    erase_list:
      "Paginated list of erasure requests on the org — DSAR / SAR / right-to-be-forgotten orchestration. Used by the privacy console to track SLA compliance (hard 30-day deadline). Each row carries the subject, requested-by user, current state, and per-system progress.",
    erase_get:
      "Returns one erasure request with its per-system redaction report — what was scrubbed from the primary DB, file storage, audit log, search index, and analytics warehouse. Includes timestamps and hashes for each system's attestation.",

    /* ===== Tax forms =============================================== */
    taxforms_list:
      "Returns every tax form generated for one worker across all tax years — 1099-NEC, W-2, T4 (Canada). Each row carries the tax year, form type, status (draft / final / delivered), and (when delivered) the consent record for electronic delivery.",
    taxforms_get:
      "Returns one tax form with a signed download URL for the rendered PDF. Forms are versioned per tax year; corrections issue a new version rather than mutating the original — both versions remain accessible.",

    /* ===== Banking ================================================= */
    bank_list:
      "Returns a worker's direct-deposit accounts. Account numbers are NEVER returned — only the last four digits along with the bank name and routing number. To resolve full account details, callers need the banking.pii.read scope (very restricted, audit-tracked).",
    bank_delete:
      "Removes a direct-deposit account. If the deleted account was the worker's only verified account, payroll is paused until a replacement is added and verified. Notification fans out to the worker via their configured channel.",

    /* ===== Clocking ================================================ */
    geo_get:
      "Returns the geofence config for a location — either a center+radius pair (typical for distributed worksites) or a polygon (precise multi-building campuses). The fence drives the clocking validation on /shifts/{id}:clock-in and :clock-out.",
    punch_out:
      "Worker-side punch-out. Same geofence semantics as clock-in — accuracy_low is tagged but not blocked. Closes the shift's labor window for the timesheet engine, which then computes hours worked and applies any shift-differential or overtime rules attached to the schedule."
  };

  /* ------ Apply ----------------------------------------------------- */
  // Additive — never overwrite an existing detail. (ext-3 and ext-6 set
  // detail on a handful of high-traffic endpoints; those win.)
  var applied = 0;
  spec.paths.forEach(function (p) {
    if (!p.detail && D[p.id]) {
      p.detail = D[p.id];
      applied++;
    }
  });
  if (typeof window !== "undefined" && window.console) {
    var stillMissing = spec.paths.filter(function (p) { return !p.detail; });
    if (stillMissing.length) {
      console.warn("FW_API_SPEC: " + stillMissing.length + " endpoints still without detail →",
        stillMissing.slice(0, 10).map(function (p) { return p.id; }));
    }
  }
})();
