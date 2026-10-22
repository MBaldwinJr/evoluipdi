# Security boundaries
- Authorize privileged employee and interview operations using the authenticated client's organization membership before service-role access, because global legacy roles are not tenant boundaries.
- Keep unapplied security SQL in `security/migrations/` until separately approved for application; the managed migration folder cannot accept review-only files without execution.
- New organization creation, invitation acceptance and administrative plan replacement use service-only transactional RPCs, with no non-atomic fallback when the reviewed migration is absent.
- Employee access-role changes affect only the target organization's membership roles; never delete global or independent roles.
- Test security rules with Bun's built-in runner and an isolated PostgreSQL fixture, never with production mutations.