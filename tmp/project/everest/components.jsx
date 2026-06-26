// Reusable Everest primitives — recreated 1:1 from the Everest Web Figma file.
// Where Figma reads "Inter", we use Clarika Grotesque (Inter was legacy).
// Where Figma reads "Clarika Geometric", we keep Clarika Geometric.

// ───────────────────────────────────────────────────────────────────────
// Button — pill-shaped. Sizes Small (24h) · Medium (32h) · Large (48h).
// Styles Primary (filled blue), Neutral (1px border), Tertiary (no border).
// Text: Clarika Grotesque Bold, letter-spacing 0.23px at 14 / 0 at 16.
// ───────────────────────────────────────────────────────────────────────
function Button({
  children, kind = "primary", size = "md", icon, iconRight,
  disabled = false, onClick, type = "button", style = {},
}) {
  const sizing = {
    sm: { h: 24, padX: 12, fz: 14, ls: "0.23px", iconSize: 16, gap: 4 },
    md: { h: 32, padX: 16, fz: 14, ls: "0.23px", iconSize: 16, gap: 4 },
    lg: { h: 48, padX: 16, fz: 16, ls: "0px",    iconSize: 24, gap: 8 },
  }[size];

  const styles = {
    primary: {
      bg: "var(--evr-blue-400)", fg: "var(--evr-neutral-95)",
      hover: "var(--evr-blue-500)", pressed: "var(--evr-blue-600)",
      border: "transparent",
    },
    neutral: {
      bg: "var(--evr-neutral-100)", fg: "var(--evr-neutral-12)",
      hover: "var(--evr-neutral-96)", pressed: "var(--evr-neutral-93)",
      border: "var(--evr-neutral-60)",
    },
    tertiary: {
      bg: "transparent", fg: "var(--evr-blue-400)",
      hover: "var(--evr-blue-50)", pressed: "var(--evr-blue-100)",
      border: "transparent",
    },
    danger: {
      bg: "var(--evr-red-400)", fg: "var(--evr-neutral-95)",
      hover: "var(--evr-red-500)", pressed: "var(--evr-red-600)",
      border: "transparent",
    },
  };
  const s = styles[kind];

  // Asymmetric padding when icon is on one side (figma pattern: 8px on icon side, 16px on text side)
  const padLeft  = icon ? Math.max(8, sizing.padX - 8) : sizing.padX;
  const padRight = iconRight ? Math.max(8, sizing.padX - 8) : sizing.padX;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: sizing.gap,
        height: sizing.h,
        padding: `0 ${padRight}px 0 ${padLeft}px`,
        fontFamily: "var(--evr-font-text)",
        fontWeight: 700,
        fontSize: sizing.fz,
        lineHeight: 1.5,
        letterSpacing: sizing.ls,
        background: disabled ? "var(--evr-neutral-97)" : s.bg,
        color:      disabled ? "var(--evr-neutral-50)"  : s.fg,
        border: `1px solid ${disabled ? "var(--evr-neutral-80)" : s.border}`,
        borderRadius: 24, // pill
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        whiteSpace: "nowrap",
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.background = s.pressed; }}
      onMouseUp={  (e) => { if (!disabled) e.currentTarget.style.background = s.hover; }}
      onMouseEnter={(e)=> { if (!disabled) e.currentTarget.style.background = s.hover; }}
      onMouseLeave={(e)=> { if (!disabled) e.currentTarget.style.background = s.bg;    }}
    >
      {icon && <Icon name={icon} size={sizing.iconSize} tint={kind === "primary" || kind === "danger" ? "white" : "default"} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizing.iconSize} tint={kind === "primary" || kind === "danger" ? "white" : "default"} />}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
