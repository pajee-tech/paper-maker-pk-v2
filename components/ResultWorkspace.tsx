"use client";
import { useEffect, useMemo, useState } from "react";
import CheckedPdfResultCounter from "./CheckedPdfResultCounter";
import ResultPrintouts from "./ResultPrintouts";
import { api } from "./useCatalog";
import { computeResults, DEFAULT_GRADES } from "@/lib/grading";
import type { GradeBand, PaperDTO, ScoreRow } from "@/lib/types";

interface SessionDTO {
  id: string;
  totalMarks: number;
  passPercent: number;
  gradingScheme: GradeBand[] | null;
  status: "DRAFT" | "FINAL";
  scores: (ScoreRow & { fatherName?: string | null; parentPhone?: string | null })[];
}

export default function ResultWorkspace({ sessionId, paper, omrAllowed = true }: { sessionId: string; paper: PaperDTO; omrAllowed?: boolean }) {
  const [rosterYear, setRosterYear] = useState("");
  const [rosterSection, setRosterSection] = useState("A");
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [totalMarks, setTotalMarks] = useState(paper.totalMarks);
  const [passPercent, setPassPercent] = useState(33);
  const [scheme, setScheme] = useState<GradeBand[]>(DEFAULT_GRADES);
  const [status, setStatus] = useState<"DRAFT" | "FINAL">("DRAFT");
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showScheme, setShowScheme] = useState(false);

  useEffect(() => {
    api<{ session: SessionDTO }>(`/api/results/${sessionId}`, "GET").then(({ session }) => {
      setRows(session.scores.map((s) => ({ ...s, fatherName: s.fatherName ?? undefined, parentPhone: s.parentPhone ?? undefined })));
      setTotalMarks(session.totalMarks);
      setPassPercent(session.passPercent);
      if (session.gradingScheme?.length) setScheme(session.gradingScheme);
      setStatus(session.status);
      setLoaded(true);
    }).catch(e => setMsg(e.message));
  }, [sessionId]);

  // Warn before leaving with unsaved marks
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const computed = useMemo(() => computeResults(rows.filter((r) => r.rollNo || r.studentName), totalMarks, passPercent, scheme), [rows, totalMarks, passPercent, scheme]);

  async function importRoster() {
    if (!paper.classId || !rosterYear.trim() || !rosterSection.trim()) return;
    try {
      const { enrollments } = await api<{ enrollments: { rollNo: string; student: { id: string; name: string } }[] }>(`/api/students?classId=${encodeURIComponent(paper.classId)}&year=${encodeURIComponent(rosterYear)}&section=${encodeURIComponent(rosterSection)}`, "GET");
      if (!enrollments.length) throw new Error("No registered students for this class, year and section.");
      if (rows.length && !confirm("Replace current draft rows with the selected class roster?")) return;
      setRows(enrollments.map(e => ({ studentId: e.student.id, studentName: e.student.name, rollNo: e.rollNo, obtained: 0, pending: true, source: "MANUAL" }))); setDirty(true); setMsg("Roster loaded. Enter marks and check every student before finalizing.");
    } catch (e) { setMsg((e as Error).message); }
  }
  async function save(finalize: boolean) {
    setMsg("");
    if (status === "FINAL") return;
    if (finalize && rows.some(r => (r.rollNo || r.studentName) && !r.absent && r.pending)) { setMsg("Enter marks for all students (or mark them absent) before finalizing."); return; }
    if (finalize && !confirm("Finalize and lock this result? Verify all marks, including genuine zero marks and absences.")) return;
    if (rows.some(r => !r.absent && r.obtained > totalMarks)) { setMsg("Marks exceed the paper total."); return; }
    try {
      await api(`/api/results/${sessionId}`, "PUT", {
        totalMarks, passPercent, gradingScheme: scheme, finalize,
        scores: rows.filter(r => r.rollNo || r.studentName).map(({ percentage: _p, grade: _g, passed: _pa, position: _po, ...r }) => ({
          ...r,
          rollNo: r.rollNo || "-",
          fatherName: r.fatherName || undefined,
          parentPhone: r.parentPhone || undefined,
          mcqObtained: r.mcqObtained ?? null,
          subjectiveObtained: r.subjectiveObtained ?? null,
        })),
      });
      setStatus(finalize ? "FINAL" : "DRAFT");
      if (finalize) window.location.reload();
      setDirty(false);
      setMsg(finalize ? "Result finalized ✔" : "Draft saved ✔");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!loaded) return <p className="muted">{msg || "Loading…"}</p>;

  return (
    <div>
      <div className="card no-print">
        <div className="row">
          <h1 style={{ margin: 0 }}>Class Result — {paper.title}</h1>
          <span className={`badge ${status === "FINAL" ? "ok" : "warn"}`}>{status}</span>
          <span className="spacer" />
          <a className="btn btn-ghost" href={`/dashboard/papers/${paper.id}`}>← Paper</a>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div style={{ width: 130 }}><label>Total marks</label><input type="number" min={1} value={totalMarks} readOnly /></div>
          <div style={{ width: 130 }}><label>Pass %</label><input type="number" min={0} max={100} disabled={status === "FINAL"} value={passPercent} onChange={(e) => { setPassPercent(Number(e.target.value)); setDirty(true); }} /></div>
          <button className="btn-ghost btn-sm" onClick={() => setShowScheme((v) => !v)}>Grading scheme</button>
          <span className="spacer" />
          {msg && <span className="small">{msg}</span>}
          <button disabled={status === "FINAL"} className="btn-ghost" onClick={() => save(false)}>Save draft</button>
          <button disabled={status === "FINAL"} onClick={() => save(true)}>Finalize result</button>
        </div>
        {showScheme && (
          <div className="row" style={{ marginTop: 10 }}>
            {scheme.map((b, i) => (
              <div key={i} style={{ width: 90 }}>
                <input disabled={status === "FINAL"} value={b.grade} onChange={(e) => setScheme(scheme.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} />
                <input disabled={status === "FINAL"} type="number" value={b.min} onChange={(e) => setScheme(scheme.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))} />
              </div>
            ))}
            <span className="small muted">Grade ↑ / minimum % ↓. Below pass % is always F.</span>
          </div>
        )}
      </div>

      {status !== "FINAL" && paper.classId && <div className="card no-print"><h3>Load registered class</h3><div className="row"><input style={{maxWidth:160}} aria-label="Academic year" placeholder="Academic year (2026-27)" value={rosterYear} onChange={e=>setRosterYear(e.target.value)}/><input style={{maxWidth:100}} aria-label="Section" value={rosterSection} onChange={e=>setRosterSection(e.target.value)}/><button disabled={!rosterYear.trim() || !rosterSection.trim()} onClick={importRoster}>Load students</button></div></div>}
      {status !== "FINAL" && <div className="no-print">
        <CheckedPdfResultCounter omrAllowed={omrAllowed} paper={paper} rows={rows} totalMarks={totalMarks} onRowsChange={(r) => { setRows(r); setDirty(true); }} />
      </div>}

      <div style={{ marginTop: 14 }}>
        <ResultPrintouts paper={paper} rows={computed} totalMarks={totalMarks} passPercent={passPercent} />
      </div>
    </div>
  );
}
