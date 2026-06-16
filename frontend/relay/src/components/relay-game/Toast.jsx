import * as C from "./ComponentStyles.jsx";


const font = "'Poppins', 'Nunito', sans-serif";



function Toast({ message, type }) {
  const visible = !!message;
  return (
    <div style={{
      position: "absolute",
      top: 28,
      left: "50%",
      transform: `translateX(-50%) translateY(${visible ? "0px" : "-80px"})`,
      background: C.darkInput,
      color: type === "error" ? "#ff6b6b" : C.gold,
      padding: "10px 20px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 700,
      whiteSpace: "nowrap",
      transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      pointerEvents: "none",
      zIndex: 10,
      fontFamily: font,
    }}>
      {message || " "}
    </div>
  );
}

export default Toast;