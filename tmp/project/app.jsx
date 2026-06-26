// =====================================================================
// Flex Work — Root component
// Routes between pages based on the current global-nav selection.
// =====================================================================

const { useState, useEffect, useCallback } = React;

function App() {
  // Sign-in session. Default to a logged-in Admin so the demo lands
  // straight on the Dashboard; the login screen is only reached after
  // an explicit Sign-out. If the active industry pack is an Agency,
  // default the role to Agency (Admin/Manager/MSP don't exist there).
  const _defOrgId = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  const _defOrgIsAgency = !!(window.isAgencyOrg && window.isAgencyOrg(_defOrgId));
  const DEFAULT_SESSION = {
    username: _defOrgIsAgency ? "jordan.lee" : "amy.chen",
    email:    _defOrgIsAgency ? "jordan.lee@staffwise.com" : "amy.chen@dayforce.com",
    role:     _defOrgIsAgency ? "agency" : "admin",
    orgId:    _defOrgId,
    name:     _defOrgIsAgency ? "Jordan Lee" : "Amy Chen",
  };
  const [session, setSession] = useState(DEFAULT_SESSION);
  // Expose viewAsRole globally so page-level components can branch on it
  // without prop-drilling. App writes it on every render; pages read via
  // window.flexViewAsRole and re-read on reloadKey changes.
  const handleSignIn  = useCallback(({ username, email, orgId, role }) => {
    if (orgId && window.setCurrentIndustryId) window.setCurrentIndustryId(orgId);
    // The chosen industry takes effect on the next module-load. Reload so
    // the data files re-evaluate their localize transforms cleanly.
    setSession({
      username,
      email,
      orgId: orgId || "manufacturing",
      role:  role  || "admin",
      // Pretty display name derived from username (e.g. "amy.chen" -> "Amy Chen").
      name: (username || "")
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    });
    setCurrent("dashboard");
    // Defer reload so the state update has a chance to commit (and so
    // the toast on sign-in has a chance to register before refresh).
    setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 50);
  }, []);
  const handleSignOut = useCallback(() => {
    showToast("Signed out", { kind: "success" });
    setSession(null);
  }, []);

  const [navOpen, setNavOpen] = useState(false);
  const [current, setCurrent] = useState("dashboard");
  // Platform shell presentation. "standalone" = the original Flex Work
  // chrome; "embedded" = Flex Work nested as a module inside the
  // Dayforce platform shell (1st-tier module rail + docked 2nd-tier
  // Flex Work nav). Persisted so the demo toggle survives reloads.
  const [shellMode, setShellModeState] = useState(
    () => (window.getShellMode ? window.getShellMode() : "embedded")
  );
  // Which Dayforce module the 1st-tier rail has selected. Only
  // "flexwork" is a live module; any other id shows a platform
  // placeholder. Ignored entirely in standalone mode.
  const [activeModule, setActiveModule] = useState("flexwork");

  // ---- Platform shell controls (DEMO-ONLY) ----------------------------
  // All Dayforce modules are enabled. Flex Work is the only fully-built
  // module; selecting any other one routes to its platform placeholder so
  // the rail reads as real platform IA. Nothing is gated off.
  const handleModuleSelect = useCallback((id) => {
    setActiveModule(id || "flexwork");
    setNavOpen(false);
  }, []);
  // Toggle the Standalone / Embedded demo presentation. This is purely a
  // demo affordance — not a shippable setting.
  const handleChangeShellMode = useCallback((mode) => {
    if (mode !== "standalone" && mode !== "embedded") return;
    if (window.setShellMode) window.setShellMode(mode);
    setShellModeState(mode);
    if (mode === "embedded") setActiveModule("flexwork");
    showToast(
      mode === "embedded" ? "Embedded — Flex Work inside Dayforce" : "Standalone — Flex Work on its own",
      { kind: "success" }
    );
  }, []);
  // Mirror to window so other surfaces can branch on the shell mode.
  useEffect(() => {
    window.flexShellMode = shellMode;
    return () => { if (window.flexShellMode === shellMode) window.flexShellMode = null; };
  }, [shellMode]);
  // Collapse state for the two embedded sidebars (persisted). The
  // Dayforce rail collapses to hidden; the Flex Work 2nd-tier nav
  // collapses to an icon-only strip.
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return window.localStorage.getItem("flexwork.railCollapsed") === "true"; } catch (e) { return false; }
  });
  const [subNavCollapsed, setSubNavCollapsed] = useState(() => {
    try { return window.localStorage.getItem("flexwork.subNavCollapsed") === "true"; } catch (e) { return false; }
  });
  const toggleRail = useCallback(() => {
    setRailCollapsed((v) => {
      const n = !v;
      try { window.localStorage.setItem("flexwork.railCollapsed", String(n)); } catch (e) {}
      return n;
    });
  }, []);
  const toggleSubNav = useCallback(() => {
    setSubNavCollapsed((v) => {
      const n = !v;
      try { window.localStorage.setItem("flexwork.subNavCollapsed", String(n)); } catch (e) {}
      return n;
    });
  }, []);
  // "Viewing as" — admin sees the full org; manager sees only their locations.
  // Defaults from the session role; can be toggled from the AppNav.
  const [viewAsRole, setViewAsRole] = useState(DEFAULT_SESSION.role);
  // Worker mobile preview — a side-docked iPhone that overlays the right
  // edge of the screen. Independent of viewAsRole so the admin can keep
  // the desktop UI in context while watching the worker side update.
  const [workerPanelOpen, setWorkerPanelOpen] = useState(false);
  // Manager mobile preview — same docked-iPhone pattern as the worker
  // preview, but rendering the manager-side mobile experience (today's
  // standup, approvals, open requisitions, team). Independent of
  // viewAsRole so admins can keep the desktop UI open alongside.
  const [managerPanelOpen, setManagerPanelOpen] = useState(false);
  // Mirror to window so chrome can show the check icon on the Worker
  // menu row without prop-drilling through AppNav.
  useEffect(() => {
    window.flexWorkerPanelOpen = workerPanelOpen;
    return () => { if (window.flexWorkerPanelOpen === workerPanelOpen) window.flexWorkerPanelOpen = null; };
  }, [workerPanelOpen]);
  useEffect(() => {
    window.flexManagerPanelOpen = managerPanelOpen;
    return () => { if (window.flexManagerPanelOpen === managerPanelOpen) window.flexManagerPanelOpen = null; };
  }, [managerPanelOpen]);
  // Expose on window so leaf pages (Requisitions, Locations, etc.) can
  // branch on it without prop-drilling through every page wrapper.
  useEffect(() => {
    window.flexViewAsRole = viewAsRole;
    return () => { if (window.flexViewAsRole === viewAsRole) window.flexViewAsRole = null; };
  }, [viewAsRole]);
  // Empty array = "all my locations" (no filter)
  const [selectedLocIds, setSelectedLocIds] = useState([]);
  // Two-level global nav: "main" shows the org card + primary modules.
  // "settings" shows the Settings sub-nav (tabs) inside the same dock.
  const [gnView, setGnView] = useState("main");
  // Active Settings tab when on the Settings page.
  const [settingsTab, setSettingsTab] = useState("policies");
  // Active Analytics tab when on the Analytics page.
  const [analyticsTab, setAnalyticsTab] = useState("overview");
  // sub-view for requisitions: "list" | "new" | "review" | "details"
  const [reqView, setReqView] = useState("list");
  const [reqId, setReqId] = useState(null);
  // sub-view for invoices: "list" | "details"
  const [invView, setInvView] = useState("list");
  const [invId, setInvId] = useState(null);
  // sub-view for suppliers: "list" | "details"
  const [supView, setSupView] = useState("list");
  const [supId, setSupId] = useState(null);
  // sub-view for locations: "list" | "details" | "orgNode"
  //   - "orgNode" renders an OrgNodeDetailsPage for an Entity, Division,
  //     Sector, or Cost Center (anything in the hierarchy that isn't a
  //     plain Location, which has its own dedicated page).
  const [locView, setLocView] = useState("list");
  const [locId, setLocId] = useState(null);
  const [orgNodeId, setOrgNodeId] = useState(null);
  // sub-view for workforce: "list" | "details"
  const [wfView, setWfView] = useState("list");
  const [wfId, setWfId] = useState(null);
  // sub-view for timesheets: "list" | "details"
  const [tsView, setTsView] = useState("list");
  const [tsId, setTsId] = useState(null);
  // sub-view for schedule: "list" | "booking" | "shift"
  const [schView, setSchView] = useState("list");
  const [schId, setSchId] = useState(null);
  const [schShiftId, setSchShiftId] = useState(null);
  // Optional landing filter for the schedule page (e.g. "priority" |
  // "now"). Cleared on every nav.
  const [schFilter, setSchFilter] = useState(null);
  // Optional landing day-key (e.g. "apr-24") so the home calendar can
  // deep-link straight into a specific day's detail view. Cleared on
  // every nav so subsequent moves don't pin the user back to that day.
  const [schDayKey, setSchDayKey] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Bumped when the active country changes — re-keys the entire app-body
  // so GlobalNav (org chip) and all pages pick up the new currency,
  // regulations, and country flag. See pages/countries.jsx:applyCountryInstant.
  const [ctxVersion, setCtxVersion] = useState(0);
  useEffect(() => {
    window.__bumpFlexContext = () => {
      setCtxVersion((v) => v + 1);
      setReloadKey((k) => k + 1);
    };
    return () => { if (window.__bumpFlexContext) window.__bumpFlexContext = null; };
  }, []);

  // ---- Back-navigation history ----------------------------------------
  // Captures a snapshot of the navigation-relevant state right before a
  // cross-page jump (flexGoTo). Detail pages can call `handleGoBack` to
  // pop the latest snapshot so "Back" returns to the prior screen rather
  // than blindly resetting to the section's list view.
  const navHistoryRef = React.useRef([]);
  const stateRef = React.useRef({});
  // Keep stateRef in sync with the latest committed state so the snapshot
  // captured inside handleGoTo reflects "where we were" at call time.
  useEffect(() => {
    stateRef.current = {
      current, reqView, reqId, invView, invId, supView, supId,
      locView, locId, orgNodeId, wfView, wfId, tsView, tsId,
      schView, schId, schShiftId, schFilter, schDayKey,
      settingsTab, analyticsTab, gnView,
    };
  });

  const applySnapshot = useCallback((s) => {
    if (!s) return;
    setCurrent(s.current);
    setReqView(s.reqView); setReqId(s.reqId);
    setInvView(s.invView); setInvId(s.invId);
    setSupView(s.supView); setSupId(s.supId);
    setLocView(s.locView); setLocId(s.locId); setOrgNodeId(s.orgNodeId || null);
    setWfView(s.wfView);   setWfId(s.wfId);
    setTsView(s.tsView);   setTsId(s.tsId);
    setSchView(s.schView); setSchId(s.schId); setSchShiftId(s.schShiftId);
    setSchFilter(s.schFilter); setSchDayKey(s.schDayKey);
    setSettingsTab(s.settingsTab);
    setAnalyticsTab(s.analyticsTab || "overview");
    setGnView(s.gnView);
    setNavOpen(false);
  }, []);

  const handleGoBack = useCallback(() => {
    const stack = navHistoryRef.current;
    if (stack.length === 0) return false;
    const prev = stack.pop();
    applySnapshot(prev);
    return true;
  }, [applySnapshot]);

  const handleSelect = useCallback((id) => {
    // Settings is a two-step navigation: the first click expands the
    // sub-menu inside the global nav but DOES NOT navigate away from
    // the current page. The user picks a specific Settings tab to
    // actually load the Settings surface. This avoids loading a
    // Settings tab the user hasn't chosen yet, and keeps their
    // current context intact if they back out of the sub-menu.
    if (id === "settings") {
      setGnView("settings");
      return;
    }
    // Reset back-history — switching modules via the global nav is a
    // hard navigation, not a sub-flow.
    navHistoryRef.current = [];
    setCurrent(id);
    setReqView("list");
    setReqId(null);
    setInvView("list");
    setInvId(null);
    setSupView("list");
    setSupId(null);
    setLocView("list");
    setLocId(null);
    setOrgNodeId(null);
    setWfView("list");
    setWfId(null);
    setTsView("list");
    setTsId(null);
    setSchView("list");
    setSchId(null);
    setSchShiftId(null);
    setSchFilter(null);
    setSchDayKey(null);
    setReloadKey((k) => k + 1);
    setGnView("main");
    setNavOpen(false);
  }, []);

  // Cross-page navigation. Accepts { page, sub?, id? } so the dashboard
  // (and chrome) can jump straight into an existing screen.
  const handleGoTo = useCallback((target) => {
    if (!target) return;
    const { page, sub, id, filter, dayKey, replace } = typeof target === "string" ? { page: target } : target;
    if (!page) return;
    // Capture where we were so the destination's "Back" can return here.
    // `replace: true` opts out (used by handleGoBack itself).
    if (!replace) {
      const snap = { ...stateRef.current };
      navHistoryRef.current.push(snap);
      // Cap the stack so a long session can't grow unboundedly.
      if (navHistoryRef.current.length > 30) navHistoryRef.current.shift();
    }
    setCurrent(page);
    setNavOpen(false);
    setReloadKey((k) => k + 1);
    // reset sub-views, then set the one we want
    setReqView("list"); setReqId(null);
    setInvView("list"); setInvId(null);
    setSupView("list"); setSupId(null);
    setLocView("list"); setLocId(null); setOrgNodeId(null);
    setWfView("list"); setWfId(null);
    setTsView("list"); setTsId(null);
    setSchView("list"); setSchId(null); setSchShiftId(null);
    setSchFilter(null);
    setSchDayKey(null);
    if (page === "requisitions" && sub) { setReqView(sub); if (id != null) setReqId(id); }
    else if (page === "invoices"    && sub) { setInvView(sub); if (id != null) setInvId(id); }
    else if (page === "suppliers"   && sub) { setSupView(sub); if (id != null) setSupId(id); }
    else if (page === "locations"   && sub) { setLocView(sub); if (id != null) setLocId(id); }
    else if (page === "workforce"   && sub) { setWfView(sub);  if (id != null) setWfId(id); }
    else if (page === "timesheets"  && sub) { setTsView(sub);  if (id != null) setTsId(id); }
    else if (page === "schedule"    && sub) {
      setSchView(sub);
      if (sub === "shift") { if (id != null) setSchShiftId(id); }
      else                 { if (id != null) setSchId(id); }
    }
    if (page === "schedule" && filter) setSchFilter(filter);
    if (page === "schedule" && dayKey) setSchDayKey(dayKey);
    else if (page === "settings" && sub) { setSettingsTab(sub); }
    else if (page === "analytics" && sub) { setAnalyticsTab(sub); }
    else if (page === "analytics") { setAnalyticsTab("overview"); }
    // Sync the global-nav dock with the destination page.
    setGnView(page === "settings" ? "settings" : "main");
  }, []);

  // Expose the navigator on window so deeply-nested components (e.g. links
  // inside booking / shift heroes) can navigate without prop-drilling.
  useEffect(() => {
    window.flexGoTo = handleGoTo;
    window.flexGoBack = handleGoBack;
    return () => {
      if (window.flexGoTo === handleGoTo) window.flexGoTo = null;
      if (window.flexGoBack === handleGoBack) window.flexGoBack = null;
    };
  }, [handleGoTo, handleGoBack]);

  const handleReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Esc closes the drawer, and so does a pointer-down outside the panel
  // (ignoring the toggle button, which has its own handler).
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setNavOpen(false); };
    const onPointer = (e) => {
      const panel = document.getElementById("global-nav");
      if (panel && panel.contains(e.target)) return;
      // Don't fight the toggle button — let its own click flip the state.
      const toggle = e.target.closest && e.target.closest('[aria-controls="global-nav"]');
      if (toggle) return;
      setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [navOpen]);

  // Whenever the side bar transitions from open → closed, snap the dock
  // back to the main module list. A user who drilled into Settings,
  // picked a tab, and dismissed the drawer will see the primary nav
  // (not the Settings sub-list) the next time they open it — matching
  // every other module, which doesn't persist a sub-view across
  // reopens. Tracked via a ref so we only fire on the actual close
  // transition, not on direct navigations (e.g. avatar-menu → Settings)
  // that set gnView="settings" while navOpen is already false.
  const navWasOpenRef = React.useRef(false);
  useEffect(() => {
    if (navWasOpenRef.current && !navOpen) {
      // Defer until the close transition finishes so the subsection's
      // contents animate out cleanly before the dock swaps modes.
      const t = setTimeout(() => setGnView("main"), 220);
      navWasOpenRef.current = navOpen;
      return () => clearTimeout(t);
    }
    navWasOpenRef.current = navOpen;
  }, [navOpen]);

  // Subscribe to the agencyPro feature flag so flipping it from the
  // Tweaks panel (or Settings → Feature Flags) re-renders App and swaps
  // the agency-pro route override below in place — no reload needed.
  if (typeof window !== "undefined" && window.useFeatureFlag) {
    window.useFeatureFlag("agencyPro");
  }

  let pageEl = null;
  if (current === "dashboard" || current === "inbox" || current === "insights" || current === "compliance" || current === "credentialing") {
    pageEl = (
      <DashboardPage
        reloadKey={reloadKey}
        onReload={handleReload}
        onGoTo={handleGoTo}
        sessionName={session.name}
        viewAsRole={viewAsRole}
        locationIds={selectedLocIds}
        tab={current === "dashboard" ? "overview" : (current === "credentialing" ? "compliance" : current)}
      />
    );
  } else if (current === "userProfile") {
    pageEl = <UserProfilePage onReload={handleReload} onGoTo={handleGoTo} />;
  } else if (current === "userSettings") {
    pageEl = <UserSettingsPage onGoTo={handleGoTo} />;
  } else if (current === "helpCenter") {
    pageEl = <HelpCenterPage onGoTo={handleGoTo} />;
  } else if (current === "requisitions") {
    if (reqView === "new") {
      pageEl = (
        <NewRequisitionPage
          onBack={() => setReqView("list")}
          onReview={() => setReqView("review")}
        />
      );
    } else if (reqView === "review") {
      pageEl = (
        <ReviewRequisitionPage
          onBack={() => setReqView("new")}
          onOrder={(newId) => {
            if (newId) {
              setReqId(newId);
              setReqView("details");
            } else {
              setReqView("list");
              handleReload();
            }
          }}
        />
      );
    } else if (reqView === "details") {
      // Unified requisition / engagement detail router. With all
      // worker-type flags off, the router dispatches straight to the
      // Frontline RequisitionDetailsPage — pixel-identical to the
      // pre-unification ship. When a variant flag is on AND the id
      // routes to that variant's channel, the variant body renders
      // instead. See pages/requisition-engagement-detail.jsx.
      const Detail = (window.RequisitionEngagementDetail || RequisitionDetailsPage);
      pageEl = (
        <Detail
          requisitionId={reqId}
          onBack={() => { setReqView("list"); setReqId(null); }}
        />
      );
    } else {
      pageEl = (
        <RequisitionsPage
          reloadKey={reloadKey}
          onReload={handleReload}
          onCreate={() => setReqView("new")}
          onOpenRow={(id) => { setReqId(id); setReqView("details"); }}
        />
      );
    }
  } else if (current === "workforce") {
    if (wfView === "details") {
      pageEl = (
        <WorkerDetailsPage
          workerId={wfId}
          onBack={() => { setWfView("list"); setWfId(null); }}
        />
      );
    } else {
      pageEl = (
        <WorkforcePage
          reloadKey={reloadKey}
          onReload={handleReload}
          onOpenRow={(id) => { setWfId(id); setWfView("details"); }}
        />
      );
    }
  } else if (current === "timesheets") {
    if (tsView === "details") {
      pageEl = (
        <TimesheetDetailsPage
          timesheetId={tsId}
          onBack={() => { setTsView("list"); setTsId(null); }}
        />
      );
    } else {
      pageEl = (
        <TimesheetsPage
          reloadKey={reloadKey}
          onReload={handleReload}
          onOpenRow={(id) => { setTsId(id); setTsView("details"); }}
        />
      );
    }
  } else if (current === "schedule") {
    if (schView === "shift") {
      pageEl = (
        <ShiftDetailsPage
          shiftId={schShiftId}
          onBack={() => {
            if (handleGoBack()) return;
            setSchView("booking"); setSchShiftId(null);
          }}
          onOpenBooking={(id) => { setSchId(id); setSchView("booking"); setSchShiftId(null); }}
        />
      );
    } else if (schView === "booking") {
      pageEl = (
        <BookingDetailsPage
          bookingId={schId}
          onBack={() => {
            if (handleGoBack()) return;
            setSchView("list"); setSchId(null);
          }}
          onOpenBooking={(id) => { setSchId(id); setSchView("booking"); setSchShiftId(null); setReloadKey((k) => k + 1); }}
          onOpenShift={(id) => {
            // Capture the current booking state so Back from the shift
            // returns here, not to whatever opened the booking.
            navHistoryRef.current.push({ ...stateRef.current });
            if (navHistoryRef.current.length > 30) navHistoryRef.current.shift();
            setSchShiftId(id);
            setSchView("shift");
          }}
        />
      );
    } else {
      pageEl = (
        <SchedulePage
          reloadKey={reloadKey}
          onReload={handleReload}
          onOpenBooking={(id) => { setSchId(id); setSchView("booking"); }}
          onOpenShift={(id) => {
            // Capture current state so Back from the shift returns here.
            navHistoryRef.current.push({ ...stateRef.current });
            if (navHistoryRef.current.length > 30) navHistoryRef.current.shift();
            setSchShiftId(id);
            setSchView("shift");
          }}
          viewAsRole={viewAsRole}
          locationIds={selectedLocIds}
          initialFilter={schFilter}
          initialDayKey={schDayKey}
        />
      );
    }
  } else if (current === "locations") {
    if (locView === "orgNode") {
      // Entity / Division / Sector / Cost Center detail page. Navigates
      // between nodes via onOpenChild; falling back to the list when the
      // user pops back from a top-level node.
      const openOrg = (node) => {
        if (node && node.segment === "Locations") {
          // A Location node falls through to the dedicated Location
          // details page (which has the existing rich accordion UX).
          setOrgNodeId(null);
          setLocId(node.id);
          setLocView("details");
          return;
        }
        setOrgNodeId(node ? node.id : null);
        setLocView("orgNode");
      };
      pageEl = (
        <OrgNodeDetailsPage
          nodeId={orgNodeId}
          onBack={() => { setLocView("list"); setOrgNodeId(null); }}
          onOpenChild={openOrg}
        />
      );
    } else if (locView === "details") {
      pageEl = (
        <LocationDetailsPage
          locationId={locId}
          onBack={() => { setLocView("list"); setLocId(null); }}
        />
      );
    } else {
      pageEl = (
        <LocationsPage
          reloadKey={reloadKey}
          onReload={handleReload}
          onOpenRow={(id) => { setLocId(id); setLocView("details"); }}
          onOpenOrgNode={(id) => { setOrgNodeId(id); setLocView("orgNode"); }}
        />
      );
    }
  } else if (current === "suppliers") {
    if (supView === "invite") {
      pageEl = (
        <SupplierContractWizard
          mode="invite"
          onCancel={() => setSupView("list")}
          onComplete={() => { setSupView("list"); handleReload(); }}
        />
      );
    } else if (supView === "editContract") {
      pageEl = (
        <SupplierContractWizard
          mode="edit"
          supplierId={supId}
          onCancel={() => setSupView("details")}
          onComplete={() => setSupView("details")}
        />
      );
    } else if (supView === "details") {
      pageEl = (
        <SupplierDetailsPage
          supplierId={supId}
          onBack={() => { setSupView("list"); setSupId(null); }}
          onEditContract={(id) => { setSupId(id); setSupView("editContract"); }}
        />
      );
    } else {
      pageEl = (
        <SuppliersPage
          reloadKey={reloadKey}
          onReload={handleReload}
          onOpenRow={(id) => { setSupId(id); setSupView("details"); }}
          onInvite={() => setSupView("invite")}
        />
      );
    }
  } else if (current === "invoices") {
    if (invView === "details") {
      pageEl = (
        <InvoiceDetailsPage
          invoiceId={invId}
          onBack={() => { setInvView("list"); setInvId(null); }}
        />
      );
    } else {
      pageEl = (
        <InvoicesPage
          reloadKey={reloadKey}
          onReload={handleReload}
          onOpenRow={(id) => { setInvId(id); setInvView("details"); }}
        />
      );
    }
  } else if (current === "settings") {
    pageEl = (
      <SettingsPage
        reloadKey={reloadKey}
        onReload={handleReload}
        onGoTo={handleGoTo}
        currentTab={settingsTab}
      />
    );
  } else if (current === "analytics") {
    pageEl = (
      <AnalyticsPage
        reloadKey={reloadKey}
        onReload={handleReload}
        onGoTo={handleGoTo}
        currentTab={analyticsTab}
      />
    );
  } else if (current === "contractors") {
    // Legacy /contractors route — kept only as a redirect target for
    // stale sessions. Per the universal-scopes rule (no per-engagement-
    // type routes) this page no longer exists in the IA: contractor
    // records surface inside Workforce (pool + Engagements section) and
    // inside Requisitions (via EngagementScope). Render the Workforce
    // hub so users land on a working surface.
    pageEl = (
      <WorkforcePage
        reloadKey={reloadKey}
        onReload={handleReload}
        onOpenRow={(id) => { setWfId(id); setWfView("details"); setCurrent("workforce"); }}
      />
    );
  } else {
    // Stub for other nav items
    const stubTitle = (NAV_ITEMS.find((i) => i.id === current) || {}).label || "";
    const stubIcon  = (NAV_ITEMS.find((i) => i.id === current) || {}).icon  || "Performance";
    pageEl = (
      <React.Fragment>
        <Omnibar icon={stubIcon} title={stubTitle}>
          <button type="button" className="iconbtn" onClick={handleReload} aria-label="Reload content" title="Reload">
            <Icon name="Refresh" size={18} />
          </button>
        </Omnibar>
        <div className="content-section" key={reloadKey}>
          <section className="content-card">
            <div className="empty">
              <img
                src="assets/illustrations/Rocketship.svg"
                alt=""
                role="presentation"
                width="180"
                height={Math.round(180 * (202 / 224))}
              />
              <h2 className="empty-title">{stubTitle} is launching soon!</h2>
              <p className="empty-body">
                We&rsquo;re still working on this page and will be launching it soon.
              </p>
            </div>
          </section>
        </div>
      </React.Fragment>
    );
  }

  // ---- Platform shell (demo-only presentation) ------------------------
  // NOTE: `shellMode` is a DEMO TOGGLE ONLY. It exists so we can show
  // stakeholders how Flex Work would sit as a module inside the Dayforce
  // platform shell versus running on its own. It is NOT a shippable
  // setting and no product behaviour should ever be gated on it.
  const embedded     = shellMode === "embedded";
  const dfModuleOpen = embedded && activeModule !== "flexwork";
  const appClass = [
    "app",
    embedded ? "app--embedded" : "",
    dfModuleOpen ? "app--df-module" : "",
    embedded && subNavCollapsed ? "app--subnav-collapsed" : "",
    (workerPanelOpen || managerPanelOpen) ? "app--with-worker-panel" : "",
  ].filter(Boolean).join(" ");

  // When a non-Flex-Work Dayforce module is selected from the rail, show
  // its platform placeholder instead of the Flex Work app body.
  if (dfModuleOpen && window.DfModulePlaceholder) {
    pageEl = (
      <window.DfModulePlaceholder
        moduleId={activeModule}
        onGoFlexWork={() => handleModuleSelect("flexwork")}
      />
    );
  }

  // Show login screen when there is no active session.
  if (!session) {
    return <LoginScreen onSignIn={handleSignIn} />;
  }

  return (
    <div className={appClass}>
      <AppNav
        navOpen={navOpen}
        embedded={embedded}
        onBrandClick={() => handleModuleSelect("home")}
        onToggleRail={toggleRail}
        railCollapsed={railCollapsed}
        shellMode={shellMode}
        onChangeShellMode={handleChangeShellMode}
        onToggleNav={() => setNavOpen((v) => !v)}
        onGoTo={handleGoTo}
        onSignOut={handleSignOut}
        sessionRole={session.role}
        sessionName={session.name}
        viewAsRole={viewAsRole}
        onChangeViewAs={(r) => {
          // "Worker" is a side-panel preview rather than a full role
          // switch. Pop the iPhone open and leave the rest of the app
          // untouched so the manager can see both surfaces at once.
          if (r === "worker") {
            setWorkerPanelOpen(true);
            showToast("Opened worker mobile preview", { kind: "success" });
            return;
          }
          if (r === "manager-mobile") {
            // Manager mobile preview — same side-docked iPhone treatment
            // as the worker preview, but for the manager experience.
            // Leaves viewAsRole untouched so the desktop chrome stays in
            // place alongside the phone.
            setManagerPanelOpen(true);
            showToast("Opened manager mobile preview", { kind: "success" });
            return;
          }
          if (r === viewAsRole) return;
          const label = r === "admin" ? "Admin" : r === "msp" ? "MSP" : r === "agency" ? "Agency" : "Manager";
          // Role swaps re-derive nav, sidebar tabs, data scope, and
          // settings access — show the loader overlay while the new
          // context applies so the visual flicker reads as intentional.
          if (window.showAppLoader) window.showAppLoader("Loading\u2026", `Viewing as ${label}`);
          setTimeout(() => {
            setViewAsRole(r);
            // Reset location scope when leaving manager mode
            if (r !== "manager") setSelectedLocIds([]);
            // Agency view hides Suppliers entirely; if we're on that page,
            // bounce to Home. Likewise reset Settings to a tab Agency can see.
            if (r === "agency") {
              if (current === "suppliers") {
                setCurrent("dashboard");
                setSupView("list"); setSupId(null);
              }
              // Agency settings dock — Agency Pro's v1 Settings tabs
              // (Plans, HCM Sync, Employees, Direct clients) have been
              // retired in favor of a Plan CARD inside Configuration.
              // The standard agency-visible tabs are the only ones
              // valid here.
              const agencyTabs = new Set(["policies","configuration","system","pricing","workflows","roles","users","feature-flags"]);
              if (!agencyTabs.has(settingsTab)) setSettingsTab("configuration");
            }
            // Hide loader on the next frame so the new React tree has
            // rendered under it before we fade it away.
            requestAnimationFrame(() => {
              if (window.hideAppLoader) window.hideAppLoader();
              showToast(`Viewing as ${label}`, { kind: "success" });
            });
          }, 650);
        }}
        selectedLocIds={selectedLocIds}
        onChangeSelectedLocs={(arr) => setSelectedLocIds(arr)}
      />
      {/* MSP cockpit scope bar — sticky banner under the AppNav. Renders
          only when viewAsRole === "msp". The host also drives DOM-level
          row tagging + injects a "Tenant" filter chip into every list's
          filter bar. See pages/msp-mode.jsx. */}
      {window.MSPHost && <window.MSPHost viewAsRole={viewAsRole} />}
      {/* The app-body intentionally does NOT carry a key={ctxVersion}.
          Re-keying the whole subtree forced an unmount/remount on every
          country change — visually flashing the GlobalNav drawer closed
          and triggering its slide-in animation again. Currency, region,
          and flag updates propagate cleanly through App's re-render
          (ctxVersion is bumped to trigger that re-render) plus the
          per-page reloadKey prop without touching React's reconciliation
          tree. See pages/countries.jsx:applyCountryInstant. */}
      <div className="app-body">
        {embedded && window.DfPrimaryRail && (
          <window.DfPrimaryRail
            activeId={activeModule}
            onSelect={handleModuleSelect}
            open={navOpen}
            onClose={() => setNavOpen(false)}
          />
        )}
        <GlobalNav
          open={embedded ? true : navOpen}
          embedded={embedded}
          collapsed={subNavCollapsed}
          onToggleCollapse={toggleSubNav}
          current={
            current === "inbox" || current === "insights" || current === "compliance" || current === "credentialing"
              ? "dashboard"
              : current
          }
          onSelect={handleSelect}
          viewAsRole={viewAsRole}
          selectedLocIds={selectedLocIds}
          onChangeSelectedLocs={(arr) => setSelectedLocIds(arr)}
          subsection={
            gnView === "settings"
              ? {
                  label: "Settings",
                  items: (() => {
                    const all = window.SETTINGS_SECTIONS || [];
                    // DEMO-ONLY — every Settings section is enabled by
                    // default. The prior orgOnly / feature-flag gating
                    // (Organizations was Dayforce-org-only; Custom Fields
                    // sat behind the off-by-default `customFields` flag)
                    // is intentionally bypassed so the full Settings IA
                    // is always visible. Role scoping (agency) below is
                    // a separate, deliberate IA and is preserved.
                    const flagFiltered = all;
                    if (viewAsRole === "agency") {
                      // Agency settings dock. Agency Pro's v1 four
                      // tabs (Plans, HCM Sync, Employees, Direct
                      // clients) have been retired — see the Plan
                      // CARD in Configuration (settings-config.jsx)
                      // for the replacement surface. The dock now
                      // shows only the standard agency-visible tabs.
                      const keep = new Set([
                        "policies", "configuration", "system",
                        "pricing", "workflows", "roles", "users",
                        "feature-flags", "custom-fields",
                      ]);
                      return flagFiltered.filter((s) => keep.has(s.id));
                    }
                    return flagFiltered;
                  })(),
                  currentId: settingsTab,
                  onSelect: (id) => {
                    setSettingsTab(id);
                    // Ensure we're actually on the Settings page when
                    // selecting a tab from the dock.
                    if (current !== "settings") setCurrent("settings");
                    setReloadKey((k) => k + 1);
                    setNavOpen(false);
                  },
                  onBack: () => setGnView("main"),
                }
              : gnView === "analytics"
              ? null
              : null
          }
        />
        <main className="page" role="main">
          {pageEl}
        </main>
      </div>
      <InteractionsHost />
      <EditEntityHost />
      <RemoveWorkerHost />
      <AssignWorkerHost />
      <DistroOverridePanelHost />
      <ScMarkupEditorHost />
      <ScRateCardEditorHost />
      <ScAgencyEditorHost />
      <ScContractTermsEditorHost />
      {window.ScFundingEditorHost && <window.ScFundingEditorHost />}
      <AddContractorPanelHost />
      {window.AddProfessionalPanelHost && <window.AddProfessionalPanelHost />}
      {window.RenewProfessionalPanelHost && <window.RenewProfessionalPanelHost />}
      {workerPanelOpen && (
        <WorkerMobileApp onExit={() => setWorkerPanelOpen(false)} />
      )}
      {managerPanelOpen && (
        <ManagerMobileApp onExit={() => setManagerPanelOpen(false)} />
      )}
      {window.AgencyProTweaks && <window.AgencyProTweaks />}
      {window.AIChatHost && <window.AIChatHost />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
