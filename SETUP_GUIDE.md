# PaperMaker PK 2.0 — candidate test build

**Status:** Source-level upgrade; independent domain tests pass. Full dependency installation, generated Prisma client, database integration, production build and browser validation were not possible in the authoring environment. Do not deploy to real school users before completing these checks.

## First run (local PostgreSQL, Node.js 22 LTS recommended)

1. Extract the ZIP. Open its project directory in VS Code or a terminal.
2. Install Node.js 22 and PostgreSQL 16 (or Docker Desktop). Use a separate **papermaker_test** database, not your production DB.
3. For Docker: set a local-only password, then start the test database. Bash:

```sh
export PM_TEST_DB_PASSWORD='replace-with-a-local-test-password'
docker compose -f docker-compose.testing.yml up -d --wait
cp .env.example .env
```

PowerShell: use `$env:PM_TEST_DB_PASSWORD='...'` and `Copy-Item .env.example .env`.

4. Edit `.env`. Replace placeholders; URL-encode special characters in passwords. Set both connection URLs to the test database:

```env
DATABASE_URL="postgresql://papermaker:YOUR_LOCAL_PASSWORD@127.0.0.1:5433/papermaker_test"
DIRECT_URL="postgresql://papermaker:YOUR_LOCAL_PASSWORD@127.0.0.1:5433/papermaker_test"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="REPLACE_WITH_RANDOM_SECRET"
NEXT_PUBLIC_EDITION="full"
NEXT_PUBLIC_APP_NAME="PaperMaker PK 2.0"
```

Generate a random secret using `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

5. Run the following, stopping on any failure:

```sh
npm install
npx prisma validate
npx prisma db push
npm run typecheck
npm test
npm run build
```

`npm install` needs network access including the original SheetJS dependency CDN. It creates the lockfile; commit it after successful validation. Do not use `--accept-data-loss` or `--force-reset`. `db push` above is for a new empty test database only.

6. Seed optional synthetic data using the shell (Node 22 loads .env explicitly):

```sh
PM_TEST_DB_CONFIRM=YES DEMO_PASSWORD='choose-your-own-12-plus-character-password' node --env-file=.env scripts/seed-testing.mjs
npm run dev
```

PowerShell: set `$env:PM_TEST_DB_CONFIRM='YES'` and `$env:DEMO_PASSWORD='your-own-password'` then run `node --env-file=.env scripts/seed-testing.mjs`.

Open http://localhost:3000/login, use `demo-admin@example.test` and the password you chose. Seed is restricted to a DB named `papermaker_test`. It was not executed in the authoring environment. The original registration and admin setup routes remain available.

## Test walkthrough

- Open Book Library → DEMO Mathematics sample bank. The demo has included algebra and excluded geometry. It is **not official** curriculum data.
- Generate Paper → select 9th / Mathematics. The Smart Syllabus option starts enabled; select the demo version. Use a small template or adjust counts, then auto-pick. Verify excluded geometry is absent. Untick Smart Syllabus for Full Book mode.
- Preview the paper. Enable OMR sheet; keep the teacher key off for student copies. Print via browser PDF. Review answers before starting the result session.
- Students → enter class, year and section; paste tab-separated admission no, roll no, name. The demo roster already contains five students.
- Open result workspace → load registered class (2026-27, A). Enter marks, explicitly mark absent students, and finalize. Check the Results centre filters. Final results cannot be edited using the normal PUT endpoint.
- Calendar → enter confirmed/tentative dates, then suggest a schedule excluding confirmed holidays and exams.
- Test an actual private scanned book: upload PDF, select full OCR and mixed-language mode if needed, verify each extracted question manually. Original PDF stays in IndexedDB. Check interrupted uploads and retry.
- Open two separate test accounts/institutions and check access to each other's book, student, paper and result IDs returns an authorization error.

## Notes

`npm run build` no longer pushes schema changes automatically. The existing production database is not modified by this archive. See DEPLOYMENT_GUIDE.md and docs/database/upgrade-2.0.sql for a staged upgrade. Full instructions and original product features are also documented in the retained README.md.
