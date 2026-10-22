# Security hardening
- [ ] Deliver only the five requested P0 organization/invite guards and rerun focused tests; no production writes or migration changes.
- [x] Inspect callers and current policies without writes.
- [x] Harden organization, invitation, interview and employee server authorization.
- [x] Add versioned-only transactional/RLS migrations where safely supported.
- [x] Add and run automated security regression tests and available lint checks.
- [x] Record validation results and unresolved migration-dependent blockers; do not publish.
- [ ] Activate reviewed transactional operations and RLS protections: blocked by explicit prohibition on applying production migrations.