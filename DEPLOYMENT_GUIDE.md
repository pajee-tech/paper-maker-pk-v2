# Staging deployment (not production approval)

The original project uses Next.js 14 and PostgreSQL/Prisma. This upgrade retains that stack. Exact Hostinger plan is unknown. Use a Node.js-capable environment and PostgreSQL; a Hostinger VPS is one option. Do not migrate to MySQL simply to fit an unknown plan. If PostgreSQL is hosted elsewhere, supply its pooled/direct connection URLs. MySQL conversion has not been implemented.

1. Create a separate staging database and export a verified backup of existing data (`pg_dump` custom format). Restore the backup to staging; verify record counts and actual query compatibility.
2. Review `docs/database/upgrade-2.0.sql` against the actual schema. It adds columns/tables/indexes and contains no DROP or DELETE statements. It was not executed or database-validated in this environment. Check a Prisma schema diff before applying, and do not apply if the schema differs unexpectedly.
3. For an existing schema that matches the original repository, apply the reviewed additive SQL only on staging first with `psql -v ON_ERROR_STOP=1 "$DIRECT_URL" -f docs/database/upgrade-2.0.sql`. Check that rows and data remain intact. For a fresh database, follow SETUP_GUIDE.md instead.
4. Install dependencies, generate client, typecheck, test, build; run end-to-end tests with real books and printed OMR sheets. Only deploy after all gates pass.
5. Set secrets in the hosting environment, run `npm run start` behind HTTPS/reverse proxy, set NEXTAUTH_URL to the actual HTTPS URL, configure database access and backups, and remove any developer setup key after use. Never expose PostgreSQL publicly without appropriate controls.
6. For rollback, retain original code and verified DB backup. The new schema is additive, but old code may not understand some new workflow state; restore staging backup if necessary. Do not roll back a live DB blindly because this can lose newer records.

Do not deploy the candidate build to the existing live URL until dependency, build, integration and security checks pass. No deployment or live data migration was performed here.
