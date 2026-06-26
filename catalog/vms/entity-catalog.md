# Dayforce Flex Work VMS — VMS Entity Lifecycle Catalog

Dayforce Flex Work VMS is a vendor management system for procuring, deploying, and paying contingent labor across frontline and professional workforce programs. The catalog covers 10 core domain entities: Credential, Invoice, Rate Card, Supplier, Shift, Timesheet, Client Site, Requisition, Work Assignment, and Worker. Across 185 expected capabilities, 114 are fully present, 37 are partial, and 34 are missing — an overall present rate of 62% (20% partial, 18% missing).

---

## Credential — A license, certification, background check, training record, or right-to-work document that a worker must hold to be eligible for a shift.

**Lifecycle states:** pending_submission → review → ok → expiring → expired → waived
  (observed: ok, expiring, expired, missing, review; expected-but-unseen: pending_submission, waived)

**Capabilities:**
- ✅ View per-worker credential dashboard — present (screens: 011_workforce.txt, 092_2a61a622.js)
- ✅ List and filter workers by credential status — present (screens: 011_workforce.txt, 092_2a61a622.js)
- ✅ View credentialing compliance dashboard (program-level) — present (screens: 000_good-afternoon-jordan.txt, 055_internal-help-center.txt, 121_d90a56e7.js)
- ✅ Request credential renewal from supplier/worker — present (screens: 092_2a61a622.js)
- ✅ Export credential file for a worker — present (screens: 092_2a61a622.js)
- ✅ Runtime booking block on expired/missing credential — present (screens: 000_good-afternoon-jordan.txt, 055_internal-help-center.txt, 092_2a61a622.js)
- ✅ Auto-suspend shift assignments when credential expires — present (screens: 000_good-afternoon-jordan.txt, 121_d90a56e7.js)
- ✅ Primary-source verification (trigger third-party check) — present (screens: 055_internal-help-center.txt, 121_d90a56e7.js)
- ⚠️ Configure credential policy enforcement (block vs. warn) per credential type — partial (enforcement policy objects confirmed in source but not in a visible prototype screen)
- ⚠️ Configure per-site training matrix (site-specific credential requirements) — partial (concept surfaced in help center as NEXT roadmap; no builder UI rendered)
- ❌ Create / add a new credential record for a worker — missing (no create/upload affordance for net-new credential entry in any walk screen or source)
- ❌ Upload supporting document for a credential — missing (no file-upload control found; standard VMS audit requirement)
- ❌ Edit credential details (expiry date, license number, notes) — missing (credential metadata is read-only; no edit control evidenced)
- ❌ Delete or remove a credential from a worker's file — missing (no delete affordance for credentials in any screen or source)
- ❌ Archive / retire a credential type from the catalog — missing (no archive control evidenced; needed when credential types become obsolete)
- ❌ Grant waiver / compliance exception for a credential — missing (no per-worker waiver or exception-grant UI; enforcement toggles exist only at policy level)
- ❌ Supervisor override gate at clock-in for expired credential — missing (roadmap NOW item explicitly called out; no override UI rendered)
- ❌ Credential auto-renewal task routing (day-30/15/3 escalation) — missing (roadmap NEXT item; only manual renewal requests evidenced)

**Coverage:** 8 / 18 present (2 partial, 8 missing)

---

## Invoice — A supplier billing document generated from approved timesheets, line-itemised by worker and site, that finance tracks through to payment.

**Lifecycle states:** generated → issued → paid / overdue → disputed → voided
  (observed: generated, issued, paid, overdue; expected-but-unseen: disputed, voided)

