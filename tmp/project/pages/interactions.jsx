// =====================================================================
// Flex Work — Interaction primitives
// A small set of overlay components every page reuses to make buttons /
// links interactive. Each maps 1:1 to a real Everest pattern:
//   · Toast            → snackbar (depth-04 surface, dismissible)
//   · ActionMenu       → MoreVert / MoreHoriz popover (dense list of rows)
//   · FilterPopover    → checkbox list filter dropdown
//   · ConfirmDialog    → modal with scrim + 2-button footer
//   · NotificationsPanel → top-bar bell side panel
//
// One global event bus drives the host. Pages call helpers like
// `showToast()` / `openMenu(e, items)` — no prop drilling.
// =====================================================================

const { useState: useStateIx, useEffect: useEffectIx, useRef: useRefIx } = React;

// ---------- Tiny event bus ----------------------------------------------
const Interactions = {
  _l: { toast: [], menu: [], confirm: [], filter: [], notifs: [] },
  on(ev, fn) {
    (this._l[ev] = this._l[ev] || []).push(fn);
    return () => {this._l[ev] = this._l[ev].filter((f) => f !== fn);};
  },
  emit(ev, payload) {(this._l[ev] || []).forEach((fn) => fn(payload));}
};

// Public helpers — pages call these.
function showToast(message, opts = {}) {
  Interactions.emit("toast", { id: Date.now() + Math.random(), message, ...opts });
}
// `anchor` is a DOM node or { x, y } coordinates. `items` is an array of
// { icon, label, danger?, onClick? } — the menu auto-toasts the label if
// no onClick is supplied (good for "(Preview)" affordance).
function openMenu(anchor, items, opts = {}) {
  Interactions.emit("menu", { anchor, items, ...opts });
}
function openFilter(anchor, opts) {
  Interactions.emit("filter", { anchor, ...opts });
}
function openConfirm(opts) {
  Interactions.emit("confirm", opts);
}
// Opens the bell dropdown anchored to the passed DOM node (the bell button).
// Toggles closed if it's already open on the same anchor.
function openNotifications(anchor) {
  Interactions.emit("notifs", { open: true, anchor: anchor || null });
}
function openEditEntity(opts) {
  Interactions.emit("editEntity", opts);
}

// Copy text to clipboard with a toast fallback (clipboard may be unavailable
// inside the sandboxed iframe).
function copyToClipboard(text, successMsg = "Copied to clipboard") {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMsg),
        () => showToast(successMsg)
      );
    } else {
      showToast(successMsg);
    }
  } catch (e) {
    showToast(successMsg);
  }
}

