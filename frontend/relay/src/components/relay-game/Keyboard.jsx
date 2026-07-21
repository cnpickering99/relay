import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

const ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","BACK"],
];

function Key({ label, onPress, wide }) {
  const isSpecial = label === "ENTER" || label === "BACK";
  return (
    <button
      onClick={() => onPress(label)}
      style={{
        flex: wide ? 1.6 : 1,
        minWidth: 0,
        height: 46,
        margin: "3px",
        borderRadius: 8,
        border: "none",
        background: isSpecial ? C.purpleDeep : "rgba(255,255,255,0.12)",
        color: C.white,
        fontFamily: font,
        fontWeight: 700,
        fontSize: isSpecial ? 11 : 14,
        letterSpacing: isSpecial ? "0.05em" : 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        transition: "background 0.1s, transform 0.05s",
      }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.94)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {label === "BACK" ? "⌫" : label}
    </button>
  );
}

export default function Keyboard({ onKeyPress }) {
  return (
    <div style={{ width: "100%", userSelect: "none" }}>
      {ROWS.map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "center" }}>
          {row.map(label => (
            <Key
              key={label}
              label={label}
              wide={label === "ENTER" || label === "BACK"}
              onPress={onKeyPress}
            />
          ))}
        </div>
      ))}
    </div>
  );
}