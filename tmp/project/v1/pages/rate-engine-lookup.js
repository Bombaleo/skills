// =====================================================================
//  FLEX WORK V1 · pages/rate-engine-lookup  (IA version: V1)
//  ---------------------------------------------------------------------
//  Settings → Configuration → Rate Engine: lookup-driven engine rules.
//  Each rule maps a combination of Legal Entity + Tenure Status +
//  Locations + Positions to its own pay rate engine config (margin,
//  OT multiplier, rounding, on-cost components).  Rules are evaluated
//  top-down; the first matching rule wins.
//
//  Registers window.V1.pages.rateEngine = { render, wire }.
//  Loaded AFTER core.js + pages/rate-engine.js.
// =====================================================================
(function (V1) {
  "use strict";
  var ico = V1.ico, esc = V1.escapeHtml;

  // ---- Reference data -------------------------------------------------
  var ALL_LEGAL_ENTITIES = [
    "Warrington Logistics Ltd",
    "Dallas Operations Inc.",
    "Global Staffing Corp.",
    "Nuneaton Transport Ltd",
  ];

  var ALL_TENURE_STATUSES = [
    { id: "any",     label: "Any" },
    { id: "new",     label: "New Hire" },
    { id: "tenured", label: "Tenured (6+ mo.)" },
    { id: "senior",  label: "Long Tenured (2+ yr.)" },
  ];

  var ALL_LOCATIONS = [
    "Warrington", "Nuneaton", "Rugby", "Barnsley",
    "Dallas, TX", "Houston, TX", "Austin, TX", "San Antonio, TX",
  ];

  var ALL_POSITIONS = [
    "Cat C Day Driver", "Cat C Night Driver", "Cat C&E Day Driver",
    "Warehouse Operative", "Van Driver", "Day Loader",
    "Warehouse Associate", "Forklift Operator", "Picker / Packer",
  ];

  function defaultOnCosts() {
    return [
      { key: "holiday", label: "Holiday pay accrual",           sub: "12.07% statutory",        pct: 12.07, on: true },
      { key: "ni",      label: "Employer\u2019s National Insurance", sub: "Secondary Class 1",       pct: 13.80, on: true },
      { key: "pension", label: "Workplace pension",              sub: "Auto-enrolment minimum",  pct: 3.00,  on: true },
      { key: "levy",    label: "Apprenticeship levy",            sub: "0.5% of paybill",         pct: 0.50,  on: true },
    ];
  }

  // ---- Seed data ------------------------------------------------------
  function initRules() {
    return [
      {
        id: "re-1",
        legalEntity: "Warrington Logistics Ltd",
        tenureStatus: "any",
        locations: ["Warrington", "Nuneaton"],
        positions: ["Cat C Day Driver", "Cat C Night Driver"],
        enabled: true,
        engine: { margin: 18, ot: 1.5, rounding: 0, onCosts: defaultOnCosts() },
      },
      {
        id: "re-2",
        legalEntity: "Dallas Operations Inc.",
        tenureStatus: "new",
        locations: ["Dallas, TX", "Houston, TX"],
        positions: ["Warehouse Associate", "Picker / Packer"],
        enabled: true,
        engine: { margin: 22, ot: 1.5, rounding: 0.05, onCosts: defaultOnCosts() },
      },
      {
        id: "re-3",
        legalEntity: "Global Staffing Corp.",
        tenureStatus: "tenured",
        locations: [],
        positions: ["Forklift Operator"],
        enabled: true,
        engine: { margin: 20, ot: 1.5, rounding: 0, onCosts: defaultOnCosts() },
      },
      {
        id: "re-4",
        legalEntity: "Global Staffing Corp.",
        tenureStatus: "any",
        locations: ["Austin, TX"],
        positions: [],
        enabled: false,
        engine: { margin: 19, ot: 1.75, rounding: 0.10, onCosts: defaultOnCosts() },
      },
    ];
  }

  // ---- State helpers --------------------------------------------------
  function ensureState() {
    var s = V1.state;
    if (!s.reRules)                s.reRules    = initRules();
    if (s.reEditing       === undefined) s.reEditing       = null;   // rule id | "new" | null
    if (s.reDraft         === undefined) s.reDraft         = null;   // draft object
    if (s.reDeleteConfirm === undefined) s.reDeleteConfirm = false;  // confirm-remove state
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function nextId() {
    var rules = V1.state.reRules;
    var max = 0;
    rules.forEach(function (r) {
      var n = parseInt((r.id || "").replace("re-", ""), 10) || 0;
      if (n > max) max = n;
    });
    return "re-" + (max + 1);
  }

  // ---- Formatting helpers --------------------------------------------
  function tenureLabel(id) {
    var t = ALL_TENURE_STATUSES.filter(function (t) { return t.id === id; })[0];
    return t ? t.label : id;
  }

  function chips(items, max) {
    max = max || 2;
    if (!items || !items.length) return '<span class="re-any">All</span>';
    var shown = items.slice(0, max);
    var rest  = items.length - shown.length;
    var html  = shown.map(function (v) {
      return '<span class="re-chip">' + esc(v) + '</span>';
    }).join("");
    if (rest > 0) html += '<span class="re-chip re-chip--more">+' + rest + '</span>';
    return html;
  }

  function roundLabel(r) {
    if (!r) return "\u2014";
    return "$" + r.toFixed(2);
  }

  // ---- Render: main page ---------------------------------------------
  function render() {
    ensureState();
    var s = V1.state;

    var head = V1.crumb([
      { label: "Settings",      act: "settings-root" },
      { label: "Configuration", act: "noop" },
      { label: "Rate Engine" },
    ]) +
    '<div class="proto-page-head">' +
      '<h1>Rate Engine</h1>' +
      '<p>Define lookup rules that map workers to a pay rate engine configuration. Rules are evaluated top-down \u2014 the first matching rule applies.</p>' +
    '</div>';

    var toolbar = renderToolbar(s.reRules.length);
    var table   = renderTable(s.reRules, s.reEditing);
    var editor  = (s.reEditing && s.reDraft) ? renderEditor(s.reDraft, s.reEditing === "new") : "";

    var mainCard = '<div class="proto-card re-main-card">' +
      toolbar + table +
    '</div>';

    return head + mainCard + editor;
  }

  function renderToolbar(count) {
    return '<div class="re-toolbar">' +
      '<div class="re-toolbar-info">' +
        ico("Information") +
        '<span>' + count + ' rule' + (count !== 1 ? 's' : '') + ' configured</span>' +
      '</div>' +
      '<button class="proto-btn proto-btn--primary" data-act="re-add">' +
        ico("Plus") + 'Add rule' +
      '</button>' +
    '</div>';
  }

  function renderTable(rules, editing) {
    if (!rules.length) {
      return '<div class="re-empty">' +
        ico("Scale") +
        '<p>No rate engine rules yet. Add one to get started.</p>' +
      '</div>';
    }

    var rows = rules.map(function (rule, idx) {
      var isActive = editing === rule.id;
      return '<tr class="re-row' + (isActive ? ' is-editing' : '') + '">' +
        '<td class="re-td-order">' +
          '<span class="re-order-num">' + (idx + 1) + '</span>' +
        '</td>' +
        '<td class="re-td-entity">' +
          '<span class="re-entity">' + esc(rule.legalEntity) + '</span>' +
        '</td>' +
        '<td class="re-td-tenure">' +
          '<span class="re-tenure re-tenure--' + esc(rule.tenureStatus) + '">' +
            esc(tenureLabel(rule.tenureStatus)) +
          '</span>' +
        '</td>' +
        '<td class="re-td-chips">' + chips(rule.locations) + '</td>' +
        '<td class="re-td-chips">' + chips(rule.positions) + '</td>' +
        '<td class="re-td-num">' + rule.engine.margin + '%</td>' +
        '<td class="re-td-num">' + rule.engine.ot + '\u00d7</td>' +
        '<td class="re-td-num">' + roundLabel(rule.engine.rounding) + '</td>' +
        '<td class="re-td-status">' +
          '<span class="re-status-badge ' + (rule.enabled ? 're-status--on' : 're-status--off') + '">' +
            (rule.enabled ? 'Active' : 'Inactive') +
          '</span>' +
        '</td>' +
        '<td class="re-td-actions">' +
          '<button class="re-act-btn" data-act="re-edit" data-re-id="' + rule.id + '" title="Edit">' + ico("Edit") + '</button>' +
          '<button class="re-act-btn re-act-btn--del" data-act="re-delete" data-re-id="' + rule.id + '" title="Delete">' + ico("X") + '</button>' +
        '</td>' +
      '</tr>';
    }).join("");

    return '<div class="re-table-scroll">' +
      '<table class="proto-table re-table">' +
        '<thead><tr>' +
          '<th class="re-th-num">#</th>' +
          '<th>Legal Entity</th>' +
          '<th>Tenure</th>' +
          '<th>Locations</th>' +
          '<th>Positions</th>' +
          '<th>Margin</th>' +
          '<th>OT</th>' +
          '<th>Rounding</th>' +
          '<th>Status</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }

  // ---- Render: editor panel ------------------------------------------
  function renderEditor(draft, isNew) {
    // ---- Left col: lookup criteria ----
    var entityOpts = ALL_LEGAL_ENTITIES.map(function (e) {
      return '<option value="' + esc(e) + '"' + (draft.legalEntity === e ? ' selected' : '') + '>' + esc(e) + '</option>';
    }).join("");

    var tenureBtns = ALL_TENURE_STATUSES.map(function (t) {
      return '<button class="re-seg-btn' + (draft.tenureStatus === t.id ? ' is-active' : '') + '" ' +
        'data-act="re-draft-tenure" data-val="' + t.id + '">' + esc(t.label) + '</button>';
    }).join("");

    var locChecks = ALL_LOCATIONS.map(function (loc) {
      var on = draft.locations.indexOf(loc) >= 0;
      return '<label class="re-check-item">' +
        '<input type="checkbox" class="re-check-in" data-field="location" data-val="' + esc(loc) + '"' + (on ? ' checked' : '') + '>' +
        '<span>' + esc(loc) + '</span>' +
      '</label>';
    }).join("");

    var posChecks = ALL_POSITIONS.map(function (pos) {
      var on = draft.positions.indexOf(pos) >= 0;
      return '<label class="re-check-item">' +
        '<input type="checkbox" class="re-check-in" data-field="position" data-val="' + esc(pos) + '"' + (on ? ' checked' : '') + '>' +
        '<span>' + esc(pos) + '</span>' +
      '</label>';
    }).join("");

    // ---- Right col: engine config ----
    var roundingOpts = [
      [0, "None"],
      [0.01, "$0.01"],
      [0.05, "$0.05"],
      [0.10, "$0.10"],
      [0.25, "$0.25"],
    ].map(function (r) {
      return '<option value="' + r[0] + '"' + (draft.engine.rounding === r[0] ? ' selected' : '') + '>' + r[1] + '</option>';
    }).join("");

    var onCostRows = draft.engine.onCosts.map(function (c, i) {
      return '<div class="re-oncost-row">' +
        '<label class="re-toggle">' +
          '<input type="checkbox" class="re-toggle-in re-check-in" data-field="oncost-on" data-idx="' + i + '"' + (c.on ? ' checked' : '') + '>' +
          '<span class="re-toggle-track"></span>' +
        '</label>' +
        '<div class="re-oncost-info">' +
          '<span class="re-oncost-name">' + esc(c.label) + '</span>' +
          '<span class="re-oncost-sub">' + esc(c.sub) + '</span>' +
        '</div>' +
        '<div class="re-oncost-pct">' +
          '<input type="number" class="re-num-in re-check-in" data-field="oncost-pct" data-idx="' + i + '" value="' + c.pct + '" step="0.01" min="0" max="100">' +
          '<span class="re-unit">%</span>' +
        '</div>' +
      '</div>';
    }).join("");

    var statusBtns =
      '<button class="re-seg-btn' + (draft.enabled ? ' is-active' : '') + '" data-act="re-draft-enabled" data-val="1">Active</button>' +
      '<button class="re-seg-btn' + (!draft.enabled ? ' is-active' : '') + '" data-act="re-draft-enabled" data-val="0">Inactive</button>';

    return '<div class="proto-card re-editor" id="re-editor">' +
      // Header
      '<div class="re-ed-head">' +
        '<div>' +
          '<h2>' + (isNew ? 'Add rate engine rule' : 'Edit rate engine rule') + '</h2>' +
          '<p>' + (isNew ? 'Configure the lookup criteria and engine settings for the new rule.' : 'Update lookup criteria or engine settings for this rule.') + '</p>' +
        '</div>' +
        '<button class="re-ed-close" data-act="re-cancel" aria-label="Cancel editing">' + ico("X") + '</button>' +
      '</div>' +

      // Body: two columns
      '<div class="re-ed-body">' +

        // Left: lookup criteria
        '<div class="re-ed-col">' +
          '<div class="re-ed-sec-title">Lookup criteria</div>' +

          '<div class="re-field">' +
            '<label class="re-label">Legal entity</label>' +
            '<div class="re-sel-wrap">' +
              '<select class="re-sel" data-act="re-draft-entity">' + entityOpts + '</select>' +
            '</div>' +
          '</div>' +

          '<div class="re-field">' +
            '<label class="re-label">Tenure status</label>' +
            '<div class="re-seg">' + tenureBtns + '</div>' +
          '</div>' +

          '<div class="re-field">' +
            '<label class="re-label">Locations' +
              '<span class="re-label-hint"> — unchecked = match all</span>' +
            '</label>' +
            '<div class="re-check-grid" id="re-loc-grid">' + locChecks + '</div>' +
          '</div>' +

          '<div class="re-field">' +
            '<label class="re-label">Positions' +
              '<span class="re-label-hint"> — unchecked = match all</span>' +
            '</label>' +
            '<div class="re-check-grid" id="re-pos-grid">' + posChecks + '</div>' +
          '</div>' +
        '</div>' +

        // Right: engine configuration
        '<div class="re-ed-col">' +
          '<div class="re-ed-sec-title">Engine configuration</div>' +

          '<div class="re-field-row">' +
            '<div class="re-field">' +
              '<label class="re-label">Margin</label>' +
              '<div class="re-input-unit">' +
                '<input type="number" class="re-num-in" data-act="re-draft-margin" value="' + draft.engine.margin + '" step="0.5" min="0" max="100">' +
                '<span class="re-unit">%</span>' +
              '</div>' +
            '</div>' +
            '<div class="re-field">' +
              '<label class="re-label">OT multiplier</label>' +
              '<div class="re-input-unit">' +
                '<input type="number" class="re-num-in" data-act="re-draft-ot" value="' + draft.engine.ot + '" step="0.25" min="1" max="3">' +
                '<span class="re-unit">\u00d7</span>' +
              '</div>' +
            '</div>' +
            '<div class="re-field">' +
              '<label class="re-label">Rate rounding</label>' +
              '<div class="re-sel-wrap">' +
                '<select class="re-sel" data-act="re-draft-rounding">' + roundingOpts + '</select>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="re-field">' +
            '<label class="re-label">On-cost components</label>' +
            '<div class="re-oncosts">' + onCostRows + '</div>' +
          '</div>' +

          '<div class="re-field">' +
            '<label class="re-label">Rule status</label>' +
            '<div class="re-seg">' + statusBtns + '</div>' +
          '</div>' +
        '</div>' +

      '</div>' +

      // Footer actions
      (function () {
        if (V1.state.reDeleteConfirm) {
          return '<div class="re-ed-footer re-ed-footer--confirm">' +
            '<span class="re-delete-confirm-msg">' + ico("Warning") + 'Permanently remove this rule?' +
            '</span>' +
            '<button class="proto-btn re-btn--danger" data-act="re-delete-confirm">' + ico("Trash") + 'Remove</button>' +
            '<button class="proto-btn proto-btn--ghost" data-act="re-delete-dismiss">Keep rule</button>' +
          '</div>';
        }
        return '<div class="re-ed-footer">' +
          (!isNew ? '<button class="re-btn--danger-text" data-act="re-delete-prompt">' + ico("Trash") + 'Remove rule</button>' : '') +
          '<span class="re-footer-spacer"></span>' +
          '<button class="proto-btn proto-btn--primary" data-act="re-save">' + ico("Save") + 'Save rule</button>' +
          '<button class="proto-btn proto-btn--ghost" data-act="re-cancel">Cancel</button>' +
        '</div>';
      })() +
    '</div>';
  }

  // ---- Wire: page-level listeners that need live DOM -----------------
  function wire(app) {
    var editor = app.querySelector('#re-editor');
    if (!editor) return;

    var draft = V1.state.reDraft;
    if (!draft) return;

    // Checkboxes: locations, positions, on-cost toggles (change events
    // on <input type=checkbox> don't fire through data-act delegation).
    editor.querySelectorAll('.re-check-in').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var field = inp.getAttribute('data-field');
        if (field === 'location') {
          var val = inp.getAttribute('data-val');
          if (inp.checked) {
            if (draft.locations.indexOf(val) < 0) draft.locations.push(val);
          } else {
            draft.locations = draft.locations.filter(function (l) { return l !== val; });
          }
        } else if (field === 'position') {
          var val2 = inp.getAttribute('data-val');
          if (inp.checked) {
            if (draft.positions.indexOf(val2) < 0) draft.positions.push(val2);
          } else {
            draft.positions = draft.positions.filter(function (p) { return p !== val2; });
          }
        } else if (field === 'oncost-on') {
          var idx = parseInt(inp.getAttribute('data-idx'), 10);
          draft.engine.onCosts[idx].on = inp.checked;
        } else if (field === 'oncost-pct') {
          var idx2 = parseInt(inp.getAttribute('data-idx'), 10);
          draft.engine.onCosts[idx2].pct = parseFloat(inp.value) || 0;
        }
      });
    });

    // Numeric inputs (input event, not change)
    var marginIn = editor.querySelector('[data-act="re-draft-margin"]');
    if (marginIn) marginIn.addEventListener('input', function () {
      draft.engine.margin = parseFloat(marginIn.value) || 0;
    });

    var otIn = editor.querySelector('[data-act="re-draft-ot"]');
    if (otIn) otIn.addEventListener('input', function () {
      draft.engine.ot = parseFloat(otIn.value) || 1;
    });

    // Selects
    var entSel = editor.querySelector('[data-act="re-draft-entity"]');
    if (entSel) entSel.addEventListener('change', function () {
      draft.legalEntity = entSel.value;
    });

    var rndSel = editor.querySelector('[data-act="re-draft-rounding"]');
    if (rndSel) rndSel.addEventListener('change', function () {
      draft.engine.rounding = parseFloat(rndSel.value) || 0;
    });
  }

  V1.pages.rateEngine = { id: "rate-engine", render: render, wire: wire };

  // Expose helpers for app.js action handlers
  V1.pages.rateEngine.newDraft = function () {
    return {
      id: nextId(),
      legalEntity: ALL_LEGAL_ENTITIES[0],
      tenureStatus: "any",
      locations: [],
      positions: [],
      enabled: true,
      engine: { margin: 18, ot: 1.5, rounding: 0, onCosts: defaultOnCosts() },
    };
  };

})(window.V1);
