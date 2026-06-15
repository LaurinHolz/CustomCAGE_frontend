import { useEffect, useState } from "react";
import { S } from "../styles/styles";

export default function VerificationProperties() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:9999/verification_properties.json")
      .then((res) => res.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <div style={S.panel}>
        <h3 style={{ marginTop: 0 }}>Formal Verification Properties</h3>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Property</th>
              <th style={th}>Category</th>
              <th style={th}>PCTL Logic</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.idx}>
                <td style={td}>{row.idx}</td>
                <td style={td}>{row.property}</td>
                <td style={td}>{row.category}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{row.pctl}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            No properties loaded yet. Run verification first.
          </p>
        )}
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "8px",
  borderBottom: "1px solid var(--color-border-primary)",
};

const td = {
  padding: "8px",
  borderBottom: "1px solid var(--color-border-tertiary)",
  verticalAlign: "top",
};