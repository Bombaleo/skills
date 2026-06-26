// =====================================================================
//  FLEX WORK V1 · pages/settings  (IA version: V1)
//  ---------------------------------------------------------------------
//  The Settings area's non-Pricing sub-items. Pricing is its own page
//  module (pages/pricing.js); every other Settings sub-nav item resolves
//  to this stub, which names the screen and points back at Pricing — the
//  one Configuration surface wired in this V1 build.
//
//  Registers window.V1.pages.settings = { renderStub }.
//  Loaded AFTER core.js.
// =====================================================================
(function (V1) {
  "use strict";
  var ico = V1.ico;

  function renderStub() {
    var state = V1.state;
    var label = "";
    V1.SETTINGS_NAV.forEach(function (g) {
      g.items.forEach(function (it) { if (it.id === state.settingsItem) label = it.label; });
    });
    return V1.crumb([{ label: "Settings", act: "settings-root" }, { label: label }]) +
      '<div class="proto-card"><div class="proto-stub">' + ico("Information") +
        '<h3>' + V1.escapeHtml(label) + '</h3>' +
        '<p>This screen isn\u2019t part of the V1 prototype yet.<br/>Open <b>Pricing</b> to try the rate-card automation flow.</p>' +
        '<button class="proto-btn proto-btn--secondary" data-act="go-pricing" style="margin-top:16px">' + ico("CreditCard") + 'Go to Pricing</button>' +
      '</div></div>';
  }

  V1.pages.settings = { id: "settings", renderStub: renderStub };
})(window.V1);
