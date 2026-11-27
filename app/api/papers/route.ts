import { validatePaperQuestions } from "@/lib/paperValidation";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { assertCanCreatePaper } from "@/lib/plan";
import { ownClass, ownSubject } from "@/lib/ownership";
import { PaperInput } from "@/lib/schemas";
import { paperTotal } from "@/lib/templates";
import { sanitizeSections } from "@/lib/questionRules";
import { compactSections } from "@/lib/paperRefs";
import type { PaperSection } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireInstitutionUser();
  const papers = await prisma.savedPaper.findMany({
    where: { institutionId: u.institutionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, paperType: true, totalMarks: true, createdAt: true, watermark: true,
      class: { select: { name: true } }, subject: { select: { name: true } },
      _count: { select: { resultSessions: true } },
    },
    take: 200,
  });
  return json({ papers });
});

export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = PaperInput.parse(await req.json());
  if (b.classId) await ownClass(b.classId, u.institutionId);
  if (b.subjectId) { const subject = await ownSubject(b.subjectId, u.institutionId); if (b.classId && subject.classId !== b.classId) throw new HttpError(400, "Subject does not belong to the selected class"); }
  const { watermark } = await assertCanCreatePaper(u.institutionId);

  // Strict type rules: MCQs only in objective, short only in short, long only in long (options stripped).
  const sections = sanitizeSections(b.sections as PaperSection[]);
  await validatePaperQuestions(sections, u.institutionId, { ...b.buildOptions, subjectId: b.subjectId });
  const [paper] = await prisma.$transaction([
    prisma.savedPaper.create({
      data: {
        title: b.title,
        paperType: b.paperType,
        examDate: b.examDate ? new Date(b.examDate) : null,
        timeAllowed: b.timeAllowed,
        totalMarks: paperTotal(sections),
        sections: compactSections(sections) as object[], // full question and answer snapshot
        printSettings: b.printSettings ?? undefined,
        buildOptions: b.buildOptions ?? undefined,
        watermark,
        classId: b.classId ?? null,
        subjectId: b.subjectId ?? null,
        institutionId: u.institutionId,
        createdById: u.id,
      },
    }),
    prisma.institution.update({ where: { id: u.institutionId }, data: { papersCreated: { increment: 1 } } }),
  ]);
  return json({ id: paper.id }, 201);
});
