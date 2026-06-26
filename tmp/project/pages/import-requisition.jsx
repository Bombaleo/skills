// =====================================================================
// Flex Work — Import requisition from file
//   · ImportRequisitionPanel — side panel that accepts a CSV/Excel file,
//     parses it into a requisition draft (locations + cost centers +
//     bookings + schedules), shows a preview with row-level validation,
//     and applies it to the New Order flow on the user's confirmation.
//
//   · The matching "Imported" applied chip lives in the TemplatePicker
//     surface (requisition-templates.jsx) — both surfaces share the
//     `appliedImport` shape, which is null when no import is applied or
//     { fileName, rowCount, locations, costCenters, bookings, schedules }
//     when one is.
//
//   · This is a prototype: the parser is a small heuristic that returns
//     one of a few canned shapes based on the file name. Real product
//     would call a server-side parser + column mapper.
// =====================================================================

const { useState: useImpState, useEffect: useImpEffect, useRef: useImpRef } = React;

// ---------- Canned import outcomes -------------------------------------
// Mirror the shape of `templateAsDraft`: { locations, costCenters,
// bookings, schedules }. The picker chooses one by file name; defaults
// to "production" when nothing matches.

const _IMPORT_PRESETS = {
  production: {
    label: "Production line crew",
    rowCount: 14,
    locations: ["Manufacturing A", "Manufacturing B"],
    costCenters: ["Site 01", "Site 02"],
    bookings: [
      { id: 1, quantity: 8, job: "Production Line Associate", locations: ["Manufacturing A", "Manufacturing B"] },
      { id: 2, quantity: 4, job: "Packers",                   locations: ["Manufacturing A"] },
      { id: 3, quantity: 2, job: "Quality Inspector",         locations: ["Manufacturing B"] },
    ],
    schedules: [
      { id: 1, dates: "May 25 – May 29", start: "6:00 AM",  end: "3:00 PM", bookings: ["Work assignment 1", "Work assignment 2"] },
      { id: 2, dates: "May 25 – May 29", start: "3:00 PM",  end: "11:00 PM", bookings: ["Work assignment 1"] },
      { id: 3, dates: "May 28",          start: "9:00 AM",  end: "1:00 PM",  bookings: ["Work assignment 3"] },
    ],
  },
  warehouse: {
    label: "Warehouse surge",
    rowCount: 8,
    locations: ["Distribution Center 1", "Distribution Center 2"],
    costCenters: ["Site 05"],
    bookings: [
      { id: 1, quantity: 12, job: "Pickers",          locations: ["Distribution Center 1", "Distribution Center 2"] },
      { id: 2, quantity: 4,  job: "Loader / Unloader", locations: ["Distribution Center 1"] },
    ],
    schedules: [
      { id: 1, dates: "May 22", start: "8:00 AM", end: "5:00 PM", bookings: ["Work assignment 1", "Work assignment 2"] },
    ],
  },
  forklift: {
    label: "Overnight forklift",
    rowCount: 6,
    locations: ["Manufacturing C", "Manufacturing D"],
    costCenters: ["Site 03", "Site 04"],
    bookings: [
      { id: 1, quantity: 4, job: "Forklift Operator", locations: ["Manufacturing C", "Manufacturing D"] },
    ],
    schedules: [
      { id: 1, dates: "May 23 – May 24", start: "11:00 PM", end: "7:00 AM", bookings: ["Work assignment 1"] },
    ],
  },
};

function _guessPresetFromName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("wareh") || n.includes("picker") || n.includes("dc"))   return _IMPORT_PRESETS.warehouse;
  if (n.includes("fork")  || n.includes("overnight"))                    return _IMPORT_PRESETS.forklift;
  return _IMPORT_PRESETS.production;
}

// Total headcount across bookings.
function _sumHeadcount(bookings) {
  return (bookings || []).reduce((acc, b) => acc + (Number(b.quantity) || 0), 0);
}

