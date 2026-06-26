// =====================================================================
// Flex Work — Internal Help Center · Section renderers
//   Per-section detail components for everything outside Features:
//   Onboarding guides, Field playbooks, Release notes, Competitive
//   briefs, Glossary, Internal contacts. Each follows the same hero +
//   numbered-section pattern as the feature pages.
//
//   Exposes window.HcSectionRouter(section) which help-center.jsx
//   calls to render the active non-Features section. Returns null for
//   unknown sections so the page can fall back gracefully.
// =====================================================================

const { useState: useStateHCS, useEffect: useEffectHCS, useMemo: useMemoHCS } = React;

// ---------- Shared bits ------------------------------------------------
function HcsStamp({ owner, updated }) {
  // Show owner + updated on the page hero. 90-day staleness banner
  // fires when the page passes the threshold.
  if (!owner && !updated) return null;
  const ageDays = updated
    ? Math.floor((Date.parse("2026-05-26") - Date.parse(updated)) / 86400000)
    : null;
  const stale = ageDays != null && ageDays > 90;
  return (
    <div className={`hc-stamp${stale ? " is-stale" : ""}`}>
      {owner && (
        <span className="hc-stamp-owner">
          <Icon name="PersonLines" size={12} />
          <span>{owner}</span>
        </span>
      )}
      {updated && (
        <span className="hc-stamp-date">
          <Icon name="Calendar" size={12} />
          <span>Updated {updated}</span>
          {ageDays != null && <span className="hc-stamp-age"> · {ageDays}d ago</span>}
        </span>
      )}
      {stale && (
        <span className="hc-stamp-stale">
          <Icon name="Information" size={12} />
          <span>Past 90-day review — flag the owner</span>
        </span>
      )}
    </div>
  );
}

function HcsSectionHead({ num, title, count }) {
  return (
    <h2 className="hc-feat-h">
      <span className="hc-feat-h-num">{num}</span>
      <span className="hc-feat-h-title">{title}</span>
      {count != null && <span className="hc-feat-h-count">{count}</span>}
    </h2>
  );
}

// ---------- 1. Onboarding guides --------------------------------------
function HcsOnboarding({ section }) {
  const data = window.HC_ONBOARDING || [];
  const [openId, setOpenId] = useStateHCS(data[0]?.id || null);
  const open = data.find((p) => p.id === openId) || data[0];
  if (!open) return null;

  return (
    <article className="hc-feat" aria-labelledby="hc-sec-title">
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name="ClipboardCircleCheck" size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcChip tone="informative" icon="Stack">Section · Onboarding guides</HcChip>
            <HcChip tone="muted">{data.length} playbooks</HcChip>
          </div>
          <h1 id="hc-sec-title" className="hc-feat-hero-title">Onboarding guides</h1>
          <p className="hc-feat-hero-tag">Implementation playbooks by program shape. Each playbook lays out phases with day-counts, a configuration checklist, and the pitfalls implementations actually hit.</p>
        </div>
      </header>

      {/* Playbook switcher */}
      <nav className="hc-pb-switch" aria-label="Choose a playbook">
        {data.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`hc-pb-switch-btn${p.id === open.id ? " is-active" : ""}`}
            onClick={() => setOpenId(p.id)}
          >
            <span className="hc-pb-switch-name">{p.name}</span>
            <span className="hc-pb-switch-dur">{p.duration}</span>
          </button>
        ))}
      </nav>

      <HcsStamp owner={open.owner} updated={open.updated} />

      <section className="hc-feat-section">
        <HcsSectionHead num="01" title="Overview" />
        <p className="hc-feat-lede">{open.summary}</p>
        <p className="hc-feat-meta-line">
          <Icon name="PersonLines" size={14} />
          <span><b>Best fit:</b> {open.audience}</span>
        </p>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="02" title="Phases" count={open.phases.length} />
        <ol className="hc-pb-phases">
          {open.phases.map((ph, i) => (
            <li key={i} className="hc-pb-phase">
              <div className="hc-pb-phase-label">
                <span className="hc-pb-phase-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="hc-pb-phase-when">{ph.label}</span>
              </div>
              <div className="hc-pb-phase-body">
                <p className="hc-pb-phase-title">{ph.title}</p>
                <p className="hc-pb-phase-text">{ph.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="03" title="Configuration checklist" count={open.checklist.length} />
        <ul className="hc-pb-check">
          {open.checklist.map((c, i) => (
            <li key={i} className="hc-pb-check-item">
              <span className="hc-pb-check-box" aria-hidden="true">
                <Icon name="Check" size={12} />
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="04" title="Pitfalls" count={open.pitfalls.length} />
        <ul className="hc-pb-pitfalls">
          {open.pitfalls.map((p, i) => (
            <li key={i} className="hc-pb-pitfall">
              <span className="hc-pb-pitfall-dot" aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

// ---------- 2. Field playbooks ---------------------------------------
function HcsPlaybooks({ section }) {
  const data = window.HC_PLAYBOOKS || [];
  const [openId, setOpenId] = useStateHCS(data[0]?.id || null);
  const open = data.find((p) => p.id === openId) || data[0];
  if (!open) return null;

  return (
    <article className="hc-feat" aria-labelledby="hc-sec-title">
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name="Notes" size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcChip tone="informative" icon="Stack">Section · Field playbooks</HcChip>
            <HcChip tone="muted">{data.length} patterns</HcChip>
          </div>
          <h1 id="hc-sec-title" className="hc-feat-hero-title">Field playbooks</h1>
          <p className="hc-feat-hero-tag">Pattern-level guidance for the configurations CSMs run into in the field. Each playbook covers when to use it, the trade-offs it commits you to, and the failure modes that put a program in recovery.</p>
        </div>
      </header>

      <nav className="hc-pb-switch" aria-label="Choose a playbook">
        {data.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`hc-pb-switch-btn${p.id === open.id ? " is-active" : ""}`}
            onClick={() => setOpenId(p.id)}
          >
            <span className="hc-pb-switch-name">{p.name}</span>
            <span className="hc-pb-switch-dur">{p.intent}</span>
          </button>
        ))}
      </nav>

      <HcsStamp owner={open.owner} updated={open.updated} />

      <section className="hc-feat-section">
        <HcsSectionHead num="01" title="Overview" />
        <p className="hc-feat-lede">{open.summary}</p>
        <p className="hc-feat-meta-line">
          <Icon name="PersonLines" size={14} />
          <span><b>Audience:</b> {open.audience}</span>
        </p>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="02" title="When to use" count={open.whenToUse.length} />
        <ul className="hc-pb-when">
          {open.whenToUse.map((t, i) => (
            <li key={i} className="hc-pb-when-item">
              <span className="hc-pb-when-dot" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="03" title="Trade-offs" count={open.tradeoffs.length} />
        <ul className="hc-pb-trade">
          {open.tradeoffs.map((t, i) => (
            <li key={i} className="hc-pb-trade-row">
              <div className="hc-pb-trade-cell hc-pb-trade-cell--pro">
                <span className="hc-pb-trade-tag">Gain</span>
                <p>{t.left}</p>
              </div>
              <div className="hc-pb-trade-cell hc-pb-trade-cell--con">
                <span className="hc-pb-trade-tag">Pay</span>
                <p>{t.right}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="04" title="Failure modes" count={open.failureModes.length} />
        <ul className="hc-pb-pitfalls">
          {open.failureModes.map((p, i) => (
            <li key={i} className="hc-pb-pitfall">
              <span className="hc-pb-pitfall-dot" aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="05" title="Recommended configuration" count={open.config.length} />
        <ul className="hc-pb-check">
          {open.config.map((c, i) => (
            <li key={i} className="hc-pb-check-item">
              <span className="hc-pb-check-box" aria-hidden="true">
                <Icon name="Check" size={12} />
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {open.related && open.related.length > 0 && (
        <section className="hc-feat-section">
          <HcsSectionHead num="06" title="Related patterns" />
          <ul className="hc-pb-related">
            {open.related.map((r, i) => (
              <li key={i} className="hc-pb-related-item">
                <Icon name="ArrowRight" size={14} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

// ---------- 3. Release notes (embeds the canonical changelog) -------
function HcsReleaseNotes({ section }) {
  return (
    <article className="hc-feat" aria-labelledby="hc-sec-title">
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name="Bolt" size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcChip tone="informative" icon="Stack">Section · Release notes</HcChip>
            <HcChip tone="success" icon="Check">Canonical source</HcChip>
          </div>
          <h1 id="hc-sec-title" className="hc-feat-hero-title">Release notes</h1>
          <p className="hc-feat-hero-tag">The single source of truth for what shipped, when, and why. This view embeds <code>Flex Work v2 Changelog.html</code> directly — one file, no copies, no drift.</p>
        </div>
      </header>

      <div className="hc-rn-actions">
        <a
          className="btn btn--md btn--secondary"
          href="Flex Work v2 Changelog.html"
          target="_blank"
          rel="noopener"
        >
          <Icon name="LinkNewWindow" size={16} />Open the full changelog
        </a>
        <span className="hc-rn-note">
          <Icon name="Information" size={14} />
          <span>The changelog updates as part of every shipped change. See <code>CLAUDE.md</code> for the contract.</span>
        </span>
      </div>

      <div className="hc-rn-embed-frame">
        <iframe
          className="hc-rn-iframe"
          src="Flex Work v2 Changelog.html"
          title="Flex Work v2 Changelog"
          loading="lazy"
        />
      </div>
    </article>
  );
}

// ---------- 4. Competitive briefs ------------------------------------
function HcsBattlecards({ section }) {
  const data = window.HC_BATTLECARDS || [];
  const [openId, setOpenId] = useStateHCS(data[0]?.id || null);
  const open = data.find((b) => b.id === openId) || data[0];
  if (!open) return null;

  return (
    <article className="hc-feat" aria-labelledby="hc-sec-title">
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name="BarChart" size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcChip tone="informative" icon="Stack">Section · Competitive briefs</HcChip>
            <HcChip tone="muted">{data.length} battlecards</HcChip>
            <HcChip tone="warning" icon="Information">Internal-only</HcChip>
          </div>
          <h1 id="hc-sec-title" className="hc-feat-hero-title">Competitive briefs</h1>
          <p className="hc-feat-hero-tag">Battlecards for every named competitor. Each card covers their strongest area, their weakest, the deals we win, the deals they win, and the talk track for the head-to-head. Don't share these verbatim with customers.</p>
        </div>
      </header>

      <nav className="hc-bc-switch" aria-label="Choose a competitor">
        {data.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`hc-bc-switch-btn${b.id === open.id ? " is-active" : ""}`}
            onClick={() => setOpenId(b.id)}
          >
            <span className="hc-bc-switch-name">{b.name}</span>
            <span className="hc-bc-switch-tag">{b.tagline}</span>
          </button>
        ))}
      </nav>

      <HcsStamp owner={open.owner} updated={open.updated} />

      <section className="hc-feat-section">
        <HcsSectionHead num="01" title="Positioning" />
        <p className="hc-feat-lede">{open.positioning}</p>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="02" title="Strongest module" />
        <div className="hc-bc-mod hc-bc-mod--strong">
          <Icon name="Check" size={16} />
          <p>{open.strongest}</p>
        </div>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="03" title="Weakest module" />
        <div className="hc-bc-mod hc-bc-mod--weak">
          <Icon name="X" size={16} />
          <p>{open.weakest}</p>
        </div>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="04" title="Deals we win" count={open.weWin.length} />
        <ul className="hc-bc-list hc-bc-list--win">
          {open.weWin.map((d, i) => (
            <li key={i}><Icon name="ArrowUp" size={14} /><span>{d}</span></li>
          ))}
        </ul>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="05" title={`Deals ${open.name} wins`} count={open.theyWin.length} />
        <ul className="hc-bc-list hc-bc-list--lose">
          {open.theyWin.map((d, i) => (
            <li key={i}><Icon name="ArrowDown" size={14} /><span>{d}</span></li>
          ))}
        </ul>
      </section>

      <section className="hc-feat-section">
        <HcsSectionHead num="06" title="Talk track" count={open.talkTrack.length} />
        <ol className="hc-bc-talk">
          {open.talkTrack.map((t, i) => (
            <li key={i} className="hc-bc-talk-item">
              <span className="hc-bc-talk-num">{String(i + 1).padStart(2, "0")}</span>
              <p>{t}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

// ---------- 5. Glossary ----------------------------------------------
function HcsGlossary({ section }) {
  const data = window.HC_GLOSSARY || { groups: [] };
  const [q, setQ] = useStateHCS("");
  const query = q.trim().toLowerCase();

  const groups = useMemoHCS(() => {
    if (!query) return data.groups;
    return data.groups
      .map((g) => ({
        ...g,
        terms: g.terms.filter((t) =>
          (t.term + " " + (t.expansion || "") + " " + t.body).toLowerCase().includes(query)
        ),
      }))
      .filter((g) => g.terms.length > 0);
  }, [data, query]);

  const totalCount = data.groups.reduce((n, g) => n + g.terms.length, 0);

  return (
    <article className="hc-feat" aria-labelledby="hc-sec-title">
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name="File" size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcChip tone="informative" icon="Stack">Section · Glossary</HcChip>
            <HcChip tone="muted">{totalCount} terms</HcChip>
          </div>
          <h1 id="hc-sec-title" className="hc-feat-hero-title">Glossary</h1>
          <p className="hc-feat-hero-tag">Terms a Dayforce employee on a Flex Work call should never have to look up mid-meeting.</p>
        </div>
      </header>

      <HcsStamp owner={data.owner} updated={data.updated} />

      <div className="hc-gl-search">
        <Icon name="Search" size={14} />
        <input
          type="search"
          className="hc-gl-search-input"
          placeholder="Filter terms"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter glossary terms"
        />
        {q && (
          <button type="button" className="hc-gl-search-clear" onClick={() => setQ("")} aria-label="Clear filter">
            <Icon name="X" size={12} />
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="hc-feat-lede">No terms match "{q}". <button type="button" className="hc-link" onClick={() => setQ("")}>Clear filter</button>.</p>
      ) : (
        groups.map((g, gi) => (
          <section className="hc-feat-section" key={g.id} id={`gl-${g.id}`}>
            <HcsSectionHead num={String(gi + 1).padStart(2, "0")} title={g.title} count={g.terms.length} />
            {g.summary && <p className="hc-feat-meta-line">{g.summary}</p>}
            <dl className="hc-gl-list">
              {g.terms.map((t, ti) => (
                <div key={ti} className="hc-gl-row" id={`gl-${g.id}-${t.term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <dt className="hc-gl-term">
                    <span className="hc-gl-term-name">{t.term}</span>
                    {t.expansion && <span className="hc-gl-term-exp">{t.expansion}</span>}
                  </dt>
                  <dd className="hc-gl-def">{t.body}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </article>
  );
}

// ---------- 6. Internal contacts -------------------------------------
function HcsContacts({ section }) {
  const data = window.HC_CONTACTS || { domains: [], escalation: [], forums: [] };

  return (
    <article className="hc-feat" aria-labelledby="hc-sec-title">
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name="Phone" size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcChip tone="informative" icon="Stack">Section · Internal contacts</HcChip>
            <HcChip tone="muted">{data.domains.length} domains</HcChip>
          </div>
          <h1 id="hc-sec-title" className="hc-feat-hero-title">Internal contacts</h1>
          <p className="hc-feat-hero-tag">Escalation paths by domain. Slack first; named owners for escalations the triage layer can't close.</p>
        </div>
      </header>

      <HcsStamp owner={data.owner} updated={data.updated} />

      {/* Triage panel */}
      {data.triage && (
        <section className="hc-feat-section">
          <HcsSectionHead num="01" title="First-line triage" />
          <div className="hc-ct-triage">
            <div className="hc-ct-triage-row">
              <span className="hc-ct-triage-label"><Icon name="Phone" size={14} />Slack</span>
              <code className="hc-ct-triage-val">{data.triage.channel}</code>
            </div>
            <div className="hc-ct-triage-row">
              <span className="hc-ct-triage-label"><Icon name="LinkNewWindow" size={14} />Email</span>
              <code className="hc-ct-triage-val">{data.triage.email}</code>
            </div>
            <div className="hc-ct-triage-row">
              <span className="hc-ct-triage-label"><Icon name="Hourglass" size={14} />SLA</span>
              <span className="hc-ct-triage-val">{data.triage.sla}</span>
            </div>
            <p className="hc-ct-triage-note">
              <Icon name="Information" size={14} />
              <span>{data.triage.note}</span>
            </p>
          </div>
        </section>
      )}

      {/* Domains */}
      <section className="hc-feat-section">
        <HcsSectionHead num="02" title="Domain owners" count={data.domains.length} />
        <div className="hc-ct-domains">
          {data.domains.map((d) => (
            <div key={d.id} className="hc-ct-domain">
              <p className="hc-ct-domain-title">{d.title}</p>
              <p className="hc-ct-domain-sub">{d.summary}</p>
              <ul className="hc-ct-people">
                {d.people.map((p, i) => (
                  <li key={i} className="hc-ct-person">
                    <span className="hc-ct-person-name">{p.name}</span>
                    <span className="hc-ct-person-role">{p.role}</span>
                    <code className="hc-ct-person-ch">{p.channel}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Escalation matrix */}
      {data.escalation && data.escalation.length > 0 && (
        <section className="hc-feat-section">
          <HcsSectionHead num="03" title="Escalation matrix" count={data.escalation.length} />
          <ul className="hc-ct-esc">
            {data.escalation.map((e, i) => (
              <li key={i} className="hc-ct-esc-row">
                <span className="hc-ct-esc-trigger">{e.trigger}</span>
                <span className="hc-ct-esc-arrow" aria-hidden="true"><Icon name="ArrowRight" size={14} /></span>
                <span className="hc-ct-esc-route">{e.route}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Forums */}
      {data.forums && data.forums.length > 0 && (
        <section className="hc-feat-section">
          <HcsSectionHead num="04" title="Standing forums" count={data.forums.length} />
          <ul className="hc-ct-forums">
            {data.forums.map((f, i) => (
              <li key={i} className="hc-ct-forum">
                <p className="hc-ct-forum-name">{f.name}</p>
                <p className="hc-ct-forum-cadence">{f.cadence}</p>
                <p className="hc-ct-forum-purpose">{f.purpose}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

// ---------- Router ----------------------------------------------------
function HcSectionRouter({ section }) {
  if (section === "onboarding")  return <HcsOnboarding section={section} />;
  if (section === "playbooks")   return <HcsPlaybooks section={section} />;
  if (section === "release")     return <HcsReleaseNotes section={section} />;
  if (section === "competitive") return <HcsBattlecards section={section} />;
  if (section === "glossary")    return <HcsGlossary section={section} />;
  return null;
}

Object.assign(window, {
  HcSectionRouter,
  HcsStamp,
});