**Capabilities:**
- ✅ Auto-generate invoice from approved timesheets — present (screens: 086_dd5fd20b.js, 051_internal-help-center.txt)
- ✅ View invoice list with status filtering — present (screens: 010_invoices.txt, 086_dd5fd20b.js)
- ✅ Search invoices by invoice ID, supplier, or site — present (screens: 010_invoices.txt)
- ✅ View invoice detail (line items, amounts, supplier billing info) — present (screens: 023_invoice-inv-a1b2c3d4.txt)
- ✅ Mark invoice paid — present (screens: 023_invoice-inv-a1b2c3d4.txt, 086_dd5fd20b.js)
- ✅ Send invoice to AP — present (screens: 086_dd5fd20b.js)
- ✅ Download invoice PDF — present (screens: 086_dd5fd20b.js, 023_invoice-inv-a1b2c3d4.txt)
- ✅ Export invoice list (CSV / PDF) — present (screens: 086_dd5fd20b.js)
- ✅ Print invoice / remittance — present (screens: 086_dd5fd20b.js)
- ✅ Filter/sort invoice list by supplier or site — present (screens: 010_invoices.txt)
- ⚠️ Raise dispute on invoice — partial (dispute action fires a toast only; full dispute workflow not evidenced)
- ⚠️ Void invoice — partial (bulk action in source; no voided state tab or detail affordance rendered)
- ⚠️ Defer invoice to next billing cycle — partial (bulk overflow action in source; no resulting state change shown)
- ⚠️ Attach note to AP on invoice — partial (both bulk and detail actions fire a toast only; no persistent notes panel)
- ❌ Issue credit note for corrected or retroactive invoice — missing (roadmap NEXT item; no UI evidenced)
- ❌ ERP / accounting system posting — missing (roadmap NEXT item; no ERP export or posting confirmation UI)
- ❌ Consolidated buyer invoice (multi-supplier roll-up) — missing (standard MSP program variation; no aggregation screen present)
- ❌ Supplier-submitted invoice upload / reconciliation — missing (standard professional/SOW program variation; no upload or intake workflow evidenced)

**Coverage:** 10 / 18 present (4 partial, 4 missing)

---

## Rate Card — The configuration object that governs bill rates, pay rates, markups, and premium rules; resolved at booking time for every requisition and timesheet.

**Lifecycle states:** draft → active / scheduled → expired → archived
  (observed: active, scheduled, expired; expected-but-unseen: draft, archived)

**Capabilities:**
- ✅ Create rate card version — present (screens: 056_internal-help-center.txt)
- ✅ View rate card detail (rows, version info, status) — present (screens: 056_internal-help-center.txt)
- ✅ List and browse all versions — present (screens: 056_internal-help-center.txt)
- ✅ Search / filter job rows within a rate card — present (screens: 056_internal-help-center.txt)
- ✅ Edit rate card rows (base pay, season uplift) — present (screens: 056_internal-help-center.txt)
- ✅ Update version metadata (label, effective date, note) — present (screens: 056_internal-help-center.txt)
- ✅ Delete a non-active rate card version — present (screens: 056_internal-help-center.txt)
- ✅ Set location / org-node overrides on rate card rows — present (screens: 056_internal-help-center.txt)
- ✅ Set supplier-specific (agency) rate overrides — present (screens: 056_internal-help-center.txt)
- ✅ Compare rate cards across suppliers — present (screens: 056_internal-help-center.txt)
- ✅ Export rate card to CSV — present (screens: 056_internal-help-center.txt)
- ✅ Import rate card from CSV — present (screens: 056_internal-help-center.txt)
- ⚠️ Activate / promote a version (make it the current active version) — partial (date-driven implicit activation; no explicit Activate button)
- ⚠️ Schedule a future rate card rollout — partial (effectiveFrom date scheduling works; diff view and approval gate are roadmap)
- ⚠️ Audit history / change log for rate card edits — partial (history panel in source code only; not rendered in walk)
- ❌ Archive a rate card — missing (no archive action or archived state; standard compliance need for multi-year programs)
- ❌ Rate card simulator (preview spend impact before saving) — missing (roadmap NOW item; no simulator UI found)
- ❌ Approval gate for rate card changes — missing (roadmap future work; no approval workflow for rate card publishing)
- ❌ Automatic minimum-wage compliance tracking — missing (roadmap NOW item; checkPayFloor() is a per-row check only)

**Coverage:** 12 / 19 present (3 partial, 4 missing)

---

## Supplier — A staffing agency or vendor that provides workers to fill requisitions, scored by fill rate and spend, and governed by tier and distribution rules.

