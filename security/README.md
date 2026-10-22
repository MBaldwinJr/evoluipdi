# Security hardening — review-only delivery

## Boundaries

No publish/deploy, production data writes, or migration application was performed. Database inspection was read-only. PostgreSQL tests create a disposable cluster under `/tmp`, strip inherited PostgreSQL connection variables, listen only on a private Unix socket, and remove the cluster afterward.

## Implemented

- Organization entitlements require authenticated server-side membership or super-admin authorization before querying plans.
- Organization creation ignores client plan/Receita payload, re-fetches Receita on the server and assigns only `free` with `rh` modules inside a transaction.
- Plan changes require super-admin; tenant admin/RH cannot grant themselves enterprise.
- RH cannot invite admin; email is normalized. Acceptance revalidates the authenticated user, confirmed email and supported verified claim, and exact email match. Transaction locks and conditionally consumes the invitation, checking every membership/role write.
- Interview analysis has one caller (`analyzeInterviewFn`). Both the RPC middleware and the service guard are required; the latter checks tenant/role/conductor/manager access before privileged reads, including cache hits, AI or writes.
- Employee creation validates authorization, references and plan/count before Auth creation; subsequent failures trigger compensation. Update/delete enforce employee tenant access. Delete does not delete the global Auth identity. Membership role replacement preserves global and independent roles.
- Weekly evaluations use authenticated queries and tenant predicates; updates preserve original evaluator. Versioned RLS validates membership and employee/process/evaluator relationships with both `USING` and `WITH CHECK`; an identity trigger blocks reassignment.
- Employee role selector reads organizational roles through an authorized server function, matching the new write contract.

## Migration-dependent limitations — intentionally blocked

`migrations/20261022122600_security_hardening.sql` is an unapplied review artifact, not a historical migration edit. Creation, invite acceptance and super-admin plan mutation fail closed with a migration-required message until separately reviewed/applied. There is no unsafe fallback.

Existing production RLS vulnerabilities remain active until the reviewed migration is applied: direct Data API plan writes, global RH role mutations, invitation self-update, membership admin assignment and weak weekly-evaluation updates. Code guards alone cannot remove those database bypasses.

Local fixtures verify PostgreSQL semantics and inspected schema contracts, not every production trigger/policy. Before application, recheck all live permissive policies, managed triggers, grants and organizational enrollment flows; apply only with separate explicit authorization.

## Further demonstrated risks outside the requested endpoint changes

- Legacy `assertRH(userId)` is still used by process/flow/role-generation/template-coverage endpoints; it is not a tenant guard. Some privileged row updates/deletes use only a row ID and company-settings lookup is global. Those paths need a dedicated tenant-scoped follow-up before describing the application as fully hardened.
- The interview-answer write policy permits a conductor without explicit membership; the analysis endpoint is guarded, but direct answer mutation policies still need a separate schema-reviewed correction.
- Legacy navigation and manager listings consume global roles. Organizational role writes intentionally do not grant global privileges. Full navigation reconciliation must replace legacy checks with organization-scoped permissions; it is not safe to restore global role escalation for compatibility.
- Employee count validation is pre-side-effect but not a concurrent capacity reservation. Compensation can itself fail and explicitly requests administrative review; it is not an atomic Auth/PostgreSQL transaction. Profile+employee updates and membership-role replacement are not atomic and can return a partial-operation error. No production failure injection was performed.
- Weekly evaluation multi-item saves are not transactional; concurrent initial saves may return a conflict, without silently overwriting evaluator identity.

## Validation

- `bun run test:security`: 15 passed, 0 failed (authenticated-client authorization via mocked HTTP responses).
- `bun run test:security:sql`: disposable PostgreSQL passed safe free-plan assignment, tenant plan denial, service-only RPC denial, RH→admin denial, missing/mismatched email denial, concurrent single-use acceptance, invitation/org rollback on injected role failure, and weekly-evaluation RLS/identity checks.
- Targeted ESLint on changed server files and authorization tests passed.
- Automatic preview build reported `build OK`; manual build/typecheck intentionally not run because the harness owns those commands.
- Full-project lint fails on existing widespread formatting/type/UI violations; exact final totals are reported in chat. No broad unrelated auto-fixes were applied.
- Authenticated production write flows were not exercised, honoring the no-production-mutation instruction. The migration-dependent flows are intentionally unavailable until application.

Primary skill: security-best-practices.