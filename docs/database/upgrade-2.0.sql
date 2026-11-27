-- Additive upgrade for the original PostgreSQL Prisma schema only.
-- Test against a restored COPY first. Do not run blindly on production.
BEGIN;
ALTER TABLE "BookItem" ADD COLUMN IF NOT EXISTS "alpExcluded" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "StudentPaperScore" ADD COLUMN IF NOT EXISTS "pending" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS "Student" (
  "id" TEXT PRIMARY KEY, "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "admissionNo" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Student_institutionId_admissionNo_key" ON "Student"("institutionId","admissionNo");
CREATE INDEX IF NOT EXISTS "Student_institutionId_name_idx" ON "Student"("institutionId","name");
CREATE TABLE IF NOT EXISTS "StudentEnrollment" (
  "id" TEXT PRIMARY KEY, "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "classId" TEXT NOT NULL REFERENCES "AcademicClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "academicYear" TEXT NOT NULL,"section" TEXT NOT NULL,"rollNo" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentEnrollment_studentId_academicYear_key" ON "StudentEnrollment"("studentId","academicYear");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentEnrollment_classId_academicYear_section_rollNo_key" ON "StudentEnrollment"("classId","academicYear","section","rollNo");
CREATE INDEX IF NOT EXISTS "StudentEnrollment_classId_academicYear_idx" ON "StudentEnrollment"("classId","academicYear");
ALTER TABLE "StudentPaperScore" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StudentPaperScore_studentId_fkey' AND conrelid='"StudentPaperScore"'::regclass) THEN
 ALTER TABLE "StudentPaperScore" ADD CONSTRAINT "StudentPaperScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT PRIMARY KEY,"institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,"startDate" TEXT NOT NULL,"endDate" TEXT NOT NULL,"kind" TEXT NOT NULL,"tentative" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CalendarEvent_institutionId_startDate_idx" ON "CalendarEvent"("institutionId","startDate");
CREATE TABLE IF NOT EXISTS "SmartSyllabusVersion" (
  "id" TEXT PRIMARY KEY,"bookId" TEXT NOT NULL REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL,"academicYear" TEXT NOT NULL,"sourceReference" TEXT NOT NULL,"entries" JSONB NOT NULL,
  "questionCount" INTEGER NOT NULL,"createdById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SmartSyllabusVersion_bookId_academicYear_createdAt_idx" ON "SmartSyllabusVersion"("bookId","academicYear","createdAt");
COMMIT;
