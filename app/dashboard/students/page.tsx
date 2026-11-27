"use client";
import { useEffect, useState } from "react";
import { api, useCatalog } from "@/components/useCatalog";

type Enrollment = { id: string; academicYear: string; section: string; rollNo: string; class: { name: string }; student: { id: string; admissionNo: string; name: string } };
export default function Students() {
  const { classes } = useCatalog();
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [classId, setClass] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("A");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setRows((await api<{ enrollments: Enrollment[] }>("/api/students", "GET")).enrollments); } catch(e) { setMessage((e as Error).message); } };
  useEffect(() => { void load(); }, []);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const entries = input.trim().split(/\r?\n/).filter(Boolean).map(line => {
        const [admissionNo, rollNo, name, ...rest] = line.split("\t").map(x => x.trim());
        if (!admissionNo || !rollNo || !name || rest.length) throw new Error("Each row needs 3 tab-separated columns: admission no, roll no, student name");
        return { admissionNo, rollNo, name, classId, academicYear: year, section };
      });
      await api("/api/students", "POST", { entries }); setInput(""); await load(); setMessage("Student records saved.");
    } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <><h1>Student directory</h1><div className="card"><h2>Register or promote students</h2><p className="muted">Paste three columns from Excel (no header): admission number, roll number, student name. The same admission number preserves the student's identity.</p><div className="grid3"><div><label>Class</label><select value={classId} onChange={e=>setClass(e.target.value)}><option value="">Choose class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label>Academic year</label><input placeholder="2026-27" value={year} onChange={e=>setYear(e.target.value)}/></div><div><label>Section</label><input value={section} onChange={e=>setSection(e.target.value)}/></div></div><label>Student rows</label><textarea rows={5} value={input} onChange={e=>setInput(e.target.value)}/><button disabled={busy || !classId || !year || !input.trim()} onClick={save}>{busy?"Saving…":"Save students"}</button>{message&&<p role="status">{message}</p>}</div><div className="card"><h2>Enrollment register</h2><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Admission no.</th><th>Student</th><th>Year</th><th>Class</th><th>Section</th><th>Roll no.</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.student.admissionNo}</td><td>{r.student.name}</td><td>{r.academicYear}</td><td>{r.class.name}</td><td>{r.section}</td><td>{r.rollNo}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="muted">No enrollments yet.</p>}</div></>;
}
