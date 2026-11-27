import { readSyllabusEntries, syllabusSignature } from "./syllabusRules";
import { prisma } from "./prisma";
import { HttpError } from "./auth";
import type { PaperSection } from "./types";

/** Authorize every referenced question and preserve its original image in the saved snapshot. */
export async function validatePaperQuestions(sections: PaperSection[], institutionId: string, options: { alpOnly?: boolean; bookId?: string; syllabusId?: string; subjectId?: string | null } = {}) {
  const questions = sections.flatMap(s => s.questions);
  const version = options.syllabusId && options.alpOnly ? await prisma.smartSyllabusVersion.findFirst({ where: { id: options.syllabusId, bookId: options.bookId || "__none__", book: { OR: [{institutionId}, {institutionId:null}] } } }) : null;
  if (options.syllabusId && options.alpOnly && !version) throw new HttpError(400, "Selected syllabus version is not available");
  const entries = new Map(readSyllabusEntries(version?.entries).map(e=>[e.id,e.signature]));
  const bankIds = questions.filter(q => !q.id.startsWith("custom-") && !q.id.startsWith("book-")).map(q => q.id);
  const bookIds = questions.filter(q => q.id.startsWith("book-")).map(q => q.id.slice(5));
  const [bank, book] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: bankIds }, chapter: { subject: { class: { institutionId } }, ...(options.subjectId ? { subjectId: options.subjectId } : {}) } }, select: { id: true, imageSnippet: true, chapter: { select: { isAlp: true } } } }),
    prisma.bookItem.findMany({ where: { id: { in: bookIds }, book: { OR: [{ institutionId }, { institutionId: null }], status: "READY" }, ...(options.bookId ? { bookId: options.bookId } : {}) }, select: { id: true, type: true, text: true, urduText: true, options: true, qNo: true, topic: true, imageSnippet: true, alpExcluded: true, chapter: { select: { isAlp: true } } } }),
  ]);
  const rows = new Map<string, (typeof bank[number] & { alpExcluded: boolean }) | typeof book[number]>([...bank.map(q => [q.id, { ...q, alpExcluded: false }] as const), ...book.map(q => [`book-${q.id}`, q] as const)]);
  if (!questions.length) throw new HttpError(400, "A paper must contain at least one valid question.");
  if (new Set(questions.map(q=>q.id)).size !== questions.length) throw new HttpError(400, "Duplicate question in this paper.");
  for (const q of questions) {
    if (q.id.startsWith("custom-")) {
      if (options.alpOnly) throw new HttpError(400, "Smart Syllabus requires questions from an approved chapter; use Custom mode for original questions.");
      continue;
    }
    const row = rows.get(q.id);
    if (!row) throw new HttpError(400, "Question is no longer available in the selected library or subject.");
    if (version && (!q.id.startsWith("book-") || !("text" in row) || entries.get(q.id.slice(5)) !== syllabusSignature(row))) throw new HttpError(400, "Question is not part of this published syllabus, or its source wording has changed.");
    if (options.alpOnly && !version && (!row.chapter.isAlp || row.alpExcluded)) throw new HttpError(400, "Question is outside the approved Smart Syllabus.");
    if (q.type === "MCQ" && q.correctOption != null && !q.options?.[q.correctOption]?.trim()) throw new HttpError(400, "Invalid MCQ answer key.");
    if (q.imageSnippet === undefined) q.imageSnippet = row.imageSnippet;
  }
}
