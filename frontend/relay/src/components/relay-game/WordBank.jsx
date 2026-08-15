import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

function WordBank({ wordsUsed }) {
  if (wordsUsed.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        letterSpacing: "0.18em",
        color: C.muted,
        marginBottom: 10,
        textTransform: "uppercase",
        fontFamily: font,
      }}>
        WORDS USED
      </div>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}>
        {wordsUsed.map((word, i) => (
          <div key={word + i} style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: C.pillText,
            fontFamily: font,
            animation: "pillPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}>
            {word}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WordBank;