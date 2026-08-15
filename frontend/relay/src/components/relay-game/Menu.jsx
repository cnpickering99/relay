// Menu.jsx
import { useState } from "react";
import * as C from "./ComponentStyles.jsx";
import Leaderboard from "./Leaderboard.jsx";

const font = "'Poppins', 'Nunito', sans-serif";

const FLOATING_LETTERS = ["R", "E", "L", "A", "Y", "O", "N", "G", "C", "H"];

function GlowOrbs() {
  return (
    <>
      <div style={{
        position: "absolute", width: 220, height: 220, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,197,24,0.35) 0%, rgba(245,197,24,0) 70%)",
        top: -60, left: -60, filter: "blur(10px)",
        animation: "orbDrift1 9s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(170,59,255,0.28) 0%, rgba(170,59,255,0) 70%)",
        bottom: -80, right: -70, filter: "blur(10px)",
        animation: "orbDrift2 11s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,197,24,0.18) 0%, rgba(245,197,24,0) 70%)",
        top: "38%", right: -50, filter: "blur(8px)",
        animation: "orbDrift1 7.5s ease-in-out infinite 1s",
      }} />
    </>
  );
}

function FloatingLetters() {
  const configs = [
    { left: "8%",  top: "10%", size: 26, delay: 0,    duration: 7,   opacity: 0.14 },
    { left: "82%", top: "6%",  size: 20, delay: 0.8,  duration: 6.5, opacity: 0.12 },
    { left: "14%", top: "68%", size: 32, delay: 1.6,  duration: 8,   opacity: 0.13 },
    { left: "78%", top: "58%", size: 18, delay: 0.4,  duration: 7.5, opacity: 0.15 },
    { left: "48%", top: "4%",  size: 16, delay: 2.2,  duration: 6,   opacity: 0.10 },
    { left: "88%", top: "34%", size: 24, delay: 1.1,  duration: 7.2, opacity: 0.12 },
    { left: "4%",  top: "40%", size: 18, delay: 1.9,  duration: 6.8, opacity: 0.11 },
    { left: "38%", top: "80%", size: 22, delay: 0.6,  duration: 7.8, opacity: 0.13 },
    { left: "62%", top: "78%", size: 16, delay: 1.3,  duration: 6.4, opacity: 0.10 },
    { left: "20%", top: "24%", size: 14, delay: 2.6,  duration: 7.1, opacity: 0.09 },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <GlowOrbs />
      {configs.map((cfg, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cfg.left,
            top: cfg.top,
            fontSize: cfg.size,
            fontWeight: 900,
            color: `rgba(245,197,24,${cfg.opacity})`,
            fontFamily: font,
            animation: `floatLetter ${cfg.duration}s ease-in-out ${cfg.delay}s infinite`,
          }}
        >
          {FLOATING_LETTERS[i]}
        </div>
      ))}
    </div>
  );
}

