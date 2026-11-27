# Security notes

Retained NextAuth/bcrypt and institution-scoped queries. Changed server sessions to re-read current user/role/institution; new school records require tenant-scoped queries. Student and calendar writes require non-teacher administrator role. Saved source IDs must be accessible to the school, and published Smart Syllabus entries must match the selected revision. New snapshots freeze paper content; paper editing/deletion stops once a result session exists. Final results cannot be overwritten using normal result updates. Existing API cache reads bypass persisted question data to prevent stale or cross-account cache reads.

Remaining work before production: full cross-tenant integration tests; robust distributed rate limiting and login throttling; audit trails; request size limits; content licensing; role review for all legacy routes; CSRF/origin review; backup/restore drills; secret management; dependency vulnerability checks; concurrency testing (paper/result creation); authorized corrections/revisions; browser-local PDF data separation on shared computers. A user allowed to view a question can still copy it. Do not claim perfect anti-copy security.

Never include `.env`, database passwords, API credentials, real student data or test credentials in the public archive. Use synthetic data only on staging.
