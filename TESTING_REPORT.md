# Actual verification

- Node.js available: v22.16.0; npm 10.9.2.
- Source syntax parsed with installed global TypeScript compiler (see final syntax-check output in docs).
- `NODE_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules npm test`: **11 passed, 0 failed**. Covers Smart Syllabus scope/signatures, calendar/date validation, result state/rank calculation, OMR score and geometry. Raw output: `docs/unit-test-output.txt`.
- `curl -I --max-time 5 https://registry.npmjs.org/next`: failed, DNS could not resolve host.
- `npm install --offline --ignore-scripts --no-audit --no-fund`: failed `ENOTCACHED` for @prisma/client. Full dependency installation not possible.
- Full `npm run typecheck`, Prisma validate/generate, migration execution, full Next.js production build, demo seed and browser E2E: **NOT verified**. Lockfile was absent in original ZIP and cannot be generated offline.
- No production database connection, live deployment, official syllabus data, or actual sample scanned textbooks tested. Tests are logic tests, not proof of a complete working application.