// =====================================================================
// Host — listens to the bus, renders portals. Mount once in App.
// =====================================================================
function InteractionsHost() {
  const [toasts, setToasts] = useStateIx([]);
  const [menu, setMenu] = useStateIx(null);
  const [filter, setFilter] = useStateIx(null);
  const [confirm, setConfirm] = useStateIx(null);
  const [notifs, setNotifs] = useStateIx(null); // { anchor } | null

  useEffectIx(() => {
    const offs = [
    Interactions.on("toast", (t) => {
      setToasts((prev) => [...prev, t]);
      // Auto-dismiss after 3.5s.
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration || 3500);
    }),
    Interactions.on("menu", (m) => setMenu(m)),
    Interactions.on("filter", (f) => setFilter(f)),
    Interactions.on("confirm", (c) => setConfirm(c)),
    Interactions.on("notifs", (n) => {
      // Toggle: if already open against the same anchor, close it.
      setNotifs((prev) => {
        if (!n.open) return null;
        if (prev && prev.anchor === n.anchor) return null;
        return { anchor: n.anchor || null };
      });
    })];

    return () => offs.forEach((o) => o());
  }, []);

  return (
    <React.Fragment>
      <ToastRail toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
      {menu && <ActionMenu {...menu} onClose={() => setMenu(null)} />}
      {filter && <FilterPopover {...filter} onClose={() => setFilter(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      <NotificationsDropdown
        open={!!notifs}
        anchor={notifs && notifs.anchor}
        onClose={() => setNotifs(null)} />
      
    </React.Fragment>);

}

// =====================================================================
// Toast rail (bottom-center stack)
// =====================================================================
const TOAST_ICONS = {
  success: "Check",
  error: "Alert",
  info: "Information"
};

function ToastRail({ toasts, onDismiss }) {
  return (
    <div className="ix-toast-rail" aria-live="polite" aria-atomic="true">
      {toasts.map((t) =>
      <div key={t.id} className={`ix-toast ix-toast--${t.kind || "info"}`} role="status">
          <span className="ix-toast-icon" aria-hidden="true">
            <Icon name={TOAST_ICONS[t.kind || "info"]} size={18} />
          </span>
          <span className="ix-toast-msg">{t.message}</span>
          {t.action &&
        <button type="button" className="ix-toast-action" onClick={() => {t.action.onClick && t.action.onClick();onDismiss(t.id);}}>
              {t.action.label}
            </button>
        }
          <button type="button" className="ix-toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}
    </div>);

}

// =====================================================================
// Anchored popover positioning — used by ActionMenu + FilterPopover
// =====================================================================
function positionFor(anchor, width = 240, height = 0) {
  // anchor can be a DOM node or { x, y } point.
  // When `height` is supplied (post-measure), flip above the anchor if
  // the menu would overflow the viewport bottom — same logic the
  // submenu uses to flip horizontally. Without it we estimate
  // generously so the first paint is rarely off-screen.
  const vh = window.innerHeight;
  if (!anchor) return { top: 100, left: 100 };
  if (anchor.getBoundingClientRect) {
    const r = anchor.getBoundingClientRect();
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, r.left));
    const margin = 6;
    const h = height || 0;
    const below = vh - r.bottom - margin;
    const above = r.top - margin;
    // Flip up when we have measured a height that won't fit, OR when
    // the anchor is very close to the viewport bottom (heuristic for
    // unmeasured first paint, e.g. the bottom-pinned BulkActionBar).
    const shouldFlip = h > 0
      ? h > below && above > below
      : below < 200 && above > below;
    const top = shouldFlip
      ? Math.max(8, (h ? r.top - h - margin : r.top - 320))
      : r.bottom + margin;
    return { top, left };
  }
  const h = height || 0;
  const below = vh - anchor.y - 6;
  const top = h > 0 && h > below && anchor.y - h - 6 > 8
    ? anchor.y - h - 6
    : anchor.y + 6;
  return { top, left: Math.max(8, anchor.x - width / 2) };
}

function useDismissOnOutside(ref, onClose, ignoreSelector) {
  useEffectIx(() => {
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      // Allow callers to keep the popover open while another popover (e.g.
      // the country picker) is being interacted with — clicks inside the
      // matched selector are treated as "still inside".
      if (ignoreSelector && e.target && e.target.closest && e.target.closest(ignoreSelector)) return;
      onClose();
    };
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, ref, ignoreSelector]);
}

// =====================================================================
// Action menu (MoreVert / MoreHoriz popover)
// ---------------------------------------------------------------------
// Supports cascading submenus: an item with `children: [...]` opens a
// second `.ix-menu` to the right on hover (not click). The submenu uses
// the same item schema, so it can recurse.
// =====================================================================
function ActionMenu({ anchor, items, onClose, width = 240, ignoreOutsideSelector }) {
  const ref = useRefIx(null);
  const itemRefs = useRefIx({});
  const closeTimer = useRefIx(null);
  const [openSub, setOpenSub] = useStateIx(null); // { index, rect }
  const [measuredH, setMeasuredH] = useStateIx(0);
  useDismissOnOutside(ref, onClose, ignoreOutsideSelector);
  const pos = positionFor(anchor, width, measuredH);

  // After the menu mounts we know its real height — re-run positionFor
  // with that height so the flip-above logic is exact. Skip if we
  // already have a height that matches the current DOM.
  useEffectIx(() => {
    if (!ref.current) return;
    const h = ref.current.offsetHeight;
    if (h && h !== measuredH) setMeasuredH(h);
  }, [items, measuredH]);

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenSub(null), 140);
  };
  const cancelClose = () => {
    if (closeTimer.current) {clearTimeout(closeTimer.current);closeTimer.current = null;}
  };
  const openAt = (index) => {
    cancelClose();
    const el = itemRefs.current[index];
    if (!el) return;
    setOpenSub({ index, rect: el.getBoundingClientRect() });
  };

  return (
    <div className="ix-menu" ref={ref} style={{ top: pos.top, left: pos.left, width }} role="menu">
      {items.map((it, i) => {
        if (it.divider) return <div key={`d${i}`} className="ix-menu-divider" role="separator" />;
        if (it.header) return <div key={`h${i}`} className="ix-menu-header" role="presentation">{it.header}</div>;
        const hasChildren = Array.isArray(it.children) && it.children.length > 0;
        const isOpen = openSub && openSub.index === i;
        return (
          <button
            key={i}
            ref={(el) => {if (el) itemRefs.current[i] = el;}}
            type="button"
            role="menuitem"
            aria-haspopup={hasChildren ? "menu" : undefined}
            aria-expanded={hasChildren ? !!isOpen : undefined}
            className={`ix-menu-item${it.danger ? " ix-menu-item--danger" : ""}${isOpen ? " ix-menu-item--open" : ""}`}
            onMouseEnter={() => {if (hasChildren) openAt(i);else scheduleClose();}}
            onMouseLeave={() => {if (hasChildren) scheduleClose();}}
            onFocus={() => {if (hasChildren) openAt(i);}}
            onClick={(e) => {
              if (hasChildren) {
                // Click toggles the submenu open instead of dismissing.
                e.preventDefault();
                if (isOpen) setOpenSub(null);else openAt(i);
                return;
              }
              // `keepOpen` rows fire their action without dismissing the
              // parent menu — used when the action opens a sibling popover
              // (e.g. the country picker) that should coexist with the menu.
              if (!it.keepOpen) onClose();
              if (it.onClick) it.onClick();else
              showToast(`${it.label} — coming soon`);
            }}>
            
            {it.icon && <span className="ix-menu-icon" aria-hidden="true"><Icon name={it.icon} size={16} /></span>}
            <span className="ix-menu-label">{it.label}</span>
            {it.shortcut && <span className="ix-menu-shortcut">{it.shortcut}</span>}
            {hasChildren ?
            <span className="ix-menu-icon ix-menu-caret" aria-hidden="true"><Icon name="ChevronRight" size={16} /></span> :
            it.trailingIcon && <span className="ix-menu-icon" aria-hidden="true"><Icon name={it.trailingIcon} size={16} /></span>
            }
          </button>);

      })}
      {openSub && (() => {
        const it = items[openSub.index];
        if (!it || !Array.isArray(it.children)) return null;
        return (
          <ActionSubmenu
            parentRect={openSub.rect}
            items={it.children}
            width={it.submenuWidth || 220}
            onClose={() => {setOpenSub(null);onClose();}}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose} />);


      })()}
    </div>);

}

