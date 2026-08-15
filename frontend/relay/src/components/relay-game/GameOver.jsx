// GameOver.jsx
import { useEffect, useState } from "react";
import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

export default function GameOver({ score, reason, onPlayAgain, onMainMenu }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

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
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: 44,
    }}>
      {/* Dark backdrop */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        borderRadius: 44,
      }} />

      {/* Sheet slides up from bottom */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#1a1a2e",
        borderRadius: "28px 28px 0 0",
        padding: "24px 28px 36px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.55s cubic-bezier(0.34,1.2,0.64,1)",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Drag handle */}
        <div style={{
          width: 40, height: 4,
          background: "rgba(255,255,255,0.2)",
          borderRadius: 999,
          marginBottom: 20,
        }} />

        {/* Gold bar */}
        <div style={{ width: 40, height: 5, background: C.gold, borderRadius: 999, marginBottom: 14 }} />

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
          CHAIN BROKEN
        </div>

        <div style={{ fontSize: 40, fontWeight: 900, color: C.white, marginBottom: 6, letterSpacing: -2, lineHeight: 1 }}>
          GAME OVER
        </div>

        <div style={{ width: 70, height: 3, background: C.gold, borderRadius: 999, marginBottom: 18 }} />

        {/* Reason card */}
        {reason && (
          <div style={{
            background: "rgba(255,99,99,0.08)",
            border: "1px solid rgba(255,99,99,0.25)",
            borderRadius: 14,
            padding: "12px 20px",
            textAlign: "center",
            width: "100%",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,99,99,0.8)", textTransform: "uppercase", marginBottom: 4 }}>
              CHAIN BREAKER
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.white, letterSpacing: -1, marginBottom: 4 }}>
              {reason.word}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
              No words start with{" "}
              <span style={{ color: C.gold, fontWeight: 800 }}>"{reason.lastTwo}"</span>
            </div>
          </div>
        )}

        {/* Score card */}
        <div style={{
          background: "rgba(255,255,255,0.06)",
          border: "2px solid rgba(245,197,24,0.25)",
          borderRadius: 18,
          padding: "16px 48px",
          textAlign: "center",
          width: "100%",
          marginBottom: 20,
          boxShadow: "0 0 40px rgba(245,197,24,0.08)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", color: C.gold, marginBottom: 6, textTransform: "uppercase" }}>
            FINAL SCORE
          </div>
          <div style={{ fontSize: 68, fontWeight: 900, color: C.gold, lineHeight: 1, letterSpacing: -3, textShadow: "0 0 40px rgba(245,197,24,0.4)" }}>
            {score}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>

          {/* Play Again — skips menu */}
          <button
            onClick={onPlayAgain}
            style={{
              width: "100%", background: C.gold, border: "none",
              borderRadius: 14, padding: 18, fontSize: 14, fontWeight: 800,
              letterSpacing: "0.2em", color: "#1a1a2e", cursor: "pointer",
              textTransform: "uppercase", fontFamily: font,
              boxShadow: "0 4px 24px rgba(245,197,24,0.35)",
            }}
            onMouseEnter={e => e.target.style.opacity = "0.9"}
            onMouseLeave={e => e.target.style.opacity = "1"}
            onMouseDown={e => e.target.style.transform = "scale(0.98)"}
            onMouseUp={e => e.target.style.transform = "scale(1)"}
          >
            PLAY AGAIN
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            style={{
              width: "100%", background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.15)", borderRadius: 14,
              padding: 14, fontSize: 13, fontWeight: 800, letterSpacing: "0.18em",
              color: C.white, cursor: "pointer", textTransform: "uppercase", fontFamily: font,
            }}
            onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.15)"}
            onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.08)"}
            onMouseDown={e => e.target.style.transform = "scale(0.98)"}
            onMouseUp={e => e.target.style.transform = "scale(1)"}
          >
            SHARE SCORE
          </button>

          {/* Main Menu — goes back to menu */}
          <button
            onClick={onMainMenu}
            style={{
              width: "100%", background: "transparent", border: "none",
              borderRadius: 14, padding: 12, fontSize: 12, fontWeight: 700,
              letterSpacing: "0.18em", color: C.muted, cursor: "pointer",
              textTransform: "uppercase", fontFamily: font,
            }}
            onMouseEnter={e => e.target.style.color = C.gold}
            onMouseLeave={e => e.target.style.color = C.muted}
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}