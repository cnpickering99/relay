import * as C from "./ComponentStyles.jsx";
import { font } from "../../Util/Utils.jsx";

function ChainPill({ word, highlightLen, isCurrent, fragment }) {
  const base = {
    borderRadius: 999,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    border: `2px solid rgba(255,255,255,${isCurrent ? "0.3" : "0.2"})`,
    background: isCurrent ? C.purpleDeep : C.purplePill,
    color: isCurrent ? "rgba(255,255,255,0.5)" : C.pillText,
    fontFamily: font,
    flexShrink: 0,
  };

  if (isCurrent) {
    return (
      <div style={base}>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{fragment}•••</span>
      </div>
    );
  }

  return (
    <div style={base}>
      {highlightLen > 0 && (
        <span style={{ color: C.gold }}>{word.slice(0, highlightLen)}</span>
      )}
      {word.slice(highlightLen)}
    </div>
  );
}

export default ChainPill;
