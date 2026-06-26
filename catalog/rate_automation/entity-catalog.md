# Rate Automation (Flex Work) — VMS Entity Lifecycle Catalog

Rate Automation (Flex Work) is a Vendor Management System module that governs how staffing agencies are onboarded, how job types and positions are catalogued, and how pay and bill rates are calculated through a versioned engine and uploaded rate cards. Eight entities were identified: Agency, Position, Job Type, Rate Card Upload, Pricing Rule, Rate Card, Rate Engine, and Rate Line. Overall, 63 of 107 expected capabilities are present (14 partial, 30 missing).

## Agency — A staffing supplier (recruitment agency) that provides workers to clients; tracked with priority, contact, pricing status, and activation date.
**Lifecycle states:** invited → active → pricing-pending → pricing-applied; active → suspended → active; active → offboarded
  (observed: active, pricing-pending, pricing-applied; expected-but-unseen: invited, suspended, offboarded)
**Capabilities:**
- ✅ List and search agencies — present (screens: 000_active-agencies-list.txt)
- ✅ Send pricing invite — present (screens: 000_active-agencies-list.txt, 011_active-agencies-list.txt)
- ✅ Sort agencies by date — present (screens: 000_active-agencies-list.txt)
- ⚠️ View agency detail / profile — partial (Rate Simulator references 'Agencies → Staffline Group → Rate Configuration', implying a detail view exists, but no agency detail screen was walked.)
- ⚠️ Activate agency — partial ('ACTIVATE' string found in source and 'Date Activated' column shown; however the actual activation control or flow screen was not walked.)
- ⚠️ Configure agency rate / pricing — partial (Rate Simulator confirms configuration exists via 'Agency Rate Config' strings, but the rate configuration screen itself was not walked.)
- ⚠️ Set agency priority — partial (A Priority column is visible in the list, suggesting priority assignment is a feature, but no control or edit flow for setting priority was observed.)
- ❌ Create agency — missing (VMS requires adding new supplier/agency records; no 'Add agency' or creation flow was observed.)
- ❌ Edit agency profile — missing (Contact, priority, and other fields visible in the list would normally be editable in a detail view; no edit control or form was observed.)
- ❌ Delete agency — missing (VMS systems typically allow removal of agencies added in error before they become active; no delete control found.)
- ❌ Archive agency — missing (VMS platforms archive offboarded agencies to preserve historical rate and booking data while removing them from active selection.)
- ❌ Suspend agency — missing (VMS platforms commonly allow suspending a supplier to pause new bookings while retaining the agency record.)
- ❌ Offboard agency — missing (VMS requires a formal offboarding step to end an agency relationship and prevent further assignments.)
**Coverage:** 3 / 13 present (4 partial, 6 missing)

## Position — A named job role grouped under a job type, available for requisitions and referenced as the primary key in rate cards.
**Lifecycle states:** active → inactive → active
  (observed: active; expected-but-unseen: inactive)
**Capabilities:**
- ✅ Add position — present (screens: 019_positions.txt)
- ✅ Add job type — present (screens: 019_positions.txt)
- ✅ List and search positions — present (screens: 019_positions.txt)
- ✅ Use position as rate card lookup key — present (screens: 025_rate-simulator.txt)
- ✅ Map / validate position against rate card upload — present (screens: 019_positions.txt)
- ❌ View position detail — missing (No detail/drill-down screen for an individual position is evidenced; a VMS typically shows associated rate lines, linked requisitions, and accreditation requirements.)
- ❌ Edit / rename position — missing (The positions list shows no edit affordance; a VMS must allow renaming a position without breaking rate-card references.)
- ❌ Edit / rename job type — missing (Job types appear as grouping headers with no edit control visible; renaming is a standard catalogue management operation.)
- ❌ Delete position — missing (No delete affordance is visible; a VMS should allow deletion of unused positions not referenced by active rate lines or open requisitions.)
- ❌ Delete job type — missing (No delete affordance for job types is shown; required for catalogue housekeeping when a job category is retired.)
- ❌ Deactivate / disable position — missing (A VMS position catalogue must support deactivating positions that are no longer offered without deleting historical rate and booking data.)
**Coverage:** 5 / 11 present (0 partial, 6 missing)

