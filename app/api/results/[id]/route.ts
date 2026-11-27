import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { ownSession, ownPaper } from "@/lib/ownership";
import { ScoreInput } from "@/lib/schemas";
import { computeResults, DEFAULT_GRADES } from "@/lib/grading";
import type { GradeBand, ScoreRow } from "@/lib/types";

type Ctx = { params: { id: string } };

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownSession(params.id, u.institutionId);
  const session = await prisma.paperResultSession.findUnique({
    where: { id: params.id },
    include: {
      scores: { orderBy: { rollNo: "asc" } },
      paper: { include: { class: true, subject: true, institution: { select: { name: true, city: true, address: true, logoDataUrl: true } } } },
    },
  });
  return json({ session });
});

const Body = z.object({
  totalMarks: z.number().min(1).max(10000),
  passPercent: z.number().min(0).max(100),
  gradingScheme: z.array(z.object({ grade: z.string().max(6), min: z.number().min(0).max(100) })).max(12).optional(),
  finalize: z.boolean().optional(),
  scores: z.array(ScoreInput).max(1000),
});

/** Replaces all scores, recomputes %/grade/pass/positions on the server (single source of truth). */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  const session = await ownSession(params.id, u.institutionId);
  const paper = await ownPaper(session.paperId, u.institutionId);
  if (session.status === "FINAL") throw new HttpError(409, "Result is finalized and locked.");
  const b = Body.parse(await req.json());
  if (b.totalMarks !== paper.totalMarks) throw new HttpError(400, "Total marks must match the saved examination paper.");
  const rollNos = b.scores.map(r => r.rollNo.trim());
  if (rollNos.some(r => !r || r === "-") || new Set(rollNos).size !== rollNos.length) throw new HttpError(400, "Every student needs a unique roll number in this result session.");
  const studentIds = b.scores.flatMap(r => r.studentId ? [r.studentId] : []);
  if (new Set(studentIds).size !== studentIds.length) throw new HttpError(400, "Duplicate student record in this result session.");
  const students = await prisma.student.findMany({ where: { id: { in: studentIds }, institutionId: u.institutionId, ...(paper.classId ? { enrollments: { some: { classId: paper.classId } } } : {}) }, select: { id: true, name: true } });
  if (students.length !== studentIds.length) throw new HttpError(400, "Student record is not available for this class.");
  const names = new Map(students.map(s => [s.id, s.name]));
  for (const r of b.scores) {
    if (r.studentId) r.studentName = names.get(r.studentId)!;
    if (b.finalize && !r.absent && r.pending) throw new HttpError(400, `Marks still pending for roll ${r.rollNo}`);
    if (b.finalize && !r.studentName.trim()) throw new HttpError(400, "Enter every student name before finalizing.");
    if (!r.absent && (r.mcqObtained != null || r.subjectiveObtained != null)) {
      r.obtained = (r.mcqObtained ?? 0) + (r.subjectiveObtained ?? 0);
    }
    if (r.obtained > b.totalMarks) throw new HttpError(400, `Marks exceed paper total for roll ${r.rollNo}`);
  }
  if (b.finalize && !b.scores.length) throw new HttpError(400, "Add scores before finalizing.");
  const scheme: GradeBand[] = b.gradingScheme?.length ? b.gradingScheme : DEFAULT_GRADES;
  const rows = computeResults(b.scores as ScoreRow[], b.totalMarks, b.passPercent, scheme);

  await prisma.$transaction(async tx => {
    const locked = await tx.paperResultSession.updateMany({ where: { id: params.id, institutionId: u.institutionId, status: "DRAFT" }, data: { totalMarks: b.totalMarks, passPercent: b.passPercent, gradingScheme: scheme as unknown as object[], status: b.finalize ? "FINAL" : "DRAFT" } });
    if (!locked.count) throw new HttpError(409, "Result was already finalized.");
    await tx.studentPaperScore.deleteMany({ where: { sessionId: params.id } });
    await tx.studentPaperScore.createMany({
      data: rows.map((r) => ({
        sessionId: params.id,
        studentId: r.studentId ?? null,
        rollNo: r.rollNo,
        studentName: r.studentName,
        fatherName: r.fatherName || null,
        parentPhone: r.parentPhone || null,
        mcqObtained: r.mcqObtained ?? null,
        subjectiveObtained: r.subjectiveObtained ?? null,
        obtained: r.obtained,
        absent: !!r.absent,
        pending: !!r.pending && !r.absent,
        percentage: r.percentage ?? 0,
        grade: r.grade ?? null,
        passed: !!r.passed,
        position: r.position ?? null,
        breakdown: (r.breakdown ?? undefined) as object | undefined,
        source: r.source ?? "MANUAL",
      })),
    });
  });
  return json({ ok: true, scores: rows });
});
