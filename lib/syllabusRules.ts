import { createHash } from "node:crypto";
export type SyllabusQuestion = { id: string; type: string; text: string; urduText?: string | null; options?: unknown; exerciseId?: string | null; qNo?: string | null; topic?: string | null };
export type SyllabusEntry = { id: string; signature: string };
/** Exact content signature. The mapping is invalidated when a question's wording/options change. */
export function syllabusSignature(q: SyllabusQuestion): string {
  return createHash("sha256").update(JSON.stringify([q.type, q.text, q.urduText ?? null, q.options ?? null, q.qNo ?? null, q.topic ?? null])).digest("hex");
}
export function syllabusIncludes(q: SyllabusQuestion, entries: SyllabusEntry[]): boolean {
  return entries.some(e => e.id === q.id && e.signature === syllabusSignature(q));
}
export function readSyllabusEntries(value: unknown): SyllabusEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is SyllabusEntry => typeof x === "object" && x !== null && typeof x.id === "string" && typeof x.signature === "string");
}