## Job Type — A category grouping one or more positions, drawn from rate cards and used to organise positions and segment rate lookups.
**Lifecycle states:** active → inactive → active
  (observed: active; expected-but-unseen: inactive)
**Capabilities:**
- ✅ List / search job types — present (screens: 019_positions.txt, 025_rate-simulator.txt)
- ✅ Map unrecognised job type (from upload) — present (screens: 035_validate-upload.txt, 036_validate-upload.txt)
- ✅ Filter rate card / rate matrix by job type — present (screens: 025_rate-simulator.txt, 019_positions.txt)
- ⚠️ Create job type — partial (The 'Add job type' button is visible in the Positions page UI but no modal or creation form is captured in walk evidence.)
- ❌ Read job type detail — missing (No dedicated job type detail screen is evidenced; viewing member positions, parity rules, and associated rate lines is a standard configuration read.)
- ❌ Rename / update job type — missing (No edit affordance for an existing job type name or properties is shown; VMS configuration objects must be renameable.)
- ❌ Delete job type — missing (No delete affordance is evidenced; standard VMS admin capability for removing a job type when no positions or rate lines are still associated.)
- ❌ Archive / deactivate job type — missing (No deactivate or archive control is shown; VMS platforms commonly allow soft-deactivation to stop a job type appearing in dropdowns without permanently deleting it.)
**Coverage:** 3 / 8 present (1 partial, 4 missing)

## Rate Card Upload — A background file upload of a rate card spreadsheet that moves through states before becoming the active rate card.
**Lifecycle states:** uploading → ready_to_validate → validating → validated_clean → applied; validating → validated_errors → ready_to_validate; uploading → failed; applied → superseded; any → discarded
  (observed: uploading, ready_to_validate, validating, validated_clean, validated_errors, applied, failed; expected-but-unseen: superseded, discarded)
**Capabilities:**
- ✅ Upload rate card file — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ View uploads queue (list) — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ View upload detail / validation results — present (screens: 035_validate-upload.txt, 036_validate-upload.txt)
- ✅ Trigger validation — present (screens: 010_rate-cards.txt, 035_validate-upload.txt)
- ✅ Apply rate card (go live) — present (screens: 036_validate-upload.txt)
- ✅ Re-upload corrected file — present (screens: 036_validate-upload.txt)
- ✅ Download validation error report (CSV) — present (screens: 035_validate-upload.txt)
- ✅ Dismiss failed upload — present (screens: 010_rate-cards.txt)
- ✅ Clear upload history — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ View version history — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ⚠️ Continue to configuration (set effective date / mapping) — partial ('Continue to configuration' button is present in source but no configuration screen was captured in the walk; effective date setting and mapping resolution are unconfirmed.)
- ⚠️ Search / filter uploads queue — partial (A search input is shown on the queue screen but no full-queue filter controls beyond the search field are confirmed.)
- ❌ Discard a pending/invalid upload — missing (VMS upload queues commonly allow explicitly discarding an upload that is ready-to-validate or has errors; only failed uploads expose a dismiss action.)
- ❌ Rollback / reactivate a prior version — missing (VMS systems commonly allow reverting the live rate card to a previously applied version; the version history table is read-only.)
- ❌ Schedule future effective date for upload — missing (VMS pricing systems commonly allow scheduling a rate card to go live at a future date; no effective-date screen was captured.)
- ❌ Notify stakeholders on apply — missing (Enterprise VMS platforms commonly trigger notifications to affected agencies or internal users when a new rate card goes live; no notification affordance is visible.)
**Coverage:** 10 / 16 present (2 partial, 4 missing)

## Pricing Rule — A rule within the Rate Engine that defines one step in the pay/bill rate calculation, specifying method and level but not values.
**Lifecycle states:** draft → published → archived; archived → draft
  (observed: draft, published; expected-but-unseen: archived)