function HowToPlay({ onBack }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(160deg, #1a1a2e 0%, #221f3a 100%)",
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
              boxShadow: "0 0 16px rgba(245,197,24,0.35)",
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  if (showHowTo) {
    return <HowToPlay onBack={() => setShowHowTo(false)} />;
  }

  if (showLeaderboard) {
    return <Leaderboard onBack={() => setShowLeaderboard(false)} />;
  }

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(160deg, #1a1a2e 0%, #241f42 55%, #1a1a2e 100%)",
      borderRadius: 44,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
      padding: "40px 32px",
      fontFamily: font,
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes floatLetter {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(6deg); }
        }
        @keyframes orbDrift1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(14px,-10px) scale(1.08); }
        }
        @keyframes orbDrift2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-12px,12px) scale(1.06); }
        }
        @keyframes glowPulse {
          0%, 100% { text-shadow: 0 0 40px rgba(245,197,24,0.35), 0 0 80px rgba(170,59,255,0.12); }
          50% { text-shadow: 0 0 65px rgba(245,197,24,0.6), 0 0 100px rgba(170,59,255,0.2); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes barPulse {
          0%, 100% { opacity: 1; transform: scaleX(1); }
          50% { opacity: 0.6; transform: scaleX(0.85); }
        }
        @keyframes shineSweep {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(245,197,24,0); }
          50% { box-shadow: 0 0 18px rgba(245,197,24,0.25); }
        }
        .menu-fade-1 { animation: fadeSlideUp 0.6s ease both; }
        .menu-fade-2 { animation: fadeSlideUp 0.6s ease 0.1s both; }
        .menu-fade-3 { animation: fadeSlideUp 0.6s ease 0.2s both; }
        .menu-fade-4 { animation: fadeSlideUp 0.6s ease 0.3s both; }
        .menu-btn-play {
          position: relative;
          overflow: hidden;
          transition: transform 0.12s, box-shadow 0.15s;
        }
        .menu-btn-play:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(245,197,24,0.5) !important;
        }
        .menu-btn-play::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: shineSweep 3.2s ease-in-out infinite;
        }
        .menu-btn-secondary {
          transition: background 0.15s, transform 0.12s, border-color 0.15s;
        }
        .menu-btn-secondary:hover {
          transform: translateY(-1px);
          border-color: rgba(245,197,24,0.4) !important;
        }
        .menu-badge {
          animation: badgeGlow 2.6s ease-in-out infinite;
        }
      `}</style>

      <FloatingLetters />

      {/* Logo area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
        {/* Gold accent bar */}
        <div className="menu-fade-1" style={{
          width: 48,
          height: 5,
          background: C.gold,
          borderRadius: 999,
          marginBottom: 24,
          animation: "fadeSlideUp 0.6s ease both, barPulse 2.4s ease-in-out 0.6s infinite",
        }} />

        <div
          className="menu-fade-2 menu-badge"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.3em",
            color: C.gold,
            textTransform: "uppercase",
            marginBottom: 14,
            padding: "6px 16px",
            border: "1px solid rgba(245,197,24,0.35)",
            borderRadius: 999,
            background: "rgba(245,197,24,0.08)",
          }}
        >
          WORD CHAIN GAME
        </div>

        <div className="menu-fade-3" style={{
          fontSize: 76,
          fontWeight: 900,
          color: C.white,
          letterSpacing: -4,
          lineHeight: 1,
          marginBottom: 6,
          fontFamily: font,
          animation: "fadeSlideUp 0.6s ease 0.2s both, glowPulse 3s ease-in-out 0.8s infinite",
        }}>
          RELAY
        </div>

        {/* Gold underline accent */}
        <div className="menu-fade-4" style={{
          width: 80,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
          borderRadius: 999,
          marginBottom: 14,
        }} />

        <div className="menu-fade-4" style={{
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", paddingBottom: 8, zIndex: 1 }}>
        {/* Play */}
        <button
          className="menu-btn-play menu-fade-4"
          onClick={onPlay}
          style={{
            width: "100%",
            background: `linear-gradient(135deg, ${C.gold}, #ffdd55)`,
            border: "none",
            borderRadius: 14,
            padding: 20,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "#1a1a2e",
            cursor: "pointer",
            textTransform: "uppercase",
            fontFamily: font,
            boxShadow: `0 4px 28px rgba(245, 197, 24, 0.45)`,
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
          onMouseUp={e => e.currentTarget.style.transform = "translateY(-2px)"}
        >
          ▶  PLAY
        </button>

        {/* How to Play */}
        <button
          className="menu-btn-secondary menu-fade-4"
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
          onMouseUp={e => e.currentTarget.style.transform = "translateY(-1px)"}
        >
          <span style={{ fontSize: 15 }}></span> HOW TO PLAY
        </button>

        {/* Leaderboard */}
        <button
          className="menu-fade-4"
          onClick={() => setShowLeaderboard(true)}
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
          🏆 LEADERBOARD
        </button>
      </div>
    </div>
  );
}