// ─── PCTL formal-verification property table ────────────────────────────────
// Reference table of properties checked by the verification pipeline
// (mini_CAGE/verificator/FV_pipeline.py). `pctl` is raw LaTeX, rendered with KaTeX.
export const PCTL_RULES = [
  {
    idx: "P1",
    property: "Probability that the Operational-Server is eventually subjected to a successful IMPACT.",
    category: "Safety / Reachability",
    pctl: "P_{=?}\\left[\\mathbf{F}\\, I_{13}(t) = \\textit{Imp}\\right]",
  },
  {
    idx: "P2",
    property: "Probability that the Red Agent eventually gains root access on the Operational-Server.",
    category: "Safety / Reachability",
    pctl: "P_{=?}\\left[\\mathbf{F}\\, I_{13}(t) = R\\right]",
  },
  {
    idx: "P3",
    property: "Probability that the Red Agent can eventually access zone Z₃.",
    category: "Safety / Reachability",
    pctl: "P_{=?}\\left[\\mathbf{F}\\, \\textit{Access}_{Z_3}(t)\\right]",
  },
  {
    idx: "P4",
    property: "Probability that, at all times, the network contains at most one privileged host.",
    category: "Safety / Reachability",
    pctl: "P_{=?}\\left[\\mathbf{G}\\left(\\left|\\{v \\in V : I_v(t) = P\\}\\right| \\le 1\\right)\\right]",
  },
  {
    idx: "P5",
    property: "Probability that whenever a host in zone Z₁ is privileged, it is restored in the next step.",
    category: "Response / Robustness",
    pctl: "P_{=?}\\left[\\mathbf{G}\\left(\\forall v \\in Z_1 : \\neg(I_v(t)=P) \\lor \\mathbf{X}(I_v(t)=S)\\right)\\right]",
  },
  {
    idx: "P6",
    property: "Probability that whenever a host in zone Z₂ is exploited, it is removed/restored in the next step.",
    category: "Response / Robustness",
    pctl: "P_{=?}\\left[\\mathbf{G}\\left(\\forall v \\in Z_2 : \\neg(I_v(t)=\\{C,R\\}) \\lor \\mathbf{X}(I_v(t)=S)\\right)\\right]",
  },
];
