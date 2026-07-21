import { memo, useCallback, useRef } from "react";
import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

const SPECIAL = new Set(["ENTER", "BACK"]);
const ARIA_LABEL = { ENTER: "Enter", BACK: "Backspace" };

// Shared by reference across every key of the same kind, so a re-render
// never allocates 26 new style objects.
const KEY_STYLE = {
  flex: 1,
  minWidth: 0,
  height: 46,
  margin: 3,
  borderRadius: 8,
  border: "none",
  background: "rgba(255,255,255,0.12)",
  color: C.white,
  fontFamily: font,
  fontWeight: 700,
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const KEY_STYLE_SPECIAL = {
  ...KEY_STYLE,
  flex: 1.6,
  background: C.purpleDeep,
  fontSize: 11,
  letterSpacing: "0.05em",
};

// Press feedback lives in CSS (`.is-pressed`, toggled imperatively) instead
// of per-key mousedown/mouseup React state. Mouse events don't reliably
// fire for touch input inside an iOS WebView/PWA, so the old approach could
// silently never animate on-device; pointer events cover touch and mouse
// uniformly and never trigger a re-render.
const KEYBOARD_CSS = `
  .rg-key {
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    transition: transform 0.08s ease-out, background 0.1s ease-out;
  }
  .rg-key.is-pressed {
    transform: scale(0.94);
  }
`;

const Key = memo(function Key({ label }) {
  const isSpecial = SPECIAL.has(label);
  return (
    <button
      type="button"
      className="rg-key"
      data-key={label}
      aria-label={ARIA_LABEL[label] ?? label}
      style={isSpecial ? KEY_STYLE_SPECIAL : KEY_STYLE}
    >
      {label === "BACK" ? "⌫" : label}
    </button>
  );
});

export default function Keyboard({ onKeyPress }) {
  const pressedRef = useRef(null);

  const clearPressed = useCallback(() => {
    pressedRef.current?.classList.remove("is-pressed");
    pressedRef.current = null;
  }, []);

  const handlePointerDown = useCallback((e) => {
    const btn = e.target.closest("button[data-key]");
    if (!btn) return;
    btn.classList.add("is-pressed");
    pressedRef.current = btn;
  }, []);

  const handleClick = useCallback((e) => {
    const btn = e.target.closest("button[data-key]");
    if (btn) onKeyPress(btn.dataset.key);
  }, [onKeyPress]);

  return (
    <div
      role="group"
      aria-label="On-screen keyboard"
      style={{ width: "100%", userSelect: "none" }}
      onPointerDown={handlePointerDown}
      onPointerUp={clearPressed}
      onPointerCancel={clearPressed}
      onPointerLeave={clearPressed}
      onClick={handleClick}
    >
      <style>{KEYBOARD_CSS}</style>
      {ROWS.map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "center" }}>
          {row.map(label => <Key key={label} label={label} />)}
        </div>
      ))}
    </div>
  );
}