**Capabilities:**
- ✅ Create pricing rule — present (screens: 024_rate-engine.txt)
- ✅ View pricing rule detail — present (screens: 024_rate-engine.txt, 025_rate-simulator.txt)
- ✅ List and search pricing rules — present (screens: 024_rate-engine.txt)
- ✅ Delete pricing rule — present (screens: 024_rate-engine.txt)
- ✅ Publish version (promotes all rules to live) — present (screens: 024_rate-engine.txt)
- ✅ Create new engine version (branch rules for editing) — present (screens: 024_rate-engine.txt)
- ✅ Switch to existing draft version — present (screens: 024_rate-engine.txt)
- ✅ Preview compiled rate-card schema (column impact of rules) — present (screens: 024_rate-engine.txt)
- ✅ Simulate rule output against a booking — present (screens: 025_rate-simulator.txt)
- ⚠️ Edit pricing rule structure (type, calc, condition, level) — partial (Inline dropdowns are editable on draft rules only; rule name rename is implied by the prototype but not directly confirmed.)
- ⚠️ Reorder pricing rules within a group — partial (Grip icon indicates drag-to-reorder intent and moveGroup() confirms group-level ordering, but no moveRule() function is present in source — rule-level reorder within a group is unconfirmed.)
- ❌ Restore / branch from archived version — missing (VMS rate engines commonly allow branching from a historical archived version to recover an earlier rule configuration; no such affordance is present.)
- ❌ Archive / deactivate pricing rule independently — missing (Individual rule archiving to preserve audit history is expected in VMS engines that need to track when a rule was active; the prototype only supports delete or non-live versioning.)
- ❌ Export / audit rule history — missing (VMS platforms commonly provide an export or audit log of rule changes across versions for compliance and client billing transparency; no such export affordance is evidenced.)
**Coverage:** 9 / 14 present (2 partial, 3 missing)

## Rate Card — A versioned file (xlsx/csv) containing pay and bill rate lines for every position, used as the live pricing source for rate calculations.
**Lifecycle states:** draft → active → superseded → archived
  (observed: active; expected-but-unseen: draft, superseded, archived)
**Capabilities:**
- ✅ Upload rate card file — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ View rate card version list — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ Apply rate card (make version active) — present (screens: 036_validate-upload.txt)
- ✅ Download rate card template (blank schema) — present (screens: 010_rate-cards.txt)
- ✅ Re-upload corrected file — present (screens: 036_validate-upload.txt)
- ✅ Clear upload history — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ View rate card in rate simulator — present (screens: 025_rate-simulator.txt)
- ⚠️ View rate card version detail — partial (The version history table has selectable rows indicating a detail view, but no detail screen is shown in the walk; content is unconfirmed.)
- ⚠️ Search / filter version history — partial (A search field exists on the Rate Cards screen but targets the uploads queue by filename, not the version history table; no filter controls appear on the version history itself.)
- ⚠️ Set effective date for rate card version — partial (An 'EFFECTIVE' date range is shown per version and the source references an 'Effective date' column in the uploaded file, but no UI control to override the effective date independently is shown.)
- ❌ Archive / retire a rate card version — missing (VMS systems commonly allow explicit archiving of old rate card versions to distinguish intentionally retired cards from superseded ones; no such action appears.)
- ❌ Delete rate card version — missing (VMS pricing modules commonly allow deletion of erroneous or test rate card versions that were never made active; no delete control appears.)
- ❌ Export / download active rate card — missing (VMS users commonly need to export the current live rate card for audit, agency distribution, or offline review; no export action is present.)
**Coverage:** 7 / 13 present (3 partial, 3 missing)

## Rate Engine — A versioned configuration object that defines the structural rules for how pay and bill rates are calculated — structure only, no values.
**Lifecycle states:** draft → published → archived; any → draft
  (observed: draft, published, archived; expected-but-unseen: none)
