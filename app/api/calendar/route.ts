import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { validDate } from "@/lib/calendarRules";
export const dynamic = "force-dynamic";
const Event = z.object({ title: z.string().trim().min(1).max(150), startDate: z.string().refine(validDate), endDate: z.string().refine(validDate), kind: z.enum(["HOLIDAY", "EXAM", "EVENT"]), tentative: z.boolean().default(false) }).refine(e => e.startDate <= e.endDate, "End must be on or after start");
export const GET = handle(async () => {
  const u = await requireInstitutionUser();
  return json({ events: await prisma.calendarEvent.findMany({ where: { institutionId: u.institutionId }, orderBy: { startDate: "asc" }, take: 2000 }) });
});
export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  if (u.role === "TEACHER") throw new HttpError(403, "Only school administrators can change the calendar");
  const data = Event.parse(await req.json());
  return json({ event: await prisma.calendarEvent.create({ data: { ...data, institutionId: u.institutionId } }) }, 201);
});
export const DELETE = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  if (u.role === "TEACHER") throw new HttpError(403, "Only school administrators can change the calendar");
  const id = z.string().min(1).parse(new URL(req.url).searchParams.get("id"));
  const result = await prisma.calendarEvent.deleteMany({ where: { id, institutionId: u.institutionId } });
  if (!result.count) throw new HttpError(404, "Event not found");
  return json({ ok: true });
});
