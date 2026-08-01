// LoadingScreen.jsx
import { useEffect, useState } from "react";
import * as C from "./ComponentStyles.jsx";

const font = "'Poppins', 'Nunito', sans-serif";
const LETTERS = ["R", "E", "L", "A", "Y"];

export default function LoadingScreen({ onDone }) {
  const [phase, setPhase] = useState("entering");

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("leaving"), 2000);
    const doneTimer = setTimeout(() => onDone(), 2700);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#1a1a2e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      opacity: phase === "leaving" ? 0 : 1,
      transition: "opacity 0.7s ease",
    }}>
      <style>{`
        @keyframes letterDrop {
          0%   { opacity: 0; transform: translateY(-40px) scale(0.7); }
          60%  { transform: translateY(6px) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes underlineExpand {
          0%   { width: 0; opacity: 0; }
          100% { width: 180px; opacity: 1; }
        }
        @keyframes subtitleFade {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Letters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {LETTERS.map((letter, i) => (
          <div key={letter} style={{
            fontSize: 80,
            fontWeight: 900,
            color: i === 0 ? C.gold : C.white,
            fontFamily: font,
            letterSpacing: -3,
            lineHeight: 1,
            opacity: 0,
            animation: `letterDrop 0.55s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.14}s forwards`,
          }}>
            {letter}
          </div>
        ))}
      </div>

      {/* Gold underline */}
      <div style={{
        height: 3,
        background: C.gold,
        borderRadius: 999,
        width: 0,
        opacity: 0,
        animation: `underlineExpand 0.4s ease ${LETTERS.length * 0.14 + 0.15}s forwards`,
      }} />

      {/* Subtitle */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.3em",
        color: C.muted,
        textTransform: "uppercase",
        fontFamily: font,
        marginTop: 18,
        opacity: 0,
        animation: `subtitleFade 0.5s ease ${LETTERS.length * 0.14 + 0.35}s forwards`,
      }}>
        CHAIN YOUR WORDS
      </div>
    </div>
  );
}