**Lifecycle states:** prospect → invited → onboarding → active → probation / suspended → terminated
  (observed: invited, active, probation, terminated; expected-but-unseen: prospect, onboarding, suspended)

**Capabilities:**
- ✅ Invite supplier — present (screens: 126_8018ca41.js)
- ✅ View supplier list — present (screens: 006_analytics.txt, 007_requisitions.txt, 009_timesheets.txt, 010_invoices.txt, 011_workforce.txt)
- ✅ View supplier detail — present (screens: 126_8018ca41.js)
- ✅ Terminate supplier — present (screens: 126_8018ca41.js)
- ✅ Activate / reinstate supplier — present (screens: 126_8018ca41.js)
- ✅ Change supplier tier — present (screens: 126_8018ca41.js, 102_31d52a1f.js)
- ✅ Compare supplier rate cards — present (screens: 126_8018ca41.js)
- ⚠️ Edit supplier profile — partial (edit action present; no form or field-level edit screen rendered)
- ⚠️ View supplier scorecard — partial (analytics page shows full scorecard; detail-page SupplierScorecard component is commented out)
- ⚠️ Configure supplier distribution rules — partial (distribute action present; no distribution rule editor screen rendered)
- ⚠️ Manage supplier contract / rate card — partial (contract accessor and renewal calendar in source; no contract edit screen walked)
- ⚠️ Message / contact supplier — partial (messageSupplier action via AI assistant only; no dedicated supplier messaging screen)
- ❌ Archive supplier — missing (no archive/hide affordance distinct from termination; needed to retain spend history)
- ❌ Onboard supplier (complete MSA / compliance intake) — missing (onboarding referenced in activity log text but no wizard or checklist screen rendered)
- ❌ Suspend supplier (temporary hold) — missing (only Terminate is offered; no reversible suspend/hold transition evidenced)
- ❌ Export supplier performance report — missing (roadmap NEXT item: QBR pack auto-generation; no export action present)

**Coverage:** 7 / 16 present (5 partial, 4 missing)

---

## Shift — A single time-bounded work slot within a requisition that can be open (unfilled) or assigned to a named worker.

**Lifecycle states:** open → offered → accepted → confirmed → enroute → floor → break → wrapping → completed / flagged / no-show / cancelled / suspended
  (observed: open, offered, accepted, confirmed, enroute, floor, break, wrapping, completed, flagged, no-show, cancelled, suspended, past; expected-but-unseen: none)

**Capabilities:**
- ✅ View shift list / schedule console — present (screens: 008_schedule.txt, 028–038_schedule.txt)
- ✅ Filter and group shifts — present (screens: 008_schedule.txt)
- ✅ Assign worker to open shift — present (screens: 008_schedule.txt)
- ✅ Unassign / remove worker from shift — present (screens: 008_schedule.txt)
- ✅ Worker accept shift invite — present (screens: 000_good-afternoon-jordan.txt)
- ✅ Worker decline shift invite — present (screens: 097_43455436.js)
- ✅ Worker signal I'm on my way — present (screens: 097_43455436.js)
- ✅ Clock in / start shift — present (screens: 008_schedule.txt)
- ✅ Mark break start / end — present (screens: 008_schedule.txt)
- ✅ End shift / clock out — present (screens: 008_schedule.txt)
- ✅ Mark no-show — present (screens: 008_schedule.txt)
- ✅ Suspend future shifts on credential expiry — present (screens: 000_good-afternoon-jordan.txt)
- ✅ File incident report on shift — present (screens: 008_schedule.txt)
- ✅ Adjust time entry (override clock-in/out) — present (screens: 008_schedule.txt)
- ✅ Bulk mark no-show — present (screens: 008_schedule.txt)
- ✅ Copy shift link — present (screens: 008_schedule.txt)
- ✅ Worker cancel accepted shift — present (screens: 097_43455436.js)
- ⚠️ Create shift — partial (dashboard shortcut present; creation form not walked)
- ⚠️ View shift detail — partial (shift cards clickable in scheduler; scheduler-side detail page not directly walked)
- ⚠️ Edit shift (time, role, location) — partial (menu item fires toast; no edit form rendered)
- ⚠️ Broadcast shift to suppliers (tiered / open market) — partial (pipeline described in help center and source; broadcast trigger UI not rendered)
- ❌ Delete shift — missing (no delete affordance for shifts; only unassign and auto-close evidenced)
- ❌ Cancel unfilled shift — missing (no cancel-shift control for open positions in scheduler console)
- ❌ Archive completed / past shifts — missing (no archive/retention management control; past days show a label only)

