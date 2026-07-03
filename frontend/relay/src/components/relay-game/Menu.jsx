// Menu.jsx
import { useState } from "react";
import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

function HowToPlay({ onBack }) {
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
      zIndex: 200,
      padding: "40px 32px",
      fontFamily: font,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.25em",
        color: C.gold,
        textTransform: "uppercase",
        marginBottom: 8,
      }}>
        HOW TO PLAY
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 900,
        color: C.white,
        marginBottom: 36,
        fontFamily: font,
        letterSpacing: -0.5,
      }}>
        RELAY
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", marginBottom: 40 }}>
        {[
          { num: "1", text: "You are given a starting fragment (e.g. RO)." },
          { num: "2", text: "Type a real word that starts with that fragment." },
          { num: "3", text: "The last 2 letters of your word become the next fragment." },
          { num: "4", text: "Keep the chain going! Longer words = more points." },
          { num: "5", text: "The game ends if you use an unchainable word." },
        ].map(({ num, text }) => (
          <div key={num} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{
              minWidth: 32, height: 32,
              background: C.gold,
              borderRadius: 999,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: "#1a1a2e",
            }}>
              {num}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
              paddingTop: 6,
            }}>
              {text}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onBack}
        style={{
          width: "100%",
          background: C.gold,
          border: "none",
          borderRadius: 14,
          padding: 18,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.18em",
          color: "#1a1a2e",
          cursor: "pointer",
          textTransform: "uppercase",
          fontFamily: font,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => e.target.style.opacity = "0.85"}
        onMouseLeave={e => e.target.style.opacity = "1"}
        onMouseDown={e => e.target.style.transform = "scale(0.98)"}
        onMouseUp={e => e.target.style.transform = "scale(1)"}
      >
        BACK
      </button>
    </div>
  );
}

export default function Menu({ onPlay }) {
  const [showHowTo, setShowHowTo] = useState(false);

  if (showHowTo) {
    return <HowToPlay onBack={() => setShowHowTo(false)} />;
  }

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
      zIndex: 200,
      padding: "40px 32px",
      fontFamily: font,
    }}>
      {/* Logo area */}
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
          WORD CHAIN GAME
        </div>

        <div style={{
          fontSize: 76,
          fontWeight: 900,
          color: C.white,
          letterSpacing: -4,
          lineHeight: 1,
          marginBottom: 6,
          fontFamily: font,
          textShadow: `0 0 40px rgba(245, 197, 24, 0.3)`,
        }}>
          RELAY
        </div>

        {/* Gold underline accent */}
        <div style={{
          width: 80,
          height: 3,
          background: C.gold,
          borderRadius: 999,
          marginBottom: 14,
        }} />

        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.muted,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}>
          CHAIN YOUR WORDS
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", paddingBottom: 8 }}>
        {/* Play */}
        <button
          onClick={onPlay}
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
          PLAY
        </button>

        {/* How to Play */}
        <button
          onClick={() => setShowHowTo(true)}
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
          HOW TO PLAY
        </button>

        {/* Leaderboard */}
        <button
          onClick={() => alert("Leaderboard coming soon!")}
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
          LEADERBOARD
        </button>
      </div>
    </div>
  );
}