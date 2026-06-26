// =====================================================================
// Flex Work — Login screen
// Three-step sign in:
//   1. Email           → validate, Continue
//   2. Organization    → pick a tenant ("Select"), persists industry pack
//   3. Role            → pick a role ("Select"), then enter the app
// Each later step can return to step 1 via the "Signing in as <email>" pill.
// =====================================================================

const { useState: useStateLogin, useEffect: useEffectLogin, useRef: useRefLogin } = React;

const LOGIN_ROLES = [
  { id: "admin",   label: "Admin",   icon: "Lock",            desc: "Full access to requisitions, suppliers, locations, and invoices." },
  { id: "manager", label: "Manager", icon: "ClipboardPerson", desc: "Approve shifts for your team and review timesheets." },
  { id: "worker",  label: "Worker",  icon: "PersonClock",     desc: "See your schedule, clock in, and view your pay." },
  { id: "agency",  label: "Agency",  icon: "Building",        desc: "Manage your roster and respond to open requisitions." },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginScreen({ onSignIn, initialEmail = "" }) {
  const [step, setStep]   = useStateLogin(1);
  const [email, setEmail] = useStateLogin(initialEmail);
  const [orgId, setOrgId] = useStateLogin(null);
  const [error, setError] = useStateLogin("");
  const emailRef          = useRefLogin(null);

  // Auto-focus email on step 1
  useEffectLogin(() => {
    if (step === 1 && emailRef.current) {
      emailRef.current.focus();
      emailRef.current.select && emailRef.current.select();
    }
  }, [step]);

  const emailValid = EMAIL_RE.test(email.trim());

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleOrgSelect = (id) => {
    setOrgId(id);
    setStep(3);
  };

  const handleRoleSelect = (roleId) => {
    // Persist industry choice so module-level data re-evaluates against it
    // on next page load. App.jsx also stores it for the live session.
    if (orgId && window.setCurrentIndustryId) window.setCurrentIndustryId(orgId);
    onSignIn && onSignIn({
      username: email.trim().split("@")[0],
      email: email.trim(),
      orgId,
      role: roleId,
    });
  };

  const goBackToEmail = () => {
    setStep(1);
    setOrgId(null);
  };

  const orgs    = (window.INDUSTRY_ORDER || []).map((id) => window.INDUSTRIES[id]).filter(Boolean);
  const orgName = (orgs.find((o) => o.id === orgId) || {}).name || "";

  return (
    <div className="login-shell" role="dialog" aria-modal="true" aria-label="Sign in to Dayforce Flex Work">
      <div className="login-stage">
        <section className="login-card">
          <div className="login-brand">
            <img src="assets/dayforce-flexwork-logo.svg" alt="Dayforce Flex Work" />
          </div>

          {step === 1 && (
            <React.Fragment>
              <header className="login-head">
                <h1 className="login-title">Welcome back!</h1>
                <p className="login-sub">Enter your email to proceed.</p>
              </header>
              <form className="login-form" onSubmit={handleEmailSubmit} noValidate>
                <div className="login-field">
                  <label className="login-field-label" htmlFor="login-email">
                    Email<span className="login-field-required" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={emailRef}
                    id="login-email"
                    className="login-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={error ? "true" : "false"}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                    spellCheck="false"
                  />
                  {error && (
                    <p className="login-input-error" role="alert">
                      <Icon name="Alert" size={14} />{error}
                    </p>
                  )}
                </div>
                <button type="submit" className="login-btn">Continue</button>
              </form>
            </React.Fragment>
          )}

          {step === 2 && (
            <React.Fragment>
              <header className="login-head">
                <h1 className="login-title">Select organization</h1>
                <p className="login-sub">
                  Your account is linked to several organizations. Choose the one you would like to proceed with.
                </p>
              </header>
              <ul className="login-rows" aria-label="Organizations">
                {orgs.map((org) => (
                  <li key={org.id} className="login-row">
                    <span className="login-row-logo">
                      <img src={org.logo} alt="" />
                    </span>
                    <div className="login-row-text">
                      <p className="login-row-name">{org.name}</p>
                      <p className="login-row-meta">{org.tag}</p>
                    </div>
                    <button
                      type="button"
                      className="login-row-select"
                      onClick={() => handleOrgSelect(org.id)}
                      aria-label={`Select ${org.name}`}
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            </React.Fragment>
          )}

          {step === 3 && (
            <React.Fragment>
              <header className="login-head">
                <h1 className="login-title">Select role</h1>
                <p className="login-sub">
                  You have multiple roles at <strong>{orgName}</strong>. Pick the role you'll use this session.
                </p>
              </header>
              <ul className="login-rows" aria-label="Roles">
                {LOGIN_ROLES
                  .filter((r) => {
                    const orgIsAgency = window.isAgencyOrg && window.isAgencyOrg(orgId);
                    // Agency org tenants only have the Agency role.
                    // Enterprise orgs never offer the Agency role.
                    return orgIsAgency ? r.id === "agency" : r.id !== "agency";
                  })
                  .map((r) => (
                  <li key={r.id} className="login-row">
                    <span className="login-row-logo login-row-logo--filled">
                      <Icon name={r.icon} size={20} />
                    </span>
                    <div className="login-row-text">
                      <p className="login-row-name">{r.label}</p>
                      <p className="login-row-meta">{r.desc}</p>
                    </div>
                    <button
                      type="button"
                      className="login-row-select"
                      onClick={() => handleRoleSelect(r.id)}
                      aria-label={`Sign in as ${r.label}`}
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            </React.Fragment>
          )}
        </section>

        {step > 1 && (
          <div className="login-asbar">
            <p className="login-asbar-label">You're signing in as</p>
            <button
              type="button"
              className="login-aspill"
              onClick={goBackToEmail}
              aria-label={`Signed in as ${email}. Change email.`}
            >
              <span>{email}</span>
              <Icon name="Edit" size={16} />
            </button>
          </div>
        )}
      </div>

      <footer className="login-footer">
        <nav className="login-footer-links" aria-label="Legal">
          <a href="#" onClick={(e) => { e.preventDefault(); showToast("Support routed to IT"); }}>Contact Support</a>
          <a href="#" onClick={(e) => { e.preventDefault(); showToast("Terms of Service — preview only"); }}>Terms of Service</a>
          <a href="#" onClick={(e) => { e.preventDefault(); showToast("Privacy Policy — preview only"); }}>Privacy Policy</a>
        </nav>
        <p className="login-footer-copy">© 2026 Dayforce Flex Work</p>
      </footer>
    </div>
  );
}

Object.assign(window, { LoginScreen, LOGIN_ROLES });
