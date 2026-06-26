// =====================================================================
// Flex Work — User profile (system user, not a worker)
// Shown when the user picks "Your profile" from the avatar menu in the
// top bar. This is Amy Chen's *account* — her role inside Flex Work, the
// access she's been granted, her contact info, and recent sessions —
// NOT a workforce/worker record.
// =====================================================================

const CURRENT_USER = {
  fullName: "Amy Chen",
  initials: "AC",
  title: "Workforce Operations Admin",
  username: "amy.chen",
  email: "amy.chen@summit.example.com",
  phone: "+1 (415) 555-0117",
  employer: "Summit Retail Group",
  employeeId: "DF-90142",
  department: "People Operations",
  manager: "Priya Anand",
  hireDate: "Mar 14, 2022",
  lastSignIn: "Today, 7:48 AM PT",
  timeZone: "America/Los_Angeles (PT)",
  status: "Active",
  roles: [
    { id: "fw-admin", label: "Flex Work admin", scope: "All sites · all suppliers" },
    { id: "approver", label: "Invoice approver", scope: "Up to $25,000" },
    { id: "viewer",   label: "Payroll viewer",   scope: "Read-only" },
  ],
  // Recent sign-in / session activity
  sessions: [
    { id: "s1", device: "MacBook Pro · Chrome 127",   where: "San Francisco, CA",  when: "Today, 7:48 AM PT", current: true },
    { id: "s2", device: "iPhone 15 · Dayforce mobile", where: "San Francisco, CA",  when: "Yesterday, 6:11 PM PT" },
    { id: "s3", device: "MacBook Pro · Chrome 127",   where: "San Francisco, CA",  when: "May 17, 8:02 AM PT" },
    { id: "s4", device: "MacBook Pro · Safari 18",    where: "Phoenix, AZ",        where_note: "Travel",       when: "May 12, 9:45 AM PT" },
  ],
};

function UserProfilePage({ onReload, onGoTo }) {
  const u = CURRENT_USER;

  return (
    <React.Fragment>
      <Omnibar icon="PersonLines" title="Your profile">
        <button
          type="button"
          className="iconbtn"
          aria-label="Reload"
          title="Reload"
          onClick={() => { showToast("Profile refreshed"); onReload && onReload(); }}
        >
          <Icon name="Refresh" size={18} />
        </button>
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={() => onGoTo && onGoTo("userSettings")}
        >
          <Icon name="Settings" size={16} />Settings
        </button>
      </Omnibar>

      <div className="acct-page">
        {/* ---------- Hero ---------- */}
        <section className="acct-hero">
          <div className="acct-hero-avatar" aria-hidden="true">{u.initials}</div>
          <div className="acct-hero-info">
            <div className="acct-hero-pillrow">
              <span className="req-pill req-pill--success">
                <span className="acct-pill-dot" aria-hidden="true" />
                {u.status}
              </span>
              <span className="acct-rolechip acct-rolechip--primary">
                <Icon name="Lock" size={12} />Admin
              </span>
            </div>
            <h1 className="acct-hero-name">{u.fullName}</h1>
            <p className="acct-hero-role">{u.title} · {u.employer}</p>
            <ul className="acct-hero-meta">
              <li>
                <span className="acct-meta-ico" aria-hidden="true"><Icon name="PersonLines" size={14} /></span>
                <span>{u.username}</span>
              </li>
              <li>
                <span className="acct-meta-ico" aria-hidden="true"><Icon name="Phone" size={14} /></span>
                <a href={`tel:${u.phone.replace(/[^0-9+]/g, "")}`}>{u.phone}</a>
              </li>
              <li>
                <span className="acct-meta-ico" aria-hidden="true"><Icon name="Globe" size={14} /></span>
                <a href={`mailto:${u.email}`}>{u.email}</a>
              </li>
            </ul>
          </div>
          <div className="acct-hero-actions">
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => showToast("Profile photo upload — preview only")}
            >
              <Icon name="Edit" size={16} />Edit profile
            </button>
          </div>
        </section>

        {/* ---------- Account details ---------- */}
        <section className="acct-card">
          <div className="acct-card-head">
            <h2 className="acct-card-title">Account details</h2>
            <button
              type="button"
              className="linkbtn"
              onClick={() => showToast("Account details — preview only")}
            >
              Edit
            </button>
          </div>
          <dl className="acct-dl">
            <div className="acct-row">
              <dt>Employee ID</dt>
              <dd className="tabular">{u.employeeId}</dd>
            </div>
            <div className="acct-row">
              <dt>Department</dt>
              <dd>{u.department}</dd>
            </div>
            <div className="acct-row">
              <dt>Manager</dt>
              <dd>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); showToast(`Opening profile for ${u.manager}`); }}
                >{u.manager}</a>
              </dd>
            </div>
            <div className="acct-row">
              <dt>Hire date</dt>
              <dd>{u.hireDate}</dd>
            </div>
            <div className="acct-row">
              <dt>Time zone</dt>
              <dd>{u.timeZone}</dd>
            </div>
            <div className="acct-row">
              <dt>Last sign-in</dt>
              <dd>{u.lastSignIn}</dd>
            </div>
          </dl>
        </section>

        {/* ---------- Access & roles ---------- */}
        <section className="acct-card">
          <div className="acct-card-head">
            <div>
              <h2 className="acct-card-title">Access &amp; roles</h2>
              <p className="acct-card-sub">Granted by Dayforce administrators. Requests are reviewed by your IT team.</p>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => showToast("Access request — preview only")}
            >
              <Icon name="AddCircle" size={14} />Request access
            </button>
          </div>
          <ul className="acct-list" aria-label="Granted roles">
            {u.roles.map((r) => (
              <li key={r.id} className="acct-list-item">
                <span className="acct-list-icon acct-list-icon--info" aria-hidden="true">
                  <Icon name="Lock" size={18} />
                </span>
                <div>
                  <p className="acct-list-title">{r.label}</p>
                  <p className="acct-list-sub">{r.scope}</p>
                </div>
                <span className="acct-list-trail">Granted Mar 14, 2022</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Recent sessions ---------- */}
        <section className="acct-card">
          <div className="acct-card-head">
            <div>
              <h2 className="acct-card-title">Recent sessions</h2>
              <p className="acct-card-sub">Devices currently signed in to your Dayforce account.</p>
            </div>
            <button
              type="button"
              className="linkbtn"
              onClick={() => openConfirm({
                title: "Sign out of all other sessions?",
                body: "You'll stay signed in on this device. Everything else will be ended.",
                primaryLabel: "Sign out everywhere else",
                onConfirm: () => showToast("All other sessions signed out", { kind: "success" }),
              })}
            >
              Sign out everywhere else
            </button>
          </div>
          <ul className="acct-list" aria-label="Recent sessions">
            {u.sessions.map((s) => (
              <li key={s.id} className="acct-list-item">
                <span className="acct-list-icon acct-list-icon--ok" aria-hidden="true">
                  <Icon name="View" size={18} />
                </span>
                <div>
                  <p className="acct-list-title">
                    {s.device}
                    {s.current && <span className="acct-current-tag">This device</span>}
                  </p>
                  <p className="acct-list-sub">{s.where}{s.where_note ? ` · ${s.where_note}` : ""}</p>
                </div>
                <span className="acct-list-trail">{s.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { UserProfilePage, CURRENT_USER });