// Cascading submenu — a separate menu surface anchored to the right edge
// of its parent item. Flips to the left if it would clip the viewport.
// Supports its own nested children so a row can fan out into a sub-
// submenu (e.g. Viewing as → Manager → Web / Mobile).
function ActionSubmenu({ parentRect, items, onClose, onMouseEnter, onMouseLeave, width = 220 }) {
  const ref = useRefIx(null);
  const itemRefs = useRefIx({});
  const closeTimer = useRefIx(null);
  const [openSub, setOpenSub] = useStateIx(null);
  const margin = 4;
  // Default: open to the right of the parent menu.
  let left = parentRect.right + margin;
  if (left + width + 8 > window.innerWidth) {
    left = Math.max(8, parentRect.left - width - margin);
  }
  const top = Math.max(
    8,
    Math.min(window.innerHeight - 80, parentRect.top - 4)
  );
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenSub(null), 140);
  };
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const openAt = (index) => {
    cancelClose();
    const el = itemRefs.current[index];
    if (!el) return;
    setOpenSub({ index, rect: el.getBoundingClientRect() });
  };
  return (
    <div
      ref={ref}
      className="ix-menu ix-menu--submenu"
      role="menu"
      style={{ position: "fixed", top, left, width }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      
      {items.map((it, i) => {
        if (it.divider) return <div key={`d${i}`} className="ix-menu-divider" role="separator" />;
        if (it.header) return <div key={`h${i}`} className="ix-menu-header" role="presentation">{it.header}</div>;
        const hasChildren = Array.isArray(it.children) && it.children.length > 0;
        const isOpen = openSub && openSub.index === i;
        return (
          <button
            key={i}
            ref={(el) => { if (el) itemRefs.current[i] = el; }}
            type="button"
            role="menuitem"
            aria-haspopup={hasChildren ? "menu" : undefined}
            aria-expanded={hasChildren ? !!isOpen : undefined}
            className={`ix-menu-item${it.danger ? " ix-menu-item--danger" : ""}${isOpen ? " ix-menu-item--open" : ""}`}
            onMouseEnter={() => { if (hasChildren) openAt(i); else scheduleClose(); }}
            onMouseLeave={() => { if (hasChildren) scheduleClose(); }}
            onFocus={() => { if (hasChildren) openAt(i); }}
            onClick={(e) => {
              if (hasChildren) {
                e.preventDefault();
                if (isOpen) setOpenSub(null); else openAt(i);
                return;
              }
              // `keepOpen` rows fire their action without dismissing the
              // parent menu — used when the action opens a sibling popover
              // (e.g. the country picker) that should coexist with the menu.
              if (!it.keepOpen) onClose();
              if (it.onClick) it.onClick();else
              showToast(`${it.label} — coming soon`);
            }}>
            
            {it.icon && <span className="ix-menu-icon" aria-hidden="true"><Icon name={it.icon} size={16} /></span>}
            <span className="ix-menu-label">{it.label}</span>
            {it.shortcut && <span className="ix-menu-shortcut">{it.shortcut}</span>}
            {hasChildren ?
              <span className="ix-menu-icon ix-menu-caret" aria-hidden="true"><Icon name="ChevronRight" size={16} /></span> :
              it.trailingIcon && <span className="ix-menu-icon" aria-hidden="true"><Icon name={it.trailingIcon} size={16} /></span>
            }
          </button>);

      })}
      {openSub && (() => {
        const it = items[openSub.index];
        if (!it || !Array.isArray(it.children)) return null;
        return (
          <ActionSubmenu
            parentRect={openSub.rect}
            items={it.children}
            width={it.submenuWidth || 220}
            onClose={() => { setOpenSub(null); onClose(); }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose} />);
      })()}
    </div>);

}