**Coverage:** 17 / 24 present (4 partial, 3 missing)

---

## Timesheet — The time record for a work assignment capturing actual start, end, and break times that routes through approval before triggering invoicing.

**Lifecycle states:** open → pending_approval → review → approved / rejected → closed / disputed / voided
  (observed: open, pending_approval, review, closed; expected-but-unseen: approved, rejected, disputed, voided)

**Capabilities:**
- ✅ Create timesheet (clock-in capture) — present (screens: 050_internal-help-center.txt, 000_good-afternoon-jordan.txt)
- ✅ View timesheet list — present (screens: 009_timesheets.txt)
- ✅ View timesheet detail — present (screens: 022_ts-91239.txt)
- ✅ Search and filter timesheets — present (screens: 009_timesheets.txt)
- ✅ Edit time entries (correct punches) — present (screens: 022_ts-91239.txt)
- ✅ Bulk approve timesheets — present (screens: 009_timesheets.txt)
- ✅ Reject / send back timesheet to supplier — present (screens: 009_timesheets.txt)
- ✅ Flag / escalate timesheet for audit — present (screens: 009_timesheets.txt)
- ✅ Export timesheets to CSV — present (screens: 009_timesheets.txt)
- ⚠️ Approve timesheet (single record) — partial (action button in source; no rendered single-approve confirmation screen walked)
- ⚠️ Approve timesheet with exception-only auto-approval — partial (per-program toggle described in help center; no configuration screen walked)
- ⚠️ Adjust hours (bulk adjustment panel) — partial (bulk action in source; no adjustment panel screen walked)
- ⚠️ Lock timesheet for payroll — partial (bulk overflow action in source; not visible in walk render)
- ❌ Worker-initiated dispute of approved timesheet — missing (roadmap Later item; no dispute flow in prototype)
- ❌ Delete / void timesheet — missing (no delete or void action; needed for no-show or duplicate timesheets)
- ❌ Archive closed timesheets — missing (no archive action or archived state; VMS audit retention requirement)

**Coverage:** 9 / 16 present (4 partial, 3 missing)

---

## Client Site — A physical client location (warehouse, depot, terminal, etc.) where contingent workers are deployed and against which spend and shifts are tracked.

**Lifecycle states:** Invited → Active → Suspended → Terminated
  (observed: Invited, Active, Terminated; expected-but-unseen: Suspended)

**Capabilities:**
- ✅ Create site — present (screens: 012_clients.txt)
- ✅ View site list — present (screens: 012_clients.txt)
- ✅ Search and filter sites — present (screens: 012_clients.txt)
- ✅ View site detail — present (screens: 012_clients.txt)
- ✅ Edit site profile — present (screens: 012_clients.txt)
- ✅ Delete / remove site — present (screens: 012_clients.txt)
- ✅ Deactivate site (Active to Terminated) — present (screens: 012_clients.txt)
- ✅ Manage supplier distribution rule — present (screens: 012_clients.txt)
- ✅ Configure time capture method — present (screens: 012_clients.txt)
- ✅ View site spend and shift analytics — present (screens: 006_analytics.txt, 012_clients.txt)
- ✅ View site requisitions — present (screens: 007_requisitions.txt, 012_clients.txt)
- ✅ View site workforce — present (screens: 012_clients.txt)
- ✅ View site audit log — present (screens: 012_clients.txt)
- ⚠️ Archive site — partial (auto-archive event in audit log for Terminated sites; no explicit user-initiated archive action)
- ⚠️ Manage site rate card — partial (Rate card accordion section present; no direct edit confirmed at site level in walk)
- ⚠️ Invite suppliers to cover a site — partial (audit log event and org-tree action evidenced; no standalone invite-supplier workflow in walk screens)
- ⚠️ Bulk-export sites — partial (Export in bulk-action bar; output format and scope not confirmed)
- ⚠️ Assign site to org hierarchy (region / district) — partial (region field in create/edit schema; no explicit re-parent action evidenced)
- ❌ Suspend site (temporary hold) — missing (no Suspended state in filter options; VMS commonly needs reversible closure distinct from Terminated)
- ❌ Reactivate suspended site — missing (depends on Suspended state, which is absent)

