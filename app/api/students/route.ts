import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { ownClass } from "@/lib/ownership";

export const dynamic = "force-dynamic";
const Entry = z.object({ admissionNo: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), classId: z.string(), academicYear: z.string().trim().min(4).max(20), section: z.string().trim().min(1).max(30), rollNo: z.string().trim().min(1).max(30) });
export const GET = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classId"), academicYear = sp.get("year"), section = sp.get("section");
  const enrollments = await prisma.studentEnrollment.findMany({ where: { student: { institutionId: u.institutionId }, class: { institutionId: u.institutionId }, ...(classId ? { classId } : {}), ...(academicYear ? { academicYear } : {}), ...(section ? { section } : {}) }, include: { student: { select: { id: true, name: true, admissionNo: true } }, class: { select: { name: true } } }, orderBy: [{ academicYear: "desc" }, { section: "asc" }, { rollNo: "asc" }], take: 1000 });
  return json({ enrollments });
});
export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  if (u.role === "TEACHER") throw new HttpError(403, "Only school administrators can manage student registrations");
  const { entries } = z.object({ entries: z.array(Entry).min(1).max(250) }).parse(await req.json());
  for (const classId of new Set(entries.map(e => e.classId))) await ownClass(classId, u.institutionId);
  await prisma.$transaction(async tx => {
    for (const e of entries) {
      const student = await tx.student.upsert({ where: { institutionId_admissionNo: { institutionId: u.institutionId, admissionNo: e.admissionNo } }, create: { institutionId: u.institutionId, admissionNo: e.admissionNo, name: e.name }, update: { name: e.name } });
      await tx.studentEnrollment.upsert({ where: { studentId_academicYear: { studentId: student.id, academicYear: e.academicYear } }, create: { studentId: student.id, classId: e.classId, academicYear: e.academicYear, section: e.section, rollNo: e.rollNo }, update: { classId: e.classId, section: e.section, rollNo: e.rollNo } });
    }
  }, { timeout: 30000 });
  return json({ saved: entries.length }, 201);
});
