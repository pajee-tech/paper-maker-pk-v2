import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { ownPaper } from "@/lib/ownership";
import { expandSections } from "@/lib/paperRefs";
import { DEFAULT_GRADES } from "@/lib/grading";
import { assertFeature } from "@/lib/plan";

type Ctx = { params: { id: string } };

/** "Generate Class Result (Optional)" — opens the latest session for this paper or creates one. */
export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  const paper = await ownPaper(params.id, u.institutionId);
  await assertFeature(u.institutionId, "results");
  const existing = await prisma.paperResultSession.findFirst({ where: { paperId: paper.id }, orderBy: { createdAt: "desc" } });
  if (existing) return json({ id: existing.id });
  const sections = await expandSections(paper.sections, u.institutionId);
  if (sections.some(s => s.isObjective && s.questions.some(q => q.correctOption == null || !q.options?.[q.correctOption]?.trim()))) throw new HttpError(400, "Complete all objective answers before creating a result session.");
  const s = await prisma.paperResultSession.create({
    data: {
      paperId: paper.id,
      institutionId: u.institutionId,
      totalMarks: paper.totalMarks,
      passPercent: 33,
      gradingScheme: DEFAULT_GRADES as unknown as object[],
    },
  });
  return json({ id: s.id }, 201);
});