**Coverage:** 13 / 20 present (5 partial, 2 missing)

---

## Requisition — A staffing order that captures the job, scope, rate, location, dates, and approvals for one or more non-employee positions at a client site.

**Lifecycle states:** draft → pending_approval → booked → in_progress → completed / cancelled / closed
  (observed: booked, in_progress, completed; expected-but-unseen: draft, pending_approval, cancelled, closed)

**Capabilities:**
- ✅ Create requisition — present (screens: 101_12855275.js, 063_a7975662.js)
- ✅ Create from template — present (screens: 101_12855275.js)
- ✅ Bulk import via CSV — present (screens: 035_3460da2b.js, 036_20fda665.js)
- ✅ View requisition list — present (screens: 007_requisitions.txt, 063_a7975662.js)
- ✅ View requisition detail — present (screens: 017–024_requisition.txt, 040_7ae677d6.js)
- ✅ Search and filter requisitions — present (screens: 007_requisitions.txt, 063_a7975662.js)
- ✅ Edit requisition — present (screens: 017_requisition-k1l2m3n4o5.txt, 040_7ae677d6.js)
- ✅ Reassign requisition owner — present (screens: 063_a7975662.js)
- ✅ Duplicate requisition — present (screens: 063_a7975662.js, 040_7ae677d6.js)
- ✅ Approve or reject requisition — present (screens: 042_ad2ed281.js, 054_8882fd1b.js)
- ✅ Cancel requisition — present (screens: 007_requisitions.txt, 040_7ae677d6.js, 063_a7975662.js)
- ✅ Distribute / broadcast to suppliers — present (screens: 040_7ae677d6.js, 063_a7975662.js)
- ✅ Manage supplier distribution rules per requisition — present (screens: 040_7ae677d6.js, 017_requisition-k1l2m3n4o5.txt)
- ✅ View requisition activity log — present (screens: 017_requisition-k1l2m3n4o5.txt, 040_7ae677d6.js)
- ✅ Export requisition — present (screens: 040_7ae677d6.js, 063_a7975662.js)
- ✅ View fulfillment progress — present (screens: 007_requisitions.txt, 063_a7975662.js)
- ⚠️ Submit requisition for approval — partial (approval workflow fully built in source; explicit submit button not visible in rendered new-requisition form)
- ⚠️ Reschedule requisition dates — partial (bulk overflow action is a toast placeholder; no single-requisition reschedule UI)
- ❌ Delete requisition — missing (no delete action; Cancel is the only destructive option after submission)
- ❌ Archive requisition — missing (no archive action or archived-status filter; needed for audit history without cluttering active views)

**Coverage:** 16 / 20 present (2 partial, 2 missing)

---

## Work Assignment — The record that binds a specific worker to a specific shift, tracking the engagement from acceptance through clock-out.

**Lifecycle states:** open → invited → confirmed → enroute / soon → floor → break → wrapping → closed / flagged / no_show / cancelled
  (observed: open, enroute, soon, floor, break, wrapping, flagged, closed; expected-but-unseen: invited, confirmed, no_show, cancelled)

**Capabilities:**
- ✅ View work assignment detail — present (screens: 022_ts-91239.txt, 017_requisition-k1l2m3n4o5.txt)
- ✅ Create work assignment (assign worker to shift) — present (screens: 017_requisition-k1l2m3n4o5.txt)
- ✅ Edit work assignment details — present (screens: 017_requisition-k1l2m3n4o5.txt)
- ✅ Cancel work assignment — present (screens: 017_requisition-k1l2m3n4o5.txt)
- ✅ Remove worker (unassign) from work assignment — present (screens: 022_ts-91239.txt)
- ✅ Clock in worker (manual override) — present (screens: 022_ts-91239.txt)
- ✅ Edit clock-in time — present (screens: 022_ts-91239.txt)
- ✅ Clock out worker (force end shift) — present (screens: 022_ts-91239.txt)
- ✅ Mark worker no-show — present (screens: 009_timesheets.txt)
- ✅ Add time / back-date time entry — present (screens: 022_ts-91239.txt)
- ✅ Report worker (safety/conduct flag) — present (screens: 009_timesheets.txt)
- ✅ Remove worker with reason code and backfill option — present (screens: 022_ts-91239.txt)
- ✅ View work assignment audit / timeline log — present (screens: 022_ts-91239.txt)
- ⚠️ View work assignment list — partial (assignments visible via Timesheets list and requisition tab; no dedicated standalone list)
- ⚠️ Invite worker via agency (automatic worker invitation) — partial (Agency Pro plan feature referenced; invited/confirmed states not directly evidenced in rendered walk)
- ⚠️ Extend assignment duration — partial (audit log entry references extension; no dedicated extend UI control evidenced)
- ❌ Delete work assignment record — missing (no delete affordance for unfilled or mistakenly created assignments)
- ❌ Archive / close completed work assignments in bulk — missing (no bulk archive or batch-close for past assignments)

**Coverage:** 13 / 18 present (3 partial, 2 missing)

---

## Worker — A non-employee individual (agency labor, contractor, consultant, or EOR worker) whose identity, eligibility, skills, and engagement history are tracked in the system.

**Lifecycle states:** Invited → Onboarding → Compliant → Active → On Assignment / On Leave / Credential Watch/Expired → Offboarding → Inactive / Terminated
  (observed: Invited, Onboarding, Compliant, Active, On Assignment, On Leave, Offboarding, Inactive, Terminated; expected-but-unseen: Credential Watch / Expired)

**Capabilities:**
- ✅ List and search workers — present (screens: 011_workforce.txt)
- ✅ View worker detail — present (screens: 011_workforce.txt, 022_ts-91239.txt, 023_invoice-inv-a1b2c3d4.txt)
- ✅ Invite / add worker — present (screens: 011_workforce.txt, 054_internal-help-center.txt)
- ✅ Onboard worker — present (screens: 054_internal-help-center.txt, 011_workforce.txt)
- ✅ Offboard worker — present (screens: 054_internal-help-center.txt)
- ✅ Assign worker to shift / requisition — present (screens: 008_schedule.txt, 011_workforce.txt)
- ✅ View worker credential / compliance status — present (screens: 011_workforce.txt, 054_internal-help-center.txt)
- ✅ View worker engagement history (shifts, timesheets) — present (screens: 009_timesheets.txt, 022_ts-91239.txt, 023_invoice-inv-a1b2c3d4.txt)
- ✅ Archive / deactivate worker record — present (screens: 054_internal-help-center.txt)
- ⚠️ Edit worker profile — partial (rate-edit and custom-field controls in source; no dedicated edit screen walked; float profiles are read-only)
- ⚠️ Message worker — partial (quick action on schedule row menu; no rendered messaging screen captured)
- ⚠️ Flag worker as Do-Not-Return (DNR) — partial (DNR offboarding task item in source; no dedicated DNR UI screen observed)
- ⚠️ Transition worker through lifecycle states — partial (most transitions evidenced; On Leave and Credential Watch/Expired re-activation screens not found)
- ⚠️ Convert worker to permanent employee — partial (conversion workflow referenced in source; full conversion-to-perm screen not captured)
- ❌ Delete / permanently remove worker record — missing (no delete action; expected for GDPR Art. 17 data-subject erasure requests)
- ❌ Rate / score worker after engagement — missing (no rating or scoring UI; redeployment rate is called out as highest-leverage metric)

**Coverage:** 9 / 16 present (5 partial, 2 missing)