// IconButton — circular, three sizes (24/32/40), three styles.
// ───────────────────────────────────────────────────────────────────────
function IconButton({ icon, label, size = 32, onClick, active = false, kind = "tertiary", badge = null, style = {} }) {
  const styles = {
    tertiary: {
      bg: "transparent", hover: "var(--evr-surface-secondary-hover)",
      color: "var(--evr-content-primary-default)",
      activeBg: "var(--evr-interactive-primary-decorative)", activeColor: "var(--evr-blue-500)",
      border: "transparent",
    },
    neutral: {
      bg: "var(--evr-neutral-100)", hover: "var(--evr-neutral-96)",
      color: "var(--evr-content-primary-default)",
      activeBg: "var(--evr-neutral-93)", activeColor: "var(--evr-neutral-12)",
      border: "var(--evr-neutral-60)",
    },
    primary: {
      bg: "var(--evr-blue-400)", hover: "var(--evr-blue-500)",
      color: "var(--evr-neutral-100)",
      activeBg: "var(--evr-blue-600)", activeColor: "var(--evr-neutral-100)",
      border: "transparent",
    },
  };
  const s = styles[kind];
  const iconSize = size <= 24 ? 16 : size <= 32 ? 20 : 24;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: "relative",
        width: size, height: size, padding: 0,
        background: active ? s.activeBg : s.bg,
        color:      active ? s.activeColor : s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 999, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "background 150ms",
        ...style,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = s.hover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = s.bg; }}
    >
      <Icon name={icon} size={iconSize} tint={kind === "primary" ? "white" : "default"} />
      {badge != null && (
        <span style={{
          position: "absolute", top: 0, right: 0, transform: "translate(25%, -25%)",
          minWidth: 16, height: 16, padding: "0 4px",
          borderRadius: 8, background: "var(--evr-red-400)",
          color: "var(--evr-neutral-100)", fontFamily: "var(--evr-font-text)",
          fontSize: 10, fontWeight: 700, lineHeight: "16px", textAlign: "center",
        }}>{badge}</span>
      )}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Text Field — 48h input, 8px radius, 1px neutral-60 border.
// Label: Clarika Grotesque 12px, letter-spacing 0.27.
// ───────────────────────────────────────────────────────────────────────
function Field({ label, required, optional, helper, error, children, style = {} }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && (
        <label style={{
          fontFamily: "var(--evr-font-text)", fontWeight: 400, fontSize: 12, lineHeight: 1.5,
          letterSpacing: "0.27px",
          color: "var(--evr-content-primary-default)",
          display: "flex", alignItems: "center", gap: 2,
        }}>
          <span>{label}</span>
          {required && <span style={{ color: "var(--evr-red-400)" }}>*</span>}
          {optional && <span style={{ color: "var(--evr-content-primary-lowemp)" }}> (optional)</span>}
        </label>
      )}
      {children}
      {(helper || error) && (
        <span style={{
          fontFamily: "var(--evr-font-text)", fontWeight: 400, fontSize: 12, lineHeight: 1.5,
          letterSpacing: "0.27px",
          color: error ? "var(--evr-red-400)" : "var(--evr-content-primary-lowemp)",
        }}>{error || helper}</span>
      )}
    </div>
  );
}

function Input({ value, defaultValue, onChange, placeholder, error = false, disabled = false, type = "text", leadingIcon, trailingIcon, style = {} }) {
  return (
    <div style={{
      position: "relative",
      display: "flex", alignItems: "center", gap: 8,
      height: 48,
      padding: leadingIcon ? "0 12px 0 44px" : trailingIcon ? "0 44px 0 12px" : "0 12px",
      background: disabled ? "var(--evr-neutral-97)" : "var(--evr-neutral-100)",
      border: `1px solid ${error ? "var(--evr-red-400)" : "var(--evr-neutral-60)"}`,
      borderRadius: 8,
      transition: "border-color 150ms",
      ...style,
    }}>
      {leadingIcon && (
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--evr-neutral-35)" }}>
          <Icon name={leadingIcon} size={24} />
        </span>
      )}
      <input
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1, minWidth: 0,
          fontFamily: "var(--evr-font-text)", fontWeight: 400, fontSize: 16, lineHeight: 1.5,
          color: "var(--evr-content-primary-default)",
          background: "transparent", border: 0, outline: 0, padding: 0,
        }}
      />
      {trailingIcon && (
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--evr-neutral-35)" }}>
          <Icon name={trailingIcon} size={24} />
        </span>
      )}
    </div>
  );
}

