// GameOver.jsx
import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

export default function GameOver({ score, onPlayAgain, onMainMenu }) {
  const handleShare = () => {
    const text = `I scored ${score} points on Relay! Can you beat me? 🔗`;
    if (navigator.share) {
      navigator.share({ title: "Relay", text });
    } else {
      navigator.clipboard.writeText(text);
      alert("Score copied to clipboard!");
    }
  };

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "#1a1a2e",
      borderRadius: 44,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      padding: "40px 32px",
      fontFamily: font,
    }}>

      {/* Top label */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Gold accent bar */}
        <div style={{
          width: 48,
          height: 5,
          background: C.gold,
          borderRadius: 999,
          marginBottom: 24,
        }} />

        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: C.muted,
          textTransform: "uppercase",
          marginBottom: 10,
        }}>
          CHAIN BROKEN
        </div>

        <div style={{
          fontSize: 48,
          fontWeight: 900,
          color: C.white,
          marginBottom: 6,
          fontFamily: font,
          letterSpacing: -2,
          lineHeight: 1,
        }}>
          GAME OVER
        </div>

        {/* Gold underline accent */}
        <div style={{
          width: 80,
          height: 3,
          background: C.gold,
          borderRadius: 999,
          marginBottom: 40,
        }} />

        {/* Score card */}
        <div style={{
          background: "rgba(255,255,255,0.06)",
          border: `2px solid rgba(245, 197, 24, 0.25)`,
          borderRadius: 24,
          padding: "32px 64px",
          textAlign: "center",
          width: "100%",
          boxShadow: `0 0 40px rgba(245, 197, 24, 0.08)`,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: C.gold,
            marginBottom: 10,
            textTransform: "uppercase",
          }}>
            FINAL SCORE
          </div>
          <div style={{
            fontSize: 88,
            fontWeight: 900,
            color: C.gold,
            lineHeight: 1,
            letterSpacing: -4,
            fontFamily: font,
            textShadow: `0 0 40px rgba(245, 197, 24, 0.4)`,
          }}>
            {score}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", paddingBottom: 8 }}>
        {/* Play Again */}
        <button
          onClick={onPlayAgain}
          style={{
            width: "100%",
            background: C.gold,
            border: "none",
            borderRadius: 14,
            padding: 20,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "#1a1a2e",
            cursor: "pointer",
            textTransform: "uppercase",
            fontFamily: font,
            transition: "opacity 0.15s, transform 0.1s",
            boxShadow: `0 4px 24px rgba(245, 197, 24, 0.35)`,
          }}
          onMouseEnter={e => e.target.style.opacity = "0.9"}
          onMouseLeave={e => e.target.style.opacity = "1"}
          onMouseDown={e => e.target.style.transform = "scale(0.98)"}
          onMouseUp={e => e.target.style.transform = "scale(1)"}
        >
          PLAY AGAIN
        </button>

        {/* Share Score */}
        <button
          onClick={handleShare}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.08)",
            border: "2px solid rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: 18,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: C.white,
            cursor: "pointer",
            textTransform: "uppercase",
            fontFamily: font,
            transition: "background 0.15s, transform 0.1s",
          }}
          onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.15)"}
          onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.08)"}
          onMouseDown={e => e.target.style.transform = "scale(0.98)"}
          onMouseUp={e => e.target.style.transform = "scale(1)"}
        >
          SHARE SCORE
        </button>

        {/* Main Menu */}
        <button
          onClick={onMainMenu}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderRadius: 14,
            padding: 16,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: C.muted,
            cursor: "pointer",
            textTransform: "uppercase",
            fontFamily: font,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.target.style.color = C.gold}
          onMouseLeave={e => e.target.style.color = C.muted}
        >
          MAIN MENU
        </button>
      </div>
    </div>
  );
}