// =====================================================================
// Flex Work — User settings (personal preferences)
// Shown when the user picks "Settings" from the avatar menu in the
// top bar. This is *user* settings — notifications, language, theme,
// security — distinct from the global `Settings` nav item which is
// for org/system admin configuration.
// =====================================================================

const { useState: useStateAcct } = React;

const ACCT_SECTIONS = [
  { id: "account",       label: "Account",        icon: "PersonLines" },
  { id: "notifications", label: "Notifications",  icon: "Bell" },
  { id: "region",        label: "Language & region", icon: "Globe" },
  { id: "appearance",    label: "Appearance",     icon: "Adjustment" },
  { id: "security",      label: "Security",       icon: "Lock" },
];

// Tiny accessible toggle switch — keeps the design system happy without
// pulling in a new dep. Markup matches Everest's pill-style switch.
function AcctToggle({ checked, onChange, label }) {
  return (
    <label className="acct-toggle" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange && onChange(e.target.checked)}
      />
      <span className="acct-toggle-track" aria-hidden="true" />
      <span className="acct-toggle-thumb" aria-hidden="true" />
    </label>
  );
}

function AcctSegmented({ value, options, onChange, label }) {
  return (
    <div className="acct-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "is-active" : ""}
          onClick={() => onChange && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PrefRow({ title, sub, control }) {
  return (
    <div className="acct-prefrow">
      <div>
        <p className="acct-prefrow-title">{title}</p>
        {sub && <p className="acct-prefrow-sub">{sub}</p>}
      </div>
      <div className="acct-prefrow-ctrl">{control}</div>
    </div>
  );
}

function UserSettingsPage({ onGoTo }) {
  const u = typeof CURRENT_USER !== "undefined" ? CURRENT_USER : { fullName: "Amy Chen", email: "amy.chen@summit.example.com" };
  const [active, setActive] = useStateAcct("account");
  const [prefs, setPrefs] = useStateAcct({
    // notifications
    nNewShifts: true,
    nApprovals: true,
    nLateClockIn: true,
    nWeeklyDigest: false,
    nProductUpdates: false,
    // delivery
    notifyEmail: true,
    notifyPush:  true,
    notifySms:   false,
    // appearance
    theme: "system",
    density: "comfortable",
    // region
    language: "English (US)",
    timeZone: "America/Los_Angeles",
    dateFormat: "MMM D, YYYY",
    timeFormat: "12h",
    weekStart: "Sunday",
    // security
    mfa: true,
    sessionTimeout: "8 hours",
  });
  const set = (k) => (v) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <React.Fragment>
      <Omnibar icon="Settings" title="Settings">
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={() => onGoTo && onGoTo("userProfile")}
        >
          <Icon name="PersonLines" size={16} />Your profile
        </button>
      </Omnibar>

      <div className="acct-page">
        <div className="acct-settings-grid">
          {/* Side nav */}
          <nav className="acct-nav" aria-label="Settings sections">
            {ACCT_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={"acct-nav-item" + (active === s.id ? " acct-nav-item--active" : "")}
                onClick={() => setActive(s.id)}
                aria-current={active === s.id ? "true" : undefined}
              >
                <Icon name={s.icon} size={18} />
                {s.label}
              </button>
            ))}
          </nav>

          {/* Panels */}
          <div className="acct-panels">
            {active === "account" && (
              <section className="acct-card">
                <div className="acct-card-head">
                  <div>
                    <h2 className="acct-card-title">Account</h2>
                    <p className="acct-card-sub">Personal information shown to your team across Dayforce.</p>
                  </div>
                </div>
                <dl className="acct-dl">
                  <div className="acct-row">
                    <dt>Display name</dt>
                    <dd>{u.fullName}</dd>
                  </div>
                  <div className="acct-row">
                    <dt>Username</dt>
                    <dd className="tabular">{u.username || "amy.chen"}</dd>
                  </div>
                  <div className="acct-row">
                    <dt>Email</dt>
                    <dd><a href={`mailto:${u.email}`}>{u.email}</a></dd>
                  </div>
                  <div className="acct-row">
                    <dt>Phone</dt>
                    <dd>{u.phone || "+1 (415) 555-0117"}</dd>
                  </div>
                </dl>
                <div style={{ marginTop: 18, display: "inline-flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn--sm btn--secondary"
                    onClick={() => showToast("Account edit — preview only")}
                  >
                    <Icon name="Edit" size={14} />Edit details
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--secondary"
                    onClick={() => showToast("Photo upload — preview only")}
                  >
                    Change photo
                  </button>
                </div>
              </section>
            )}

            {active === "notifications" && (
              <React.Fragment>
                <section className="acct-card">
                  <div className="acct-card-head">
                    <div>
                      <h2 className="acct-card-title">What to notify me about</h2>
                      <p className="acct-card-sub">Pick the moments worth interrupting you for.</p>
                    </div>
                  </div>
                  <PrefRow
                    title="New shift requests"
                    sub="Requisitions that arrive in your queue waiting for approval."
                    control={<AcctToggle checked={prefs.nNewShifts} onChange={set("nNewShifts")} label="New shift requests" />}
                  />
                  <PrefRow
                    title="Approvals awaiting you"
                    sub="Invoices, timesheets, or requisitions blocked on your sign-off."
                    control={<AcctToggle checked={prefs.nApprovals} onChange={set("nApprovals")} label="Approvals awaiting you" />}
                  />
                  <PrefRow
                    title="Late clock-ins &amp; no-shows"
                    sub="Real-time alerts when a booked worker is more than 10 minutes late."
                    control={<AcctToggle checked={prefs.nLateClockIn} onChange={set("nLateClockIn")} label="Late clock-ins" />}
                  />
                  <PrefRow
                    title="Weekly digest"
                    sub="Monday morning summary of last week's spend, fill rate, and at-risk shifts."
                    control={<AcctToggle checked={prefs.nWeeklyDigest} onChange={set("nWeeklyDigest")} label="Weekly digest" />}
                  />
                  <PrefRow
                    title="Dayforce product updates"
                    sub="Occasional emails about new Flex Work features."
                    control={<AcctToggle checked={prefs.nProductUpdates} onChange={set("nProductUpdates")} label="Product updates" />}
                  />
                </section>
                <section className="acct-card">
                  <div className="acct-card-head">
                    <div>
                      <h2 className="acct-card-title">How to reach you</h2>
                      <p className="acct-card-sub">Channels we'll use for the alerts you turned on above.</p>
                    </div>
                  </div>
                  <PrefRow
                    title="Email"
                    sub={u.email || "amy.chen@summit.example.com"}
                    control={<AcctToggle checked={prefs.notifyEmail} onChange={set("notifyEmail")} label="Email notifications" />}
                  />
                  <PrefRow
                    title="Push (mobile app)"
                    sub="Dayforce mobile on iPhone 15"
                    control={<AcctToggle checked={prefs.notifyPush} onChange={set("notifyPush")} label="Push notifications" />}
                  />
                  <PrefRow
                    title="Text message"
                    sub={`Sent to ${u.phone || "+1 (415) 555-0117"} for urgent alerts only.`}
                    control={<AcctToggle checked={prefs.notifySms} onChange={set("notifySms")} label="SMS notifications" />}
                  />
                </section>
              </React.Fragment>
            )}

            {active === "region" && (
              <section className="acct-card">
                <div className="acct-card-head">
                  <div>
                    <h2 className="acct-card-title">Language &amp; region</h2>
                    <p className="acct-card-sub">Controls how dates, times, and numbers appear for you.</p>
                  </div>
                </div>
                <PrefRow
                  title="Language"
                  sub="Used across menus, emails, and reports."
                  control={(
                    <select
                      className="acct-select"
                      value={prefs.language}
                      onChange={(e) => set("language")(e.target.value)}
                    >
                      <option>English (US)</option>
                      <option>English (UK)</option>
                      <option>Français (Canada)</option>
                      <option>Español (México)</option>
                    </select>
                  )}
                />
                <PrefRow
                  title="Time zone"
                  sub="Shift times and approval deadlines render in this zone."
                  control={(
                    <select
                      className="acct-select"
                      value={prefs.timeZone}
                      onChange={(e) => set("timeZone")(e.target.value)}
                    >
                      <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                      <option value="America/Denver">Mountain Time (Denver)</option>
                      <option value="America/Chicago">Central Time (Chicago)</option>
                      <option value="America/New_York">Eastern Time (New York)</option>
                    </select>
                  )}
                />
                <PrefRow
                  title="Date format"
                  control={(
                    <AcctSegmented
                      value={prefs.dateFormat}
                      onChange={set("dateFormat")}
                      label="Date format"
                      options={[
                        { value: "MMM D, YYYY", label: "May 19, 2026" },
                        { value: "YYYY-MM-DD",  label: "2026-05-19" },
                        { value: "DD/MM/YYYY",  label: "19/05/2026" },
                      ]}
                    />
                  )}
                />
                <PrefRow
                  title="Time format"
                  control={(
                    <AcctSegmented
                      value={prefs.timeFormat}
                      onChange={set("timeFormat")}
                      label="Time format"
                      options={[
                        { value: "12h", label: "12-hour" },
                        { value: "24h", label: "24-hour" },
                      ]}
                    />
                  )}
                />
                <PrefRow
                  title="Week starts on"
                  control={(
                    <AcctSegmented
                      value={prefs.weekStart}
                      onChange={set("weekStart")}
                      label="Week start"
                      options={[
                        { value: "Sunday",  label: "Sunday" },
                        { value: "Monday",  label: "Monday" },
                      ]}
                    />
                  )}
                />
              </section>
            )}

            {active === "appearance" && (
              <section className="acct-card">
                <div className="acct-card-head">
                  <div>
                    <h2 className="acct-card-title">Appearance</h2>
                    <p className="acct-card-sub">Only affects your view; teammates keep their own settings.</p>
                  </div>
                </div>
                <PrefRow
                  title="Theme"
                  sub="System follows your OS setting."
                  control={(
                    <AcctSegmented
                      value={prefs.theme}
                      onChange={set("theme")}
                      label="Theme"
                      options={[
                        { value: "light",  label: "Light" },
                        { value: "dark",   label: "Dark" },
                        { value: "system", label: "System" },
                      ]}
                    />
                  )}
                />
                <PrefRow
                  title="Density"
                  sub="Tighter rows fit more on a screen; comfortable is the default."
                  control={(
                    <AcctSegmented
                      value={prefs.density}
                      onChange={set("density")}
                      label="Density"
                      options={[
                        { value: "comfortable", label: "Comfortable" },
                        { value: "compact",     label: "Compact" },
                      ]}
                    />
                  )}
                />
              </section>
            )}

            {active === "security" && (
              <React.Fragment>
                <section className="acct-card">
                  <div className="acct-card-head">
                    <div>
                      <h2 className="acct-card-title">Sign-in &amp; security</h2>
                      <p className="acct-card-sub">Protect access to payroll, scheduling, and approval data.</p>
                    </div>
                  </div>
                  <PrefRow
                    title="Two-factor authentication"
                    sub="Required by your IT team. Codes come from Dayforce Authenticator."
                    control={<AcctToggle checked={prefs.mfa} onChange={set("mfa")} label="Two-factor authentication" />}
                  />
                  <PrefRow
                    title="Password"
                    sub="Last changed Jan 22, 2026."
                    control={(
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={() => showToast("Password change — preview only")}
                      >
                        Change password
                      </button>
                    )}
                  />
                  <PrefRow
                    title="Session timeout"
                    sub="Sign you out automatically after this much inactivity."
                    control={(
                      <select
                        className="acct-select"
                        value={prefs.sessionTimeout}
                        onChange={(e) => set("sessionTimeout")(e.target.value)}
                      >
                        <option>1 hour</option>
                        <option>4 hours</option>
                        <option>8 hours</option>
                        <option>24 hours</option>
                      </select>
                    )}
                  />
                </section>
                <section className="acct-card">
                  <div className="acct-card-head">
                    <div>
                      <h2 className="acct-card-title">Active sessions</h2>
                      <p className="acct-card-sub">Sign out devices you don't recognize.</p>
                    </div>
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => onGoTo && onGoTo("userProfile")}
                    >
                      View all sessions
                    </button>
                  </div>
                  <p className="acct-card-sub" style={{ marginTop: 0 }}>
                    You're signed in on <strong style={{ color: "var(--evr-content-primary-highemp)" }}>2 devices</strong>.
                  </p>
                </section>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { UserSettingsPage });