function Select({ value, onChange, children, disabled = false, error = false, style = {} }) {
  return (
    <div style={{
      position: "relative",
      height: 48,
      background: disabled ? "var(--evr-neutral-97)" : "var(--evr-neutral-100)",
      border: `1px solid ${error ? "var(--evr-red-400)" : "var(--evr-neutral-60)"}`,
      borderRadius: 8,
      ...style,
    }}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          width: "100%", height: "100%",
          padding: "0 44px 0 12px",
          fontFamily: "var(--evr-font-text)", fontWeight: 400, fontSize: 16, lineHeight: 1.5,
          color: "var(--evr-content-primary-default)",
          background: "transparent", border: 0, outline: 0,
          appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >{children}</select>
      <Icon name="ChevronDown" size={24} style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        color: "var(--evr-neutral-35)", pointerEvents: "none",
      }} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Tag — 24h, 8px radius, 1px border, subtle bg, no dot.
// Hues: default · success · warning · error · informative
// ───────────────────────────────────────────────────────────────────────
const TAG_HUES = {
  default:     { bg: "var(--evr-neutral-93)",   bd: "var(--evr-neutral-60)",  fg: "var(--evr-neutral-12)"   },
  success:     { bg: "var(--evr-green-50)",     bd: "var(--evr-green-200)",   fg: "var(--evr-green-700)"    },
  warning:     { bg: "var(--evr-yellow-50)",    bd: "var(--evr-yellow-300)",  fg: "var(--evr-yellow-700)"   },
  error:       { bg: "var(--evr-red-50)",       bd: "var(--evr-red-200)",     fg: "var(--evr-red-600)"      },
  informative: { bg: "var(--evr-blue-50)",      bd: "var(--evr-blue-200)",    fg: "var(--evr-blue-700)"     },
};
function Tag({ children, hue = "default", icon, onRemove, style = {} }) {
  const h = TAG_HUES[hue] || TAG_HUES.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 24, padding: onRemove ? "0 0 0 8px" : "0 8px",
      background: h.bg, border: `1px solid ${h.bd}`, borderRadius: 8,
      fontFamily: "var(--evr-font-text)", fontWeight: 400, fontSize: 14, lineHeight: 1.5,
      letterSpacing: "0.23px",
      color: h.fg, whiteSpace: "nowrap",
      ...style,
    }}>
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" style={{
          width: 24, height: 24, padding: 0, marginLeft: 0,
          background: "transparent", border: 0, borderRadius: 8,
          color: h.fg, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="XSmall" size={16} />
        </button>
      )}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Notification Banner — bordered card (not left-rule). 16px radius.