// =====================================================================
// Filter popover (multi-select checkbox list)
// =====================================================================
function FilterPopover({ anchor, title, options = [], selected = [], onApply, onClose, searchable }) {
  const ref = useRefIx(null);
  const searchRef = useRefIx(null);
  useDismissOnOutside(ref, onClose);
  const [picked, setPicked] = useStateIx(new Set(selected));
  const [query, setQuery] = useStateIx("");

  // Auto-enable search when the list is long enough to scroll noticeably.
  const showSearch = searchable != null ? !!searchable : options.length >= 8;

  // Focus the search field on open so typing is immediate.
  useEffectIx(() => {
    if (showSearch && searchRef.current) {
      // Small delay so the popover animation doesn't fight focus.
      const t = setTimeout(() => {try {searchRef.current.focus();} catch (e) {}}, 60);
      return () => clearTimeout(t);
    }
  }, [showSearch]);

  const toggle = (v) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v);else next.add(v);
    return next;
  });

  const q = query.trim().toLowerCase();
  const filteredOptions = q ?
  options.filter((opt) => {
    const label = typeof opt === "string" ? opt : opt.label;
    return String(label).toLowerCase().includes(q);
  }) :
  options;

  const pos = positionFor(anchor, 280);
  return (
    <div className="ix-popover" ref={ref} style={{ top: pos.top, left: pos.left, width: 280 }}>
      <div className="ix-popover-head">
        <span>{title}</span>
        <button type="button" className="ix-popover-clear" onClick={() => setPicked(new Set())}>Clear</button>
      </div>
      {showSearch &&
      <div className="ix-popover-search">
          <span className="ix-popover-search-icon" aria-hidden="true">
            <Icon name="Search" size={16} />
          </span>
          <input
          ref={searchRef}
          type="text"
          className="ix-popover-search-input"
          placeholder={`Search ${String(title || "").toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${title}`} />
        
          {query &&
        <button
          type="button"
          className="ix-popover-search-clear"
          onClick={() => {setQuery("");searchRef.current && searchRef.current.focus();}}
          aria-label="Clear search">
          
              <Icon name="X" size={14} />
            </button>
        }
        </div>
      }
      <div className="ix-popover-list">
        {filteredOptions.length === 0 ?
        <div className="ix-popover-empty">No matches</div> :
        filteredOptions.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const label = typeof opt === "string" ? opt : opt.label;
          const on = picked.has(value);
          return (
            <label key={value} className={`ix-popover-row${on ? " ix-popover-row--on" : ""}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(value)} />
              
              <span>{label}</span>
            </label>);

        })}
      </div>
      <div className="ix-popover-foot">
        <button type="button" className="btn btn--sm btn--tertiary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => {
            const arr = Array.from(picked);
            if (onApply) onApply(arr);
            showToast(arr.length ? `${title}: ${arr.length} applied` : `${title}: cleared`);
            onClose();
          }}>
          
          Apply
        </button>
      </div>
    </div>);

}

// =====================================================================
// Confirm dialog (modal)
// =====================================================================
function ConfirmDialog({ title, body, primaryLabel = "Confirm", primaryKind = "primary", onConfirm, onClose }) {
  useEffectIx(() => {
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <React.Fragment>
      <div className="ix-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ix-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ix-dialog-head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </button>
        </header>
        {body && <div className="ix-dialog-body">{typeof body === "string" ? <p>{body}</p> : body}</div>}
        <footer className="ix-dialog-foot">
          <button type="button" className="btn btn--md btn--tertiary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`btn btn--md btn--${primaryKind}`}
            onClick={() => {onConfirm && onConfirm();onClose();}}>
            
            {primaryLabel}
          </button>
        </footer>
      </div>
    </React.Fragment>);

}

// =====================================================================
// Notifications side panel
// ---------------------------------------------------------------------
// Notifications are DERIVED from the live data layer (APPROVALS,
// COMPLIANCE, TIMESHEETS, INVOICES, REQUISITIONS, TRIAGE) so the inbox
// bell stays in lockstep with what the rest of the app shows. Each row
// is fully clickable — the whole card navigates to the source page,
// and a trailing primary action runs the most-likely next step
// (escalate, review, open invoice, etc.). A row-level overflow menu
// offers Mark as read / Snooze / Dismiss.
// =====================================================================

// Read / dismissed state lives on the module so the bell badge and
// panel stay in sync across mount/unmount. (Demo-scope only — no
// persistence; resets on full reload.)
const _notifRead = new Set();
const _notifDismissed = new Set();

function _notifSupplierLabel(id) {
  const sup = (window.REQ_SUPPLIERS || {})[id];
  return sup ? sup.label : id;
}

function _notifWorkerName(id) {
  const w = (window.WORKERS || []).find((x) => x.id === id);
  return w ? w.name : null;
}

// Build the inbox bell list from live data. Ordered most-urgent first
// (errors → warnings → info → success). Each row carries enough context
// to navigate to its source AND to run a primary action without leaving
// the panel where possible.
function _buildNotifications() {
  const TS = window.TIMESHEETS || [];
  const INVS = window.INVOICES || [];
  const REQS = window.REQUISITIONS || [];
  const TRIAGE = window.TRIAGE || [];
  const COMPLIANCE = window.COMPLIANCE || [];
  const APPROVALS = window.APPROVALS || [];

  const out = [];

  // ---- 1. Compliance: OSHA-10 expired ---------------------------------
  // Matches COMPLIANCE.CMP-1 — Terry Donin · 12 future shifts at risk.
  const cmpErr = COMPLIANCE.find((c) => c.level === "err" && c.kind === "expired");
  if (cmpErr) {
    out.push({
      id: "n-cmp-expired",
      kind: "error", icon: "ShieldPerson",
      title: cmpErr.title,
      body: cmpErr.meta,
      meta: "8 min ago",
      target: { page: "credentialing" },
      action: {
        label: cmpErr.action,
        onClick: () => showToast(`${cmpErr.action} — request sent`, { kind: "success" })
      }
    });
  }

  // ---- 2. Overdue invoice --------------------------------------------
  // First overdue invoice (line-disputes shape) — uses real id + amount.
  const overdue = INVS.find((i) => i.status === "Overdue");
  if (overdue) {
    const sup = _notifSupplierLabel(overdue.supplier);
    out.push({
      id: `n-inv-${overdue.id}`,
      kind: "error", icon: "Wallet",
      title: `Invoice ${overdue.id} is overdue`,
      body: `${sup} · ${overdue.locations[0]} · ${overdue.amount} · due ${overdue.dueDate}`,
      meta: "1 h ago",
      target: { page: "invoices", sub: "details", id: overdue.id },
      action: { label: "Open invoice" }
    });
  }

  // ---- 3. SLA at risk: critical triage shift -------------------------
  // Most-urgent crit triage row — links into the schedule.
  const crit = TRIAGE.find((t) => t.level === "crit");
  if (crit) {
    const sup = _notifSupplierLabel(crit.supplier);
    out.push({
      id: `n-sla-${crit.id}`,
      kind: "warning", icon: "Hourglass",
      title: `${crit.title} at risk — ${crit.when.toLowerCase()}`,
      body: `${crit.location} · ${crit.confirmed}/${crit.needed} confirmed · ${sup}`,
      meta: "32 min ago",
      target: { page: "schedule" },
      action: {
        label: crit.action,
        onClick: () => showToast(`${crit.action} queued for ${crit.id}`, { kind: "success" })
      }
    });
  }

  // ---- 4. Timesheets in Review / Pending Approval ---------------------
  // Real count from the live timesheet list. Shows latest worker name
  // when available for context.
  const tsReview = TS.filter((t) => t.status === "Review" || t.status === "Pending Approval");
  if (tsReview.length) {
    const latest = tsReview[0];
    const w = latest && _notifWorkerName(latest.worker);
    const supLabel = latest ? _notifSupplierLabel(latest.supplier) : "";
    out.push({
      id: "n-ts-review",
      kind: "warning", icon: "PersonClock",
      title: `${tsReview.length} timesheet${tsReview.length === 1 ? "" : "s"} need${tsReview.length === 1 ? "s" : ""} your review`,
      body: w ? `Latest: ${w} · ${supLabel}` : `From ${supLabel}`,
      meta: "2 h ago",
      target: { page: "inbox" },
      action: { label: "Review" }
    });
  }

  // ---- 5. Rate change request -----------------------------------------
  // Pull the highest-priority rate approval (Pro Hire uplift in demo).
  const rate = APPROVALS.find((a) => a.kind === "rate");
  if (rate) {
    // target's supplier id is encoded in rate.target
    out.push({
      id: `n-${rate.id}`,
      kind: "info", icon: "Pay",
      title: rate.title,
      body: `${rate.meta} · ${rate.amount}`,
      meta: "Yesterday",
      target: rate.target,
      action: { label: "Review" }
    });
  }

  // ---- 6. New invoice generated (informational) -----------------------
  // First Generated invoice — confirms the AP packet is ready.
  const gen = INVS.find((i) => i.status === "Generated");
  if (gen) {
    out.push({
      id: `n-inv-gen-${gen.id}`,
      kind: "info", icon: "Wallet",
      title: `Invoice ${gen.id} generated`,
      body: `${_notifSupplierLabel(gen.supplier)} · ${gen.locations[0]} · ${gen.amount}`,
      meta: "Yesterday",
      target: { page: "invoices", sub: "details", id: gen.id },
      action: { label: "View invoice" }
    });
  }

  // ---- 7. Requisition booked / confirmed ------------------------------
  // First Booked requisition — Production Associates × 3 at Warehouse #35.
  const booked = REQS.find((r) => r.status === "Booked");
  if (booked) {
    const job = booked.jobs[0];
    const date = booked.dates && booked.dates[0] || "scheduled date";
    out.push({
      id: `n-req-${booked.id}`,
      kind: "success", icon: "Briefcase",
      title: `Requisition ${booked.id} confirmed`,
      body: `${booked.qty} ${job}${booked.qty === 1 ? "" : "s"} · ${booked.location} · ${date}`,
      meta: "Nov 1, 6:45 PM",
      target: { page: "requisitions", sub: "details", id: booked.id },
      action: { label: "Open" }
    });
  }

  // ---- 8. New supplier invited ----------------------------------------
  // Surfaces the Shifty invite from the suppliers network.
  out.push({
    id: "n-sup-invite-sh",
    kind: "info", icon: "PersonPlus",
    title: "New supplier invited",
    body: "Shifty has been invited to join your supplier network.",
    meta: "Oct 28",
    target: { page: "suppliers" },
    action: { label: "View suppliers" }
  });

  return out;
}

// Public-ish helpers — used by chrome.jsx to render the bell badge.
function getNotifications() {
  return _buildNotifications().filter((n) => !_notifDismissed.has(n.id));
}
function unreadNotifCount() {
  return getNotifications().filter((n) => !_notifRead.has(n.id)).length;
}
function _markNotifRead(id) {
  _notifRead.add(id);
  Interactions.emit("notifsChanged", { count: unreadNotifCount() });
}
function _dismissNotif(id) {
  _notifDismissed.add(id);
  _notifRead.add(id);
  Interactions.emit("notifsChanged", { count: unreadNotifCount() });
}
function _markAllNotifsRead() {
  getNotifications().forEach((n) => _notifRead.add(n.id));
  Interactions.emit("notifsChanged", { count: unreadNotifCount() });
}

// One row inside the panel. The card itself is a button — Enter / click
// navigates to the source page. The trailing action button is wired up
// independently so it can run a sibling action (escalate, etc.) without
// leaving the panel. An overflow menu offers Mark read / Snooze / Dismiss.
function NotificationRow({ n, onNavigate, onClose }) {
  const isRead = _notifRead.has(n.id);
  const navigate = () => {
    _markNotifRead(n.id);
    if (n.target && window.flexGoTo) {
      window.flexGoTo(n.target);
      onClose && onClose();
    } else {
      showToast(`Opened ${n.title}`);
    }
  };
  const runAction = (e) => {
    e.stopPropagation();
    _markNotifRead(n.id);
    if (n.action && n.action.onClick) {
      n.action.onClick();
    } else if (n.target && window.flexGoTo) {
      window.flexGoTo(n.target);
      onClose && onClose();
      return;
    } else {
      showToast(n.action ? `${n.action.label} — done` : `Opened ${n.title}`);
    }
    onNavigate && onNavigate();
  };
  const openMore = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
    !isRead && { icon: "Check", label: "Mark as read", onClick: () => {_markNotifRead(n.id);onNavigate && onNavigate();} },
    isRead && { icon: "Refresh", label: "Mark as unread", onClick: () => {_notifRead.delete(n.id);Interactions.emit("notifsChanged", { count: unreadNotifCount() });onNavigate && onNavigate();} },
    { icon: "Hourglass", label: "Snooze 1 hour", onClick: () => {_dismissNotif(n.id);onNavigate && onNavigate();showToast(`Snoozed for 1 hour`);} },
    { divider: true },
    { icon: "TrashCan", label: "Dismiss", danger: true, onClick: () => {_dismissNotif(n.id);onNavigate && onNavigate();showToast("Notification dismissed");} }].
    filter(Boolean));
  };
  return (
    <li className={`ix-notif${isRead ? " ix-notif--read" : " ix-notif--unread"}`}>
      <button
        type="button"
        className="ix-notif-card"
        onClick={navigate}
        aria-label={`${n.title}. ${n.body}. ${isRead ? "Read." : "Unread."} Press Enter to open.`}>
        
        <span className="ix-notif-unread-dot" aria-hidden="true" />
        <span className={`ix-notif-icon ix-notif-icon--${n.kind}`} aria-hidden="true">
          <Icon name={n.icon} size={18} />
        </span>
        <span className="ix-notif-text">
          <span className="ix-notif-title">{n.title}</span>
          <span className="ix-notif-body">{n.body}</span>
          <span className="ix-notif-meta">{n.meta}</span>
        </span>
      </button>
      <div className="ix-notif-row-actions">
        {n.action &&
        <button
          type="button"
          className="btn btn--sm btn--secondary ix-notif-action"
          onClick={runAction}>
          
            {n.action.label}
          </button>
        }
        <button
          type="button"
          className="iconbtn ix-notif-more"
          aria-label="More actions"
          onClick={openMore}>
          
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </li>);

}

// =====================================================================
// Notifications dropdown
// ---------------------------------------------------------------------
// Anchored popover beneath the AppNav bell — mirrors the account menu
// pattern. Shows the 3 most recent items with full preview (icon, title,
// body, timestamp + primary action). "Open Inbox" footer link routes to
// the full list. Closes on Esc, outside-click, or re-click of the bell.
// =====================================================================
function NotificationsDropdown({ open, anchor, onClose }) {
  const [, force] = useStateIx(0);
  const rerender = () => force((n) => n + 1);
  const [pos, setPos] = useStateIx(null);
  const popRef = useRefIx(null);

  // Re-render when notification state changes (mark read, dismiss, etc.)
  useEffectIx(() => {
    const off = Interactions.on("notifsChanged", rerender);
    return off;
  }, []);

  // Position the dropdown under the bell anchor. Mirrors CountryPicker —
  // recompute on resize/scroll, portal to <body> to escape transformed
  // ancestors that would otherwise break position:fixed.
  useEffectIx(() => {
    if (!open || !anchor) return;
    const reposition = () => {
      const r = anchor.getBoundingClientRect();
      const POP_W = 420;
      const GAP = 8;
      const MARGIN = 12;
      // Right-align with the bell so the dropdown sits comfortably under
      // the app-nav-right cluster, but never goes off-screen on the left.
      let left = r.right - POP_W;
      if (left < MARGIN) left = MARGIN;
      if (left + POP_W > window.innerWidth - MARGIN) {
        left = Math.max(MARGIN, window.innerWidth - MARGIN - POP_W);
      }
      const top = r.bottom + GAP;
      setPos({ top, left, width: POP_W });
    };
    reposition();
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    const onDown = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (anchor && anchor.contains && anchor.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchor, onClose]);

  // Register the derived data with the currency switcher so the body
  // strings (which embed "$"-formatted amounts copied verbatim from the
  // INVOICES list) follow live country changes.
  const allNotifs = getNotifications();
  if (typeof window !== "undefined" && window.registerCurrencyData) {
    window.registerCurrencyData(allNotifs);
  }
  // Show only the 3 most-recent items in the dropdown preview. The
  // full list lives on the Inbox page (deep-linked via the footer).
  const notifs = allNotifs.slice(0, 3);
  const unreadAll = allNotifs.filter((n) => !_notifRead.has(n.id));

  if (!open || !pos) return null;

  const goToInbox = () => {
    if (window.flexGoTo) {window.flexGoTo("inbox");}
    onClose();
  };

  const node =
  <div
    ref={popRef}
    className="ix-notifs-dd"
    role="dialog"
    aria-label="Notifications"
    style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}>
    
      <header className="ix-notifs-dd-head">
        <h2 className="ix-notifs-dd-title">
          Notifications
          {unreadAll.length > 0 &&
        <span className="req-pill req-pill--informative ix-notif-head-count">
              {unreadAll.length} new
            </span>
        }
        </h2>
        <div className="ix-notifs-dd-head-actions">
          <button
          type="button"
          className="linkbtn"
          disabled={unreadAll.length === 0}
          onClick={() => {_markAllNotifsRead();showToast("All notifications marked as read");}}>
          
            Mark all read
          </button>
          <button
          type="button"
          className="iconbtn"
          aria-label="Notification settings"
          title="Notification settings"
          onClick={() => {if (window.flexGoTo) {window.flexGoTo({ page: "userSettings" });onClose();} else {showToast("Notification settings");}}}>
          
            <Icon name="Settings" size={18} />
          </button>
        </div>
      </header>

      <div className="ix-notifs-dd-body">
        {notifs.length === 0 ?
      <div className="ix-notif-empty">
            <span className="ix-notif-empty-ic" aria-hidden="true"><Icon name="Check" size={20} /></span>
            <p className="ix-notif-empty-title">You're all caught up</p>
            <p className="ix-notif-empty-body">New activity from approvals, compliance and the supplier network will land here.</p>
          </div> :

      <ul className="ix-notif-list">
            {notifs.map((n) =>
        <NotificationRow key={n.id} n={n} onNavigate={rerender} onClose={onClose} />
        )}
          </ul>
      }
      </div>

      <footer className="ix-notifs-dd-foot">
        <button
        type="button"
        className="ix-notifs-dd-viewall"
        onClick={goToInbox}>
        
          <span>View all
</span>
          <Icon name="ArrowRight" size={16} />
        </button>
      </footer>
    </div>;

  return typeof ReactDOM !== "undefined" && ReactDOM.createPortal ?
  ReactDOM.createPortal(node, document.body) :
  node;
}

// =====================================================================
// Common item factories — reduce boilerplate at call sites.
// =====================================================================
function rowMenuItems({ kind = "row", onView, onEdit, onDuplicate, onArchive, onDelete } = {}) {
  return [
  onView && { icon: "View", label: "View", onClick: onView },
  onEdit && { icon: "Edit", label: "Edit", onClick: onEdit },
  onDuplicate && { icon: "Copy", label: "Duplicate", onClick: onDuplicate },
  (onView || onEdit || onDuplicate) && (onArchive || onDelete) && { divider: true },
  onArchive && { icon: "Archive", label: "Archive", onClick: onArchive },
  onDelete && { icon: "TrashCan", label: "Delete", danger: true, onClick: onDelete }].
  filter(Boolean);
}

// Standard 4-button toolbar at the top of every list page.
function toolbarMenuItems() {
  return [
  { icon: "Print", label: "Print page", onClick: () => showToast("Print preview opened") },
  { icon: "FileDownload", label: "Download report", onClick: () => showToast("Report downloading…") },
  { divider: true },
  { icon: "Settings", label: "View density", onClick: () => showToast("Switched to compact density") },
  { icon: "Adjustment", label: "Saved views", onClick: () => showToast("3 saved views available") },
  { icon: "Help", label: "Keyboard shortcuts", onClick: () => showToast("⌘ / opens search · ⌘ K opens command bar") }];

}

// Reusable trailing-actions group for every list-page toolbar.
// kind: noun for the toast copy ("invoices", "suppliers", etc.)
// columns: list of column names — surfaces as a hide/show menu.
function ListToolbarActions({ kind = "rows", columns = [], showMore = true }) {
  return (
    <React.Fragment>
      <button
        type="button"
        className="iconbtn"
        aria-label="Adjust columns and filters"
        title="Adjust columns and filters"
        onClick={(e) => {
          // If a table on this page has registered a view-customizer
          // (every standard list view does), open its popover. Otherwise
          // fall back to the legacy placeholder so non-customized
          // surfaces still surface SOMETHING.
          const vc = window.__activeVc;
          if (vc && vc.openPanel) { vc.openPanel(e.currentTarget); return; }
          openMenu(e.currentTarget,
          columns.length ?
          columns.map((c) => ({ icon: "View", label: c, onClick: () => showToast(`${c} column toggled`) })) :
          [{ icon: "Settings", label: "Column settings — coming soon" }]
          );
        }}>
        
        <Icon name="Adjustment" size={20} />
      </button>
      <button
        type="button"
        className="iconbtn"
        aria-label="Import"
        title="Import"
        onClick={() => showToast(`Choose a CSV to import`, {
          action: { label: "Browse", onClick: () => showToast("File picker opened (preview)") }
        })}>
        
        <Icon name="Import" size={20} />
      </button>
      <button
        type="button"
        className="iconbtn"
        aria-label="Export"
        title="Export"
        onClick={(e) => openMenu(e.currentTarget, [
        { icon: "Excel", label: "Export to CSV", onClick: () => showToast(`Exporting ${kind}.csv`, { kind: "success" }) },
        { icon: "PDF", label: "Export to PDF", onClick: () => showToast(`Exporting ${kind}.pdf`, { kind: "success" }) },
        { icon: "Print", label: "Print", onClick: () => showToast("Sent to printer") }]
        )}>
        
        <Icon name="Export" size={20} />
      </button>
      {showMore &&
      <button
        type="button"
        className="iconbtn"
        aria-label="More actions"
        title="More"
        onClick={(e) => openMenu(e.currentTarget, toolbarMenuItems())}>
        
          <Icon name="MoreVert" size={20} />
        </button>
      }
    </React.Fragment>);

}

// Inline helper to wire the "Reload" omnibar icon to show a quick toast
// after firing the page's reload callback.
function omnibarReloadHandler(onReload, label = "Refreshed") {
  return () => {onReload && onReload();showToast(label);};
}

Object.assign(window, {
  Interactions, showToast, openMenu, openFilter, openConfirm, openNotifications, openEditEntity,
  copyToClipboard, InteractionsHost, rowMenuItems, toolbarMenuItems,
  ListToolbarActions, omnibarReloadHandler,
  // Notification surface — chrome bell badge consumes these.
  getNotifications, unreadNotifCount
});