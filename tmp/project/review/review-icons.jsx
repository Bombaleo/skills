// Minimal SVG icon set for the review page (Everest-style line icons,
// 24x24 viewbox, 1.5 stroke, square caps).
const RvIcon = ({ name, size = 18, style }) => {
  const paths = {
    X: <path d="M6 6 L18 18 M18 6 L6 18" />,
    ChevronDown: <path d="M5 9 L12 16 L19 9" />,
    ChevronRight: <path d="M9 5 L16 12 L9 19" />,
    Plus: <path d="M12 5 V19 M5 12 H19" />,
    Calendar: <g><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7" /></g>,
    Clock: <g><circle cx="12" cy="12" r="8" /><path d="M12 7 V12 L15 14" /></g>,
    Sparkles: <g><path d="M12 4 L13.5 9 L18 10 L13.5 11 L12 16 L10.5 11 L6 10 L10.5 9 Z" /><path d="M18 5 L18.5 6.5 L20 7 L18.5 7.5 L18 9 L17.5 7.5 L16 7 L17.5 6.5 Z" /></g>,
    Repeat: <g><path d="M4 9 V8 a3 3 0 0 1 3 -3 H17 L15 3 M15 7 L17 5" /><path d="M20 15 V16 a3 3 0 0 1 -3 3 H7 L9 21 M9 17 L7 19" /></g>,
    Copy: <g><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15 H4 a0 0 0 0 1 0 -0 V5 a1.5 1.5 0 0 1 1.5 -1.5 H15 a0 0 0 0 1 0 0 V4" /></g>,
    Trash: <g><path d="M5 7 H19" /><path d="M9 7 V4.5 A1 1 0 0 1 10 3.5 H14 A1 1 0 0 1 15 4.5 V7" /><path d="M7 7 L8 20 A1 1 0 0 0 9 21 H15 A1 1 0 0 0 16 20 L17 7" /><path d="M10 11 V17 M14 11 V17" /></g>,
    Pencil: <path d="M4 20 L4 16 L16 4 L20 8 L8 20 Z M14 6 L18 10" />,
    Check: <path d="M5 13 L10 18 L20 6" />,
    Alert: <g><path d="M12 3 L22 20 H2 Z" /><path d="M12 10 V14 M12 17.5 V18" /></g>,
    Info: <g><circle cx="12" cy="12" r="9" /><path d="M12 11 V17 M12 7.5 V8" /></g>,
    Block: <g><circle cx="12" cy="12" r="9" /><path d="M6 6 L18 18" /></g>,
    People: <g><circle cx="9" cy="9" r="3.5" /><path d="M3.5 19 a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="10" r="2.5" /><path d="M14 19 a4 4 0 0 1 7 0" /></g>,
    Lightbulb: <g><path d="M9 18 H15 M10 21 H14" /><path d="M7 11 A5 5 0 0 1 17 11 C17 14 14.5 15 14 17 H10 C9.5 15 7 14 7 11 Z" /></g>,
    ArrowRight: <path d="M5 12 H19 M13 6 L19 12 L13 18" />,
    Calendar2: <g><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7" /><rect x="6.5" y="13" width="2.5" height="2.5" /></g>,
    Settings: <g><circle cx="12" cy="12" r="3" /><path d="M19.4 15 a1.7 1.7 0 0 0 .3 1.8 l.06 .06 a2 2 0 0 1 -2.8 2.8 l-.06 -.06 a1.7 1.7 0 0 0 -1.8 -.3 1.7 1.7 0 0 0 -1 1.5 V21 a2 2 0 1 1 -4 0 V21 a1.7 1.7 0 0 0 -1 -1.5 1.7 1.7 0 0 0 -1.8 .3 l-.06 .06 a2 2 0 0 1 -2.8 -2.8 l.06 -.06 a1.7 1.7 0 0 0 .3 -1.8 1.7 1.7 0 0 0 -1.5 -1 H3 a2 2 0 1 1 0 -4 H3 a1.7 1.7 0 0 0 1.5 -1 1.7 1.7 0 0 0 -.3 -1.8 l-.06 -.06 a2 2 0 0 1 2.8 -2.8 l.06 .06 a1.7 1.7 0 0 0 1.8 .3 H9 a1.7 1.7 0 0 0 1 -1.5 V3 a2 2 0 1 1 4 0 V3 a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8 -.3 l.06 -.06 a2 2 0 0 1 2.8 2.8 l-.06 .06 a1.7 1.7 0 0 0 -.3 1.8 V9 a1.7 1.7 0 0 0 1.5 1 H21 a2 2 0 1 1 0 4 H21 a1.7 1.7 0 0 0 -1.5 1 z" /></g>,
    Eye: <g><path d="M2 12 S5.5 5 12 5 22 12 22 12 18.5 19 12 19 2 12 2 12 Z" /><circle cx="12" cy="12" r="3" /></g>,
    Flag: <g><path d="M5 21 V4 M5 5 H17 L15 9 L17 13 H5" /></g>,
    Save: <g><path d="M5 5 a2 2 0 0 1 2 -2 H17 L21 7 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V5 Z" /><path d="M7 13 H17 V21 M17 3 V8 H9 V3" /></g>,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  );
};

window.RvIcon = RvIcon;