**Capabilities:**
- ✅ Create rate engine configuration (new legal entity) — present (screens: 024_rate-engine.txt)
- ✅ View rate engine structure (read detail) — present (screens: 024_rate-engine.txt, 025_rate-simulator.txt)
- ✅ Edit pricing rules structure (draft only) — present (screens: 024_rate-engine.txt)
- ✅ Edit rate card custom lookup keys (draft only) — present (screens: 024_rate-engine.txt)
- ✅ Delete / remove individual pricing rule — present (screens: 024_rate-engine.txt)
- ✅ Archive a rate engine version — present (screens: 024_rate-engine.txt)
- ✅ List / switch between rate engine configurations (per legal entity) — present (screens: 024_rate-engine.txt)
- ✅ View version history and switch versions — present (screens: 024_rate-engine.txt)
- ✅ Create new version (copy from current) — present (screens: 024_rate-engine.txt)
- ✅ Publish draft version (make live) — present (screens: 024_rate-engine.txt)
- ✅ Switch active view to existing draft — present (screens: 024_rate-engine.txt)
- ✅ Download rate card CSV template from engine — present (screens: 024_rate-engine.txt)
- ✅ View compiled template overlay (fields and their kind) — present (screens: 024_rate-engine.txt)
- ✅ Preview/simulate rates against engine (rate simulator) — present (screens: 025_rate-simulator.txt)
- ❌ Delete entire rate engine configuration — missing (VMS commonly allows removal of a legal-entity pricing configuration when it is no longer needed; no delete/remove config affordance found.)
- ❌ Rename / relabel rate engine configuration — missing (VMS commonly allows renaming a legal-entity configuration; no rename affordance found beyond initial creation label.)
- ❌ Export / import rate engine configuration — missing (VMS configurations are commonly exportable for backup or cross-environment migration; only the value-free CSV template is exportable, not the engine configuration itself.)
**Coverage:** 14 / 17 present (0 partial, 3 missing)

## Rate Line — A single pricing row within a rate card, specifying pay and bill rates for a given combination of position, shift type, location, and other lookup keys.
**Lifecycle states:** staged → active → superseded; staged → excluded
  (observed: staged, active, excluded; expected-but-unseen: superseded)
**Capabilities:**
- ✅ Create rate line (via spreadsheet upload) — present (screens: 010_rate-cards.txt, 034_settings-collapse-sidebar.txt)
- ✅ View rate line detail (rate waterfall breakdown) — present (screens: 025_rate-simulator.txt)
- ✅ List and search rate lines — present (screens: 010_rate-cards.txt, 035_validate-upload.txt, 036_validate-upload.txt)
- ✅ Edit rate line inputs (margin, pension, hours, sick pay, levy) — present (screens: 036_validate-upload.txt)
- ✅ Exclude rate line from staging — present (screens: 036_validate-upload.txt)
- ✅ Validate rate lines (check NMW, duplicates, missing values, outliers) — present (screens: 035_validate-upload.txt, 036_validate-upload.txt)
- ✅ Apply rate card (transition staged lines to active/live) — present (screens: 036_validate-upload.txt)
- ✅ Acknowledge warnings on a rate line — present (screens: 036_validate-upload.txt)
- ✅ Map unmatched site or job type on a rate line — present (screens: 036_validate-upload.txt)
- ✅ Compare rate lines across versions (diff view) — present (screens: 036_validate-upload.txt)
- ✅ Simulate rate line in the rate calculator — present (screens: 025_rate-simulator.txt)
- ✅ View audit trail for rate line edits — present (screens: 036_validate-upload.txt)
- ⚠️ Export rate lines (download as CSV/XLSX) — partial (A downloadable CSV error report is confirmed for upload validation issues, but no general export of all live rate lines as a spreadsheet is evidenced.)
- ⚠️ Bulk edit rate line inputs across multiple selected lines — partial (Bulk bar allows bulk levy on/off and bulk acknowledge, but bulk editing of numeric fields such as margin and pension is not evidenced.)
- ❌ Archive / retire superseded rate lines — missing (A VMS commonly retains prior rate card versions for audit and historical billing lookups; there is no UI for browsing or explicitly archiving superseded rate lines from older versions.)
**Coverage:** 12 / 15 present (2 partial, 1 missing)
