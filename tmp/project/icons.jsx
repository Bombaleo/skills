// Icon — single-color, currentColor-tinted.
//
// Renders the SVG markup INLINE (not via CSS mask-image). The Everest
// icon SVGs already paint with `fill="currentColor"`, so inlining lets
// color flow through `currentColor` from the parent exactly like the
// old mask approach — but without depending on `mask-image`, which the
// preview/serve layer drops (the element would otherwise collapse to a
// solid currentColor box). Loaded from assets/icons/{name}.svg, fetched
// once per name and cached at module scope.

// name -> svg markup string (resolved). Shared across every <Icon>.
const __ICON_CACHE = {};
// name -> Promise (in-flight) so concurrent mounts share one fetch.
const __ICON_PENDING = {};

// One-time stylesheet so the inlined <svg> fills its wrapper span and
// never imposes its own intrinsic 300x150 default.
(function ensureIconStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("__evr-icon-style")) return;
  const s = document.createElement("style");
  s.id = "__evr-icon-style";
  s.textContent =
    ".evr-icon{line-height:0;}" +
    ".evr-icon > svg{width:100%;height:100%;display:block;}";
  document.head.appendChild(s);
})();

function loadIcon(name) {
  if (__ICON_CACHE[name] != null) return Promise.resolve(__ICON_CACHE[name]);
  if (__ICON_PENDING[name]) return __ICON_PENDING[name];
  const p = fetch(`assets/icons/${name}.svg`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((txt) => {
      __ICON_CACHE[name] = txt;
      delete __ICON_PENDING[name];
      return txt;
    })
    .catch((e) => {
      delete __ICON_PENDING[name];
      __ICON_CACHE[name] = ""; // remember the miss; avoid refetch storms
      return "";
    });
  __ICON_PENDING[name] = p;
  return p;
}

function Icon({ name, size = 20, title, tint, style = {}, className, ...rest }) {
  // `tint` is accepted for backwards-compat with the Everest kit but is no-op
  // here — color flows through `currentColor` from the parent.
  const [markup, setMarkup] = React.useState(() => __ICON_CACHE[name] || null);

  React.useEffect(() => {
    let alive = true;
    if (__ICON_CACHE[name] != null) {
      setMarkup(__ICON_CACHE[name]);
      return () => { alive = false; };
    }
    loadIcon(name).then((txt) => { if (alive) setMarkup(txt); });
    return () => { alive = false; };
  }, [name]);

  const cls = className ? `evr-icon ${className}` : "evr-icon";
  const props = {
    role: title ? "img" : "presentation",
    "aria-label": title,
    className: cls,
    style: {
      width: size,
      height: size,
      display: "inline-block",
      color: "currentColor",
      flexShrink: 0,
      ...style,
    },
    ...rest,
  };
  if (markup) props.dangerouslySetInnerHTML = { __html: markup };
  return React.createElement("span", props);
}

Object.assign(window, { Icon });
