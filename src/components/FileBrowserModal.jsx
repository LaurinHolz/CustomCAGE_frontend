import { useCallback, useEffect, useRef, useState } from "react";

const BROWSE_URL = "http://127.0.0.1:9999/browse";
const MKDIR_URL  = "http://127.0.0.1:9999/mkdir";

const C = {
  folder:    "#E0A458",
  file:      "#8BB8E8",
  border:    "rgba(255,255,255,0.07)",
  borderSub: "rgba(255,255,255,0.05)",
  textPri:   "var(--color-text-primary, #f5f5f5)",
  textSec:   "var(--color-text-secondary, rgba(255,255,255,0.50))",
  blue:      "#3B8BD4",
  blueGlow:  "rgba(59,139,212,0.35)",
};

// ── Icons ────────────────────────────────────────────────────────────────────

function FolderIcon({ size = 16, open = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M1 4.5A1.5 1.5 0 0 1 2.5 3h3.086a1 1 0 0 1 .707.293l.914.914H13.5A1.5 1.5 0 0 1 15 5.71V12.5A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5V4.5z"
        fill={C.folder} fillOpacity={open ? 0.65 : 0.85}
      />
      {open && (
        <path d="M1 7h14v5.5A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5V7z"
          fill={C.folder} fillOpacity={0.5}
        />
      )}
    </svg>
  );
}

function FileIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="1.5" width="8" height="13" rx="1.5"
        fill={C.file} fillOpacity="0.12" stroke={C.file} strokeOpacity="0.6" strokeWidth="1"
      />
      <path d="M7.5 1.5v3.5H11L7.5 1.5z" fill={C.file} fillOpacity="0.45" />
      <line x1="4.5" y1="8"   x2="9.5"  y2="8"   stroke={C.file} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round"/>
      <line x1="4.5" y1="10"  x2="9.5"  y2="10"  stroke={C.file} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round"/>
      <line x1="4.5" y1="12"  x2="7.5"  y2="12"  stroke={C.file} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function NewFolderIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M1 4.5A1.5 1.5 0 0 1 2.5 3h3.086a1 1 0 0 1 .707.293l.914.914H13.5A1.5 1.5 0 0 1 15 5.71V12.5A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5V4.5z"
        fill="currentColor" fillOpacity="0.4"
      />
      <line x1="8" y1="7" x2="8"  y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pathSegments(path) {
  if (!path) return [];
  const norm  = path.replace(/\\/g, "/");
  const abs   = norm.startsWith("/");
  const parts = norm.split("/").filter(Boolean);
  const segs  = abs ? [{ label: "/", path: "/" }] : [];
  parts.forEach((part, i) => {
    segs.push({ label: part, path: (abs ? "/" : "") + parts.slice(0, i + 1).join("/") });
  });
  return segs;
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i) : "";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(8,9,14,0.72)",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1100, padding: 20,
  },
  modal: {
    width: "min(640px, 100%)", height: "min(580px, 90vh)",
    display: "flex", flexDirection: "column",
    borderRadius: 16, border: `1px solid ${C.border}`,
    background: "linear-gradient(180deg, rgba(32,34,42,0.99) 0%, rgba(17,18,23,0.99) 100%)",
    boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
    color: C.textPri, overflow: "hidden",
  },

  // ── Title bar ──
  titleBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px 10px",
    borderBottom: `1px solid ${C.border}`, flexShrink: 0,
  },
  titleLeft: { display: "flex", alignItems: "center", gap: 10 },
  titleText: { margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px" },
  modeTag: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "2px 8px", borderRadius: 999,
    background: "rgba(59,139,212,0.15)", color: "#6BB5F0",
    border: "1px solid rgba(59,139,212,0.25)",
  },
  closeBtn: {
    border: "none", background: "rgba(255,255,255,0.06)", color: C.textSec,
    width: 26, height: 26, borderRadius: 8, cursor: "pointer", fontSize: 15,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit", transition: "background .15s",
  },

  // ── Toolbar (breadcrumbs + actions) ──
  toolbar: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 12px",
    borderBottom: `1px solid ${C.borderSub}`,
    background: "rgba(0,0,0,0.18)", flexShrink: 0,
  },
  navBtn: {
    border: "none", background: "rgba(255,255,255,0.055)",
    color: C.textSec, width: 26, height: 26, borderRadius: 7,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: 13, fontFamily: "inherit", flexShrink: 0,
    transition: "background .12s, color .12s",
  },
  breadcrumbs: {
    display: "flex", alignItems: "center", flex: 1,
    overflow: "hidden", minWidth: 0, gap: 1,
  },
  crumb: (isLast) => ({
    border: "none", background: isLast ? "rgba(255,255,255,0.06)" : "transparent",
    color: isLast ? C.textPri : C.textSec,
    padding: "3px 6px", borderRadius: 5,
    fontSize: 11.5, fontWeight: isLast ? 600 : 400,
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    cursor: isLast ? "default" : "pointer",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    maxWidth: 140, flexShrink: 1,
    transition: "background .1s, color .1s",
  }),
  crumbSep: { fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0, padding: "0 1px" },
  newFolderBtn: {
    display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
    color: C.textSec, borderRadius: 7, padding: "4px 10px",
    fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    transition: "background .12s, color .12s, border-color .12s",
  },

  // ── Column header ──
  colHeader: {
    display: "grid", gridTemplateColumns: "1fr 70px",
    padding: "5px 14px 5px 42px",
    borderBottom: `1px solid ${C.borderSub}`,
    background: "rgba(0,0,0,0.12)", flexShrink: 0,
  },
  colLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "rgba(255,255,255,0.28)",
  },

  // ── File list ──
  list: {
    flex: 1, overflowY: "auto", padding: "4px 6px",
    display: "flex", flexDirection: "column",
  },
  entry: (selected, hovered) => ({
    display: "grid", gridTemplateColumns: "28px 1fr 70px",
    alignItems: "center", gap: 4,
    padding: "6px 8px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${selected ? "rgba(59,139,212,0.45)" : "transparent"}`,
    background: selected
      ? "rgba(59,139,212,0.13)"
      : hovered ? "rgba(255,255,255,0.045)" : "transparent",
    transition: "background .08s, border-color .08s",
    userSelect: "none",
  }),
  entryIcon: { display: "flex", alignItems: "center", justifyContent: "center" },
  entryName: {
    fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  entryType: {
    fontSize: 10.5, color: C.textSec, textAlign: "right",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },

  // ── New-folder inline row ──
  newFolderRow: {
    display: "grid", gridTemplateColumns: "28px 1fr auto auto",
    alignItems: "center", gap: 6,
    padding: "5px 8px", borderRadius: 8,
    background: "rgba(59,139,212,0.08)",
    border: "1px solid rgba(59,139,212,0.3)",
    margin: "2px 0",
  },
  newFolderInput: {
    fontSize: 13, padding: "4px 8px", borderRadius: 6,
    border: "1px solid rgba(59,139,212,0.5)", background: "rgba(0,0,0,0.3)",
    color: C.textPri, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  },
  inlineBtn: (primary) => ({
    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 11.5, fontWeight: 700, fontFamily: "inherit",
    background: primary ? C.blue : "rgba(255,255,255,0.06)",
    color: primary ? "#fff" : C.textSec,
    flexShrink: 0, transition: "opacity .12s",
  }),

  empty: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    color: C.textSec, fontSize: 13, gap: 8, padding: 32,
  },

  // ── Footer ──
  footer: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 16px",
    borderTop: `1px solid ${C.border}`,
    background: "rgba(0,0,0,0.2)", flexShrink: 0,
  },
  selectionBox: {
    flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0,
  },
  selectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textSec },
  selectionPath: {
    fontSize: 11.5, color: C.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
  },
  btnRow: { display: "flex", gap: 8, flexShrink: 0 },
  cancelBtn: {
    padding: "8px 14px", borderRadius: 9,
    border: `1px solid rgba(255,255,255,0.1)`, background: "rgba(255,255,255,0.04)",
    color: C.textPri, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    transition: "background .12s",
  },
  confirmBtn: (disabled) => ({
    padding: "8px 18px", borderRadius: 9, border: "none",
    background: disabled ? "rgba(59,139,212,0.18)" : `linear-gradient(180deg,#4AA0E6,${C.blue})`,
    color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `0 6px 18px ${C.blueGlow}`,
    transition: "all .15s",
  }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FileBrowserModal({ mode, onSelect, onClose, initialPath }) {
  const [contents, setContents]     = useState({ path: "", parent: null, dirs: [], files: [] });
  const [loading, setLoading]       = useState(true);
  const [hoveredPath, setHoveredPath] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [creatingDir, setCreatingDir]   = useState(false);
  const [newDirName, setNewDirName]     = useState("");
  const [mkdirError, setMkdirError]     = useState(null);
  const newDirRef = useRef(null);

  const browse = useCallback((path) => {
    setLoading(true);
    setSelectedFile(null);
    setCreatingDir(false);
    setMkdirError(null);
    const ext = mode === "file" ? ".pth" : "";
    fetch(`${BROWSE_URL}?path=${encodeURIComponent(path || "")}&ext=${ext}`)
      .then((r) => r.json())
      .then((d) => setContents(d))
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => { browse(initialPath || ""); }, []);

  // Focus new-folder input when it appears
  useEffect(() => {
    if (creatingDir && newDirRef.current) {
      newDirRef.current.focus();
      setNewDirName("");
    }
  }, [creatingDir]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleMkdir = async () => {
    const name = newDirName.trim();
    if (!name) return;
    const sep      = contents.path.includes("\\") ? "\\" : "/";
    const newPath  = contents.path.replace(/[/\\]+$/, "") + sep + name;
    setMkdirError(null);
    try {
      const r = await fetch(MKDIR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath }),
      });
      if (!r.ok) throw new Error(await r.text());
      setCreatingDir(false);
      browse(contents.path);
    } catch (e) {
      setMkdirError(e.message || "Failed to create directory");
    }
  };

  const handleNewDirKey = (e) => {
    if (e.key === "Enter")  handleMkdir();
    if (e.key === "Escape") { setCreatingDir(false); setMkdirError(null); }
  };

  const canConfirm    = mode === "dir" ? contents.path !== "" : selectedFile !== null;
  const selectionPath = mode === "dir" ? contents.path : (selectedFile || "");
  const segments      = pathSegments(contents.path);

  const allEntries = [
    ...contents.dirs.map((d) => ({ ...d, isDir: true })),
    ...(mode === "file" ? contents.files.map((f) => ({ ...f, isDir: false })) : []),
  ];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Title bar ── */}
        <div style={S.titleBar}>
          <div style={S.titleLeft}>
            <h3 style={S.titleText}>
              {mode === "dir" ? "Choose directory" : "Choose checkpoint"}
            </h3>
            <span style={S.modeTag}>{mode === "dir" ? "Directory" : ".pth file"}</span>
          </div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* ── Toolbar: nav buttons + breadcrumbs + new folder ── */}
        <div style={S.toolbar}>
          <button
            style={{ ...S.navBtn, opacity: contents.parent ? 1 : 0.3 }}
            disabled={!contents.parent}
            title="Go up"
            onClick={() => contents.parent && browse(contents.parent)}
          >
            ↑
          </button>
          <button
            style={{ ...S.navBtn, opacity: loading ? 0.4 : 1 }}
            title="Refresh"
            onClick={() => browse(contents.path)}
          >
            ↺
          </button>

          {/* Breadcrumbs */}
          <div style={S.breadcrumbs}>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              return (
                <span key={seg.path} style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                  {i > 0 && <span style={S.crumbSep}>/</span>}
                  <button
                    style={S.crumb(isLast)}
                    onClick={() => !isLast && browse(seg.path)}
                    title={seg.path}
                  >
                    {seg.label}
                  </button>
                </span>
              );
            })}
          </div>

          {mode === "dir" && (
            <button
              style={S.newFolderBtn}
              onClick={() => { setCreatingDir(true); setMkdirError(null); }}
              title="Create new folder here"
            >
              <NewFolderIcon />
              New folder
            </button>
          )}
        </div>

        {/* ── Column header ── */}
        <div style={S.colHeader}>
          <span style={S.colLabel}>Name</span>
          <span style={{ ...S.colLabel, textAlign: "right" }}>Type</span>
        </div>

        {/* ── File list ── */}
        <div style={S.list}>
          {/* Inline new-folder row */}
          {creatingDir && (
            <div style={S.newFolderRow}>
              <div style={S.entryIcon}><FolderIcon open /></div>
              <input
                ref={newDirRef}
                style={S.newFolderInput}
                placeholder="New folder name"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                onKeyDown={handleNewDirKey}
              />
              <button style={S.inlineBtn(true)} onClick={handleMkdir}>Create</button>
              <button style={S.inlineBtn(false)} onClick={() => { setCreatingDir(false); setMkdirError(null); }}>✕</button>
            </div>
          )}
          {mkdirError && (
            <div style={{ fontSize: 11, color: "#E24B4A", padding: "4px 10px" }}>{mkdirError}</div>
          )}

          {loading ? (
            <div style={S.empty}>
              <span style={{ opacity: 0.5 }}>Loading…</span>
            </div>
          ) : allEntries.length === 0 && !creatingDir ? (
            <div style={S.empty}>
              {mode === "file"
                ? <><span>No .pth files in this directory.</span><span style={{ fontSize: 11 }}>Navigate into a subdirectory to find checkpoints.</span></>
                : <span>This directory is empty.</span>}
            </div>
          ) : allEntries.map((entry) => {
            const isSelected = !entry.isDir && selectedFile === entry.path;
            const isHovered  = hoveredPath === entry.path;
            const typeLabel  = entry.isDir ? "folder" : extOf(entry.name);
            return (
              <div
                key={entry.path}
                style={S.entry(isSelected, isHovered)}
                onClick={() => entry.isDir ? browse(entry.path) : setSelectedFile(entry.path)}
                onDoubleClick={() => { if (!entry.isDir && mode === "file") onSelect(entry.path); }}
                onMouseEnter={() => setHoveredPath(entry.path)}
                onMouseLeave={() => setHoveredPath(null)}
                title={entry.path}
              >
                <div style={S.entryIcon}>
                  {entry.isDir ? <FolderIcon /> : <FileIcon />}
                </div>
                <span style={{ ...S.entryName, color: entry.isDir ? C.textPri : C.file }}>
                  {entry.name}
                </span>
                <span style={S.entryType}>{typeLabel}</span>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <div style={S.selectionBox}>
            <span style={S.selectionLabel}>
              {mode === "dir" ? "Selected directory" : "Selected file"}
            </span>
            <span style={S.selectionPath} title={selectionPath}>
              {selectionPath || "—"}
            </span>
          </div>
          <div style={S.btnRow}>
            <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={S.confirmBtn(!canConfirm)} onClick={() => canConfirm && onSelect(selectionPath)} disabled={!canConfirm}>
              {mode === "dir" ? "Select directory" : "Open"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
