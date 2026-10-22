"""Run reviewed SQL only against a disposable, private local PostgreSQL cluster."""
import concurrent.futures
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
TEMP = Path(tempfile.mkdtemp(prefix="evolui-security-", dir="/tmp"))
ENV = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
ENV.update({"PGHOST": str(TEMP), "PGPORT": "55439", "PGUSER": "postgres", "PGDATABASE": "postgres"})
IS_ROOT = os.geteuid() == 0
if IS_ROOT:
    os.chown(TEMP, 1000, 1000)

def drop_privileges():
    os.setgroups([])
    os.setgid(1000)
    os.setuid(1000)

def local(command):
    result = subprocess.run(command, env=ENV, capture_output=True, text=True, preexec_fn=drop_privileges if IS_ROOT else None)
    if result.returncode:
        raise subprocess.CalledProcessError(result.returncode, command, output=result.stdout, stderr=result.stderr)
    return result

def sql(statement):
    return local(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", statement]).stdout.strip()

try:
    local(["initdb", "-D", str(TEMP / "data"), "-U", "postgres", "--auth=trust"])
    local(["pg_ctl", "-D", str(TEMP / "data"), "-l", str(TEMP / "log"), "-o", f"-k {TEMP} -p 55439 -h ''", "-w", "start"])
    for source in [ROOT / "security/tests/fixture.sql", ROOT / "security/migrations/20261022122600_security_hardening.sql"]:
        local(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", str(source)])
    actor = "00000000-0000-0000-0000-000000000001"
    outsider = "00000000-0000-0000-0000-000000000002"
    guest = "00000000-0000-0000-0000-000000000003"
    sql(f"INSERT INTO profiles VALUES('{actor}'),('{outsider}'),('{guest}');")
    org = sql(f"SET ROLE service_role; SELECT hardening_create_org('{actor}', '{{\"razao_social\":\"Fixture\",\"cnpj\":\"12345678000101\",\"plan_code\":\"enterprise\"}}');").splitlines()[-1]
    assert sql(f"SELECT plan_code FROM org_plans WHERE org_id='{org}'") == "free", "Client enterprise must not grant enterprise"
    assert sql(f"SELECT modules::text FROM org_plans WHERE org_id='{org}'") == "{rh}"
    print("PASS safe initial plan and modules")

    def must_fail(statement):
        try:
            sql(statement)
        except subprocess.CalledProcessError:
            return
        raise AssertionError("Unauthorized SQL succeeded")

    must_fail(f"SET ROLE service_role; SELECT hardening_update_plan('{actor}','{org}','enterprise',ARRAY['rh']);")
    print("PASS tenant admin cannot update plan")
    must_fail(f"SET ROLE authenticated; SELECT hardening_create_org('{actor}','{{}}');")
    print("PASS client cannot call service-only RPC")

    sql(f"INSERT INTO org_members(org_id,user_id,role) VALUES('{org}','{outsider}','rh'); INSERT INTO org_invites(org_id,token,email,role,invited_by) VALUES('{org}','bad-admin','guest@example.com','admin','{outsider}');")
    # Regression tests for direct Data API writes: RPC checks alone do not protect table policies.
    must_fail(f"SET ROLE authenticated; SET test.uid='{outsider}'; INSERT INTO user_roles(user_id,role) VALUES('{outsider}','super_admin');")
    must_fail(f"SET ROLE authenticated; SET test.uid='{actor}'; INSERT INTO org_plans(org_id,plan_code,modules,active) VALUES('{org}','enterprise',ARRAY['rh'],true);")
    must_fail(f"SET ROLE authenticated; SET test.uid='{outsider}'; INSERT INTO org_invites(org_id,token,email,role,invited_by) VALUES('{org}','direct-admin','guest@example.com','admin','{outsider}');")
    must_fail(f"SET ROLE authenticated; SET test.uid='{outsider}'; INSERT INTO org_members(org_id,user_id,role) VALUES('{org}','{guest}','admin');")
    print("PASS RLS blocks global role escalation, tenant plan writes, and RH admin grants")
    must_fail(f"SET ROLE service_role; SELECT hardening_accept_invite('{guest}','bad-admin','guest@example.com');")
    assert sql("SELECT accepted_at IS NULL FROM org_invites WHERE token='bad-admin'") == "t"
    print("PASS RH-issued admin invitation denied atomically")
    sql(f"INSERT INTO org_invites(org_id,token,email,role,invited_by) VALUES('{org}','race','guest@example.com','colaborador','{actor}');")
    must_fail(f"SET ROLE service_role; SELECT hardening_accept_invite('{guest}','race','wrong@example.com');")
    must_fail(f"SET ROLE service_role; SELECT hardening_accept_invite('{guest}','race',NULL);")
    print("PASS missing and mismatching invite email")

    def consume(_):
        try:
            sql(f"SET ROLE service_role; SELECT hardening_accept_invite('{guest}','race','guest@example.com');")
            return True
        except subprocess.CalledProcessError:
            return False
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(consume, range(2)))
    assert results.count(True) == 1, "Exactly one concurrent acceptance must succeed"
    assert sql(f"SELECT count(*) FROM org_members WHERE org_id='{org}' AND user_id='{guest}'") == "1"
    print("PASS concurrent invitation consumption")

    # Deliberately injected role-write failure proves the entire accept rolls back.
    sql("CREATE FUNCTION test_fail_role() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER test_fail_role BEFORE INSERT ON user_roles FOR EACH ROW EXECUTE FUNCTION test_fail_role();")
    sql(f"INSERT INTO org_invites(org_id,token,email,role,invited_by) VALUES('{org}','rollback','guest@example.com','rh','{actor}');")
    must_fail(f"SET ROLE service_role; SELECT hardening_accept_invite('{guest}','rollback','guest@example.com');")
    assert sql("SELECT accepted_at IS NULL FROM org_invites WHERE token='rollback'") == "t"
    assert sql(f"SELECT count(*) FROM org_members WHERE org_id='{org}' AND user_id='{guest}' AND role='rh'") == "0"
    must_fail(f"SET ROLE service_role; SELECT hardening_create_org('{actor}','{{\"razao_social\":\"Failure\",\"cnpj\":\"99999999000199\"}}');")
    assert sql("SELECT count(*) FROM orgs WHERE cnpj='99999999000199'") == "0"
    sql("DROP TRIGGER test_fail_role ON user_roles;")
    print("PASS invite and organization rollback on role failure")

    employee = "00000000-0000-0000-0000-000000000020"
    process = "00000000-0000-0000-0000-000000000030"
    other_org = "00000000-0000-0000-0000-000000000040"
    sql(f"INSERT INTO employees VALUES('{employee}','{org}','{guest}',NULL); INSERT INTO role_processes VALUES('{process}','{org}'); INSERT INTO process_weekly_evaluations(org_id,employee_id,evaluator_id,role_process_id,week_start,score) VALUES('{org}','{employee}','{actor}','{process}','2026-10-19',3);")
    # A forged evaluator without membership cannot update a visible row.
    sql(f"ALTER TABLE process_weekly_evaluations DISABLE TRIGGER hardening_pwe_identity; UPDATE process_weekly_evaluations SET evaluator_id='{outsider}'; DELETE FROM org_members WHERE user_id='{outsider}'; ALTER TABLE process_weekly_evaluations ENABLE TRIGGER hardening_pwe_identity;")
    assert sql(f"SET ROLE authenticated; SET test.uid='{outsider}'; WITH changed AS (UPDATE process_weekly_evaluations SET score=5 RETURNING id) SELECT count(*) FROM changed;").splitlines()[-1] == "0"
    sql(f"ALTER TABLE process_weekly_evaluations DISABLE TRIGGER hardening_pwe_identity; UPDATE process_weekly_evaluations SET evaluator_id='{actor}'; ALTER TABLE process_weekly_evaluations ENABLE TRIGGER hardening_pwe_identity;")
    assert sql(f"SET ROLE authenticated; SET test.uid='{actor}'; WITH changed AS (UPDATE process_weekly_evaluations SET score=4 RETURNING id) SELECT count(*) FROM changed;").splitlines()[-1] == "1"
    for assignment in [f"org_id='{other_org}'", f"employee_id='{actor}'", f"evaluator_id='{guest}'"]:
        must_fail(f"SET ROLE authenticated; SET test.uid='{actor}'; UPDATE process_weekly_evaluations SET {assignment};")
    assert sql("SELECT score FROM process_weekly_evaluations") == "4"
    must_fail(f"SET ROLE authenticated; SET test.uid='{actor}'; INSERT INTO process_weekly_evaluations(org_id,employee_id,evaluator_id,role_process_id,week_start,score) VALUES('{other_org}','{employee}','{actor}','{process}','2026-10-26',5);")
    print("PASS pwe_update membership, final identity, and insert relationships")
    print("SQL suite: 10 groups passed; disposable database only")
except subprocess.CalledProcessError as error:
    print(error.stderr)
    raise
finally:
    if (TEMP / "data/postmaster.pid").exists():
        local(["pg_ctl", "-D", str(TEMP / "data"), "-m", "immediate", "-w", "stop"])
    shutil.rmtree(TEMP)