// Format a file size for display.
function _fmtBytes(b) {
  if (!b && b !== 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Pretty extension label.
function _fmtFormat(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  if (ext === "csv")  return "CSV";
  if (ext === "xlsx" || ext === "xls") return "Excel";
  if (ext === "tsv")  return "TSV";
  return ext.toUpperCase();
}

// ---------- ImportRequisitionPanel -------------------------------------

function ImportRequisitionPanel({ open, onClose, onApply }) {
  // step: "drop" → "preview" (after parse) → "applied" (closes)
  const [step, setStep]         = useImpState("drop");
  const [file, setFile]         = useImpState(null);     // { name, size }
  const [parsing, setParsing]   = useImpState(false);
  const [draft, setDraft]       = useImpState(null);     // parsed preset
  const [drag, setDrag]         = useImpState(false);
  const inputRef                = useImpRef(null);

  // Reset state every time the panel opens.
  useImpEffect(() => {
    if (!open) return;
    setStep("drop");
    setFile(null);
    setParsing(false);
    setDraft(null);
    setDrag(false);
  }, [open]);

  const handleFiles = (fileList) => {
    const f = fileList && fileList[0];
    if (!f) return;
    setFile({ name: f.name, size: f.size });
    setParsing(true);
    // Simulate a short parse delay so the user sees feedback.
    setTimeout(() => {
      const preset = _guessPresetFromName(f.name);
      setDraft(preset);
      setParsing(false);
      setStep("preview");
    }, 650);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  };

  const onPickClick = () => inputRef.current && inputRef.current.click();
  const onChange    = (e) => handleFiles(e.target.files);

  const reset = () => {
    setStep("drop");
    setFile(null);
    setDraft(null);
  };

  const apply = () => {
    if (!draft || !file) return;
    onApply && onApply({
      fileName: file.name,
      fileSize: file.size,
      rowCount: draft.rowCount,
      locations:   draft.locations,
      costCenters: draft.costCenters,
      bookings:    draft.bookings,
      schedules:   draft.schedules,
    });
  };

  const downloadTemplate = () => {
    if (typeof showToast === "function") {
      showToast("Downloading requisition_import_template.csv", { kind: "success" });
    }
  };

  // ---------- Footer ----------
  const footer = (
    <React.Fragment>
      <span aria-hidden="true" />
      {step === "drop" && (
        <button type="button" className="btn btn--lg btn--primary" disabled>
          Import
        </button>
      )}
      {step === "preview" && (
        <button type="button" className="btn btn--lg btn--primary" onClick={apply}>
          <Icon name="Check" size={16} />Import
        </button>
      )}
    </React.Fragment>
  );

  return (
    <SidePanel open={open} title="Import requisition" onClose={onClose} footer={footer}>
      {/* v0.77 spec §08 · the CSV/XLSX template gains three optional
          columns (workType · billingModel · supplierType) in Phase 4.
          Per-row inference falls back to the §22 Phase 1 derivation if
          the columns are missing or blank; WORK_x_PAY violations fail
          import preview with a suggested-cell message. Banner hidden
          at flag-off. */}
      {window.V77InfoBanner ? (
        <window.V77InfoBanner
          icon="Information"
          title="Import template will accept axis columns in Phase 4."
        >
          Three optional columns &mdash; <code>workType</code>, <code>billingModel</code>, <code>supplierType</code> &mdash; will let you set the axis tuple per row. Today&rsquo;s imports continue to infer from <code>sourcingChannel</code> + id-prefix.
        </window.V77InfoBanner>
      ) : null}
      {step === "drop" && (
        <ImportDropStep
          file={file}
          parsing={parsing}
          drag={drag}
          inputRef={inputRef}
          onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onPickClick={onPickClick}
          onChange={onChange}
          onDownloadTemplate={downloadTemplate}
        />
      )}
      {step === "preview" && draft && file && (
        <ImportPreviewStep
          file={file}
          draft={draft}
          onReset={reset}
        />
      )}
    </SidePanel>
  );
}

// ---------- Drop step --------------------------------------------------

function ImportDropStep({
  file, parsing, drag, inputRef,
  onDragEnter, onDragOver, onDragLeave, onDrop,
  onPickClick, onChange, onDownloadTemplate,
}) {
  return (
    <React.Fragment>
      <p className="imp-lead">
        Upload a CSV or Excel file of work assignments to prefill this requisition.
        Each row becomes a work assignment; sites, departments, and schedules
        are derived from the file.
      </p>

      <div
        className={"imp-drop" + (drag ? " imp-drop--drag" : "") + (parsing ? " imp-drop--parsing" : "")}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={parsing ? undefined : onPickClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !parsing) onPickClick(); }}
      >
        <span className="imp-drop-icon" aria-hidden="true">
          <Icon name={parsing ? "Hourglass" : "FileUpload"} size={28} />
        </span>
        {parsing ? (
          <React.Fragment>
            <span className="imp-drop-title">Parsing {file?.name}…</span>
            <span className="imp-drop-sub">Reading rows and validating columns</span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span className="imp-drop-title">Drop a file or click to browse</span>
            <span className="imp-drop-formats">CSV · XLSX · up to 5 MB</span>
          </React.Fragment>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{ display: "none" }}
          onChange={onChange}
        />
      </div>

      <a
        className="imp-template-link"
        onClick={(e) => { e.preventDefault(); onDownloadTemplate(); }}
        href="#"
      >
        <span className="imp-template-icon" aria-hidden="true">
          <Icon name="File" size={24} />
        </span>
        <span className="imp-template-body">
          <span className="imp-template-name">Download import template</span>
          <span className="imp-template-sub">requisition_import_template.csv · 1.4 KB</span>
        </span>
      </a>
    </React.Fragment>
  );
}

function ImpCol({ name, hint, optional }) {
  return (
    <div className="imp-schema-row">
      <span className="imp-schema-name">
        <code>{name}</code>
        {optional && <span className="imp-schema-opt">optional</span>}
      </span>
      <span className="imp-schema-hint">{hint}</span>
    </div>
  );
}

// ---------- Preview step -----------------------------------------------

function ImportPreviewStep({ file, draft, onReset }) {
  const headcount = _sumHeadcount(draft.bookings);

  return (
    <React.Fragment>
      <div className="imp-file">
        <span className="imp-file-icon" aria-hidden="true">
          <Icon name={_fmtFormat(file.name) === "Excel" ? "Excel" : "File"} size={20} />
        </span>
        <span className="imp-file-body">
          <span className="imp-file-name">{file.name}</span>
          <span className="imp-file-meta">
            {_fmtFormat(file.name)}<span aria-hidden="true">·</span>
            {_fmtBytes(file.size)}<span aria-hidden="true">·</span>
            {draft.rowCount} rows
          </span>
        </span>
        <button type="button" className="btn btn--sm btn--tertiary" onClick={onReset}>
          <Icon name="Cancel" size={14} />Replace
        </button>
      </div>

      <div className="imp-result">
        <span className="imp-result-icon" aria-hidden="true">
          <Icon name="Check" size={16} />
        </span>
        <span className="imp-result-body">
          <span className="imp-result-title">
            {draft.rowCount} rows parsed · {draft.bookings.length} work assignment{draft.bookings.length === 1 ? "" : "s"} · {draft.schedules.length} schedule{draft.schedules.length === 1 ? "" : "s"}
          </span>
          <span className="imp-result-sub">All required columns present. No validation errors.</span>
        </span>
      </div>

      <ImpPreviewSection
        icon="Pin"
        title="Sites"
        count={draft.locations.length}
      >
        <div className="imp-chips">
          {draft.locations.map((l) => (
            <span key={l} className="imp-chip">{l}</span>
          ))}
        </div>
      </ImpPreviewSection>

      <ImpPreviewSection
        icon="Receipt"
        title="Departments"
        count={draft.costCenters.length}
      >
        <div className="imp-chips">
          {draft.costCenters.map((c) => (
            <span key={c} className="imp-chip">{c}</span>
          ))}
        </div>
      </ImpPreviewSection>

      <ImpPreviewSection
        icon="Briefcase"
        title="Work assignments"
        count={draft.bookings.length}
        meta={`${headcount} total headcount`}
      >
        <div className="imp-table">
          <div className="imp-table-row imp-table-row--head">
            <span>Job</span>
            <span>Qty</span>
            <span>Sites</span>
          </div>
          {draft.bookings.map((b, i) => (
            <div className="imp-table-row" key={b.id}>
              <span className="imp-table-job">
                <span className="imp-table-bidx">B{i + 1}</span>
                {b.job}
              </span>
              <span className="imp-table-qty">{b.quantity}</span>
              <span className="imp-table-locs">{b.locations.join(", ")}</span>
            </div>
          ))}
        </div>
      </ImpPreviewSection>

      <ImpPreviewSection
        icon="Calendar"
        title="Schedules"
        count={draft.schedules.length}
      >
        <div className="imp-sched">
          {draft.schedules.map((s) => (
            <div className="imp-sched-row" key={s.id}>
              <span className="imp-sched-dates">{s.dates}</span>
              <span className="imp-sched-time">{s.start} – {s.end}</span>
              <span className="imp-sched-bks">
                {s.bookings.map((b) => (
                  <span key={b} className="imp-sched-chip">{b}</span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </ImpPreviewSection>

      <p className="imp-foot-note">
        Applying replaces the current draft&apos;s sites, departments,
        work assignments, and schedules. You can edit anything once it&apos;s loaded.
      </p>
    </React.Fragment>
  );
}

function ImpPreviewSection({ icon, title, count, meta, children }) {
  return (
    <section className="imp-section">
      <header className="imp-section-head">
        <span className="imp-section-icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
        <span className="imp-section-title">{title}</span>
        <span className="imp-section-count">{count}</span>
        {meta && <span className="imp-section-meta">{meta}</span>}
      </header>
      <div className="imp-section-body">{children}</div>
    </section>
  );
}

// ---------- Applied "Imported from file" chip --------------------------
// Mirrors the TemplateApplied chip but green-teal, with file metadata.

function ImportAppliedChip({ source, onChange, onClear }) {
  if (!source) return null;
  return (
    <div className="imp-applied">
      <span className="imp-applied-icon" aria-hidden="true">
        <Icon name="FileUpload" size={18} />
      </span>
      <span className="imp-applied-body">
        <span className="imp-applied-label">Imported from file</span>
        <span className="imp-applied-name">{source.fileName}</span>
      </span>
      <span className="imp-applied-meta">
        {source.rowCount} rows
        <span aria-hidden="true">·</span>
        {source.bookings.length} work assignment{source.bookings.length === 1 ? "" : "s"}
        <span aria-hidden="true">·</span>
        {source.schedules.length} schedule{source.schedules.length === 1 ? "" : "s"}
        <span aria-hidden="true">·</span>
        {source.locations.length} location{source.locations.length === 1 ? "" : "s"}
      </span>
      <span className="imp-applied-actions">
        <button type="button" className="btn btn--sm btn--tertiary" onClick={onChange}>
          Replace
        </button>
        <button type="button" className="btn btn--sm btn--tertiary" onClick={onClear}>
          <Icon name="Cancel" size={14} />Clear
        </button>
      </span>
    </div>
  );
}

Object.assign(window, {
  ImportRequisitionPanel,
  ImportAppliedChip,
});