// Heading: Clarika Geometric Bold 18px. Body: Clarika Grotesque 16px.
// ───────────────────────────────────────────────────────────────────────
const BANNER_HUES = {
  informative: { bg: "var(--evr-blue-50)",   bd: "var(--evr-blue-200)",    fg: "var(--evr-blue-700)",    icon: "Information", icColor: "var(--evr-neutral-12)" },
  warning:     { bg: "var(--evr-yellow-50)", bd: "var(--evr-yellow-300)",  fg: "var(--evr-yellow-700)",  icon: "Alert",       icColor: "var(--evr-neutral-12)" },
  success:     { bg: "var(--evr-green-50)",  bd: "var(--evr-green-200)",   fg: "var(--evr-green-700)",   icon: "CheckSmall",  icColor: "var(--evr-neutral-12)" },
  error:       { bg: "var(--evr-red-50)",    bd: "var(--evr-red-200)",     fg: "var(--evr-red-600)",     icon: "Error",       icColor: "var(--evr-neutral-12)" },
};
function Banner({ kind = "informative", title, children, action, onDismiss }) {
  const h = BANNER_HUES[kind];
  return (
    <div style={{
      background: h.bg,
      border: `1px solid ${h.bd}`,
      borderRadius: 16,
      padding: "16px 16px",
      display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <span style={{ color: h.icColor, padding: "8px 0", flexShrink: 0 }}>
        <Icon name={h.icon} size={24} />
      </span>
      <div style={{ flex: 1, padding: "8px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {title && (
            <div style={{
              fontFamily: "var(--evr-font-display)", fontWeight: 700, fontSize: 18,
              lineHeight: 1.25, color: h.fg,
            }}>{title}</div>
          )}
          {children && (
            <div style={{
              fontFamily: "var(--evr-font-text)", fontWeight: 400, fontSize: 16, lineHeight: 1.5,
              color: h.fg,
            }}>{children}</div>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" style={{
          width: 32, height: 32, padding: 0,
          background: "transparent", border: 0, borderRadius: 24,
          color: h.fg, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name="X" size={20} />
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Card — calm (border) or floating (depth-04). 12px / 16px radius.
// ───────────────────────────────────────────────────────────────────────
// flavors: outlined (border) · elevated (shadow) · filled (neutral-97 bg)
function Card({ children, title, action, flavor = "outlined", style = {}, padding = 20 }) {
  const base =
    flavor === "elevated" ? { borderRadius: 16, boxShadow: "var(--evr-depth-04)", border: 0, background: "var(--evr-neutral-100)" }
  : flavor === "filled"   ? { borderRadius: 16, boxShadow: "none", border: 0, background: "var(--evr-neutral-97)" }
  :                          { borderRadius: 16, boxShadow: "none", border: "1px solid var(--evr-border-decorative-lowemp)", background: "var(--evr-neutral-100)" };
  return (
    <div style={{
      padding: typeof padding === "number" ? padding + "px" : padding,
      display: "flex", flexDirection: "column", gap: 16,
      ...base,
      ...style,
    }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {title && <h3 style={{
            fontFamily: "var(--evr-font-display)", fontWeight: 600, fontSize: 18, lineHeight: 1.25,
            color: "var(--evr-content-primary-highemp)", margin: 0,
          }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Avatar — circle. Sizes XS24, S32, M40, L48, XL64, 2XL80.
// ───────────────────────────────────────────────────────────────────────
const AVATAR_BG = {
  blue:   "var(--evr-blue-300)",
  purple: "var(--evr-purple-300)",
  green:  "var(--evr-green-300)",
  red:    "var(--evr-red-300)",
  teal:   "var(--evr-teal-300)",
  yellow: "var(--evr-yellow-300)",
  white:  "var(--evr-neutral-100)",
};
function Avatar({ initials, size = 32, hue = "blue", style = {} }) {
  const fontSize = size <= 24 ? 11 : size <= 32 ? 13 : size <= 40 ? 16 : size <= 48 ? 18 : size <= 64 ? 24 : 32;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 100,
      background: AVATAR_BG[hue] || AVATAR_BG.blue,
      color: hue === "white" ? "var(--evr-neutral-12)" : "var(--evr-neutral-12)",
      fontFamily: "var(--evr-font-text)", fontWeight: 700, fontSize, lineHeight: 1,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, userSelect: "none",
      border: hue === "white" ? "1px solid var(--evr-border-decorative-default)" : "0",
      ...style,
    }}>{initials}</div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Tabs — 48h, 8px top-radius. 4px bottom indicator on active tab.
// Active: bold #1F1F23. Inactive: regular #46464A. Border-bottom row.
// ───────────────────────────────────────────────────────────────────────
function Tabs({ items, value, onChange }) {
  return (
    <div style={{
      display: "flex", flexDirection: "row",
      borderBottom: "1px solid var(--evr-border-decorative-default)",
      gap: 16,
    }}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            onClick={() => onChange && onChange(it.value)}
            style={{
              position: "relative",
              height: 48,
              padding: "0 8px",
              minWidth: 64,
              background: "transparent",
              border: 0, cursor: "pointer",
              fontFamily: "var(--evr-font-text)",
              fontWeight: active ? 700 : 400,
              fontSize: 16, lineHeight: 1.5,
              color: active ? "var(--evr-neutral-12)" : "var(--evr-content-primary-default)",
              borderRadius: "8px 8px 0 0",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {it.icon && <Icon name={it.icon} size={20} />}
            <span>{it.label}</span>
            {it.count != null && (
              <Tag hue="default" style={{ height: 20, padding: "0 6px", fontSize: 12 }}>{it.count}</Tag>
            )}
            {active && (
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                height: 4, borderRadius: "4px 4px 0 0",
                background: "var(--evr-neutral-20)",
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Divider — 1px decorative-lowemp.
// ───────────────────────────────────────────────────────────────────────
function Divider({ vertical = false, style = {} }) {
  return (
    <div style={{
      background: "var(--evr-border-decorative-lowemp)",
      ...(vertical ? { width: 1, alignSelf: "stretch" } : { height: 1, width: "100%" }),
      ...style,
    }} />
  );
}

Object.assign(window, {
  Button, IconButton, Field, Input, Select, Tag, Banner, Card, Avatar, Tabs, Divider,
  // back-compat names from the earlier kit
  Pill: Tag,
});
