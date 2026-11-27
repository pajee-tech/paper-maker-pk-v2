import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { readableBook, writableBook } from "@/lib/books";
import { syllabusSignature } from "@/lib/syllabusRules";
type Ctx = { params: { id: string } };
export const dynamic = "force-dynamic";
const selection = { id: true, title: true, academicYear: true, sourceReference: true, questionCount: true, createdAt: true } as const;
export const GET = handle(async (_req: Request, {params}: Ctx) => {
  const u = await requireUser(); await readableBook(params.id, u);
  const versions = await prisma.smartSyllabusVersion.findMany({ where: { bookId: params.id }, orderBy: { createdAt: "desc" }, select: selection, take: 50 });
  return json({ versions });
});
export const POST = handle(async (req: Request, {params}: Ctx) => {
  const u = await requireUser(); const book = await writableBook(params.id, u);
  if (u.role === "TEACHER") throw new HttpError(403, "Only an administrator can publish a syllabus version");
  if (book.status !== "READY") throw new HttpError(409, "Finish processing the book before publishing its syllabus");
  const b = z.object({ title: z.string().trim().min(3).max(150), academicYear: z.string().trim().min(4).max(30), sourceReference: z.string().trim().min(3).max(1000), confirmed: z.literal(true) }).parse(await req.json());
  const items = await prisma.bookItem.findMany({ where: { bookId: book.id, alpExcluded: false, chapter: { isAlp: true }, source: { not: "GENERATED" } }, select: { id: true, type: true, text: true, urduText: true, options: true, qNo: true, topic: true }, take: 10001 });
  if (!items.length) throw new HttpError(400, "Mark approved chapters and questions before publishing");
  if (items.length > 10000) throw new HttpError(400, "Split this book into smaller syllabus volumes before publishing");
  const entries = items.map(q=>({ id: q.id, signature: syllabusSignature(q) }));
  const version = await prisma.smartSyllabusVersion.create({ data: { bookId: book.id, title: b.title, academicYear: b.academicYear, sourceReference: b.sourceReference, entries, questionCount: entries.length, createdById: u.id }, select: selection });
  return json({ version }, 201);
});
