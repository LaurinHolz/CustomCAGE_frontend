// ─── Modern animated toggle switch (iOS-style) ─────────────────────
export default function ToggleSwitch({ checked, onToggle, label }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", outline: "none" }}
    >
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 500, letterSpacing: "0.2px",
          color: checked ? "var(--color-text-primary)" : "var(--color-text-secondary)",
          transition: "color .2s ease",
        }}>
          {label}
        </span>
      )}
      <span style={{
        position: "relative", width: 38, height: 22, borderRadius: 999, flexShrink: 0,
        background: checked ? "#1D9E75" : "var(--color-border-secondary)",
        boxShadow: checked ? "0 0 0 4px rgba(29,158,117,0.15)" : "0 0 0 4px rgba(0,0,0,0)",
        transition: "background .25s ease, box-shadow .25s ease",
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          transition: "left .25s cubic-bezier(.4, 0, .2, 1)",
        }}/>
      </span>
    </div>
  );
}
