import { describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";
import { requireOrgAccess, requireSuperAdmin, requireInvitePermission, requireInviteIdentity, requireInterviewAccess } from "../../src/lib/security-access";

const USER = "00000000-0000-0000-0000-000000000001";
const ORG = "00000000-0000-0000-0000-000000000010";
interface Fixture { readonly role?: string; readonly superAdmin?: boolean; readonly interviewOrg?: string; readonly conductor?: string; readonly manager?: boolean; readonly failed?: boolean }
function client(fixture: Fixture) {
  return createClient<Database>("https://fixture.invalid", "fixture", { auth: { persistSession: false }, global: { fetch: async (input) => {
    const url = new URL(String(input));
    if (fixture.failed) return new Response(JSON.stringify({ message: "unavailable" }), { status: 500 });
    const table = url.pathname.split("/").pop();
    let body: unknown = [];
    if (table === "user_roles") body = fixture.superAdmin ? [{ role: "super_admin" }] : [];
    if (table === "org_members") body = fixture.role && url.searchParams.get("org_id") === `eq.${ORG}` ? [{ role: fixture.role }] : [];
    if (table === "interviews") body = { org_id: fixture.interviewOrg ?? ORG, employee_id: USER, conducted_by: fixture.conductor ?? "other" };
    if (table === "is_manager_of_emp") body = fixture.manager ?? false;
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  } } });
}

describe("server authorization", () => {
  test("entitlements deny cross-org even for RH", async () => {
    await expect(requireOrgAccess(client({ role: "rh" }), USER, "other-org")).rejects.toThrow();
  });
  test("entitlements allow every existing same-org membership role", async () => {
    for (const role of ["admin", "rh", "gestor", "supervisor", "colaborador", "auditor"]) await requireOrgAccess(client({ role }), USER, ORG);
  });
  test("authorization fails closed on database errors", async () => {
    await expect(requireOrgAccess(client({ failed: true }), USER, ORG)).rejects.toThrow();
  });
  test("tenant admin cannot grant enterprise", async () => {
    await expect(requireSuperAdmin(client({ role: "admin" }), USER)).rejects.toThrow();
  });
  test("super admin can use trusted plan flow", async () => {
    await requireSuperAdmin(client({ superAdmin: true }), USER);
  });
  test("RH cannot invite an admin", async () => {
    await expect(requireInvitePermission(client({ role: "rh" }), USER, ORG, "admin")).rejects.toThrow();
  });
  test("RH can invite employee and admin can invite admin", async () => {
    await requireInvitePermission(client({ role: "rh" }), USER, ORG, "colaborador");
    await requireInvitePermission(client({ role: "admin" }), USER, ORG, "admin");
  });
  test("invite identity requires authenticated email", () => {
    expect(() => requireInviteIdentity(undefined, "confirmed", {})).toThrow();
  });
  test("invite identity rejects mismatching email", () => {
    expect(() => requireInviteIdentity("one@example.com", "confirmed", {}, "two@example.com")).toThrow();
  });
  test("invite identity requires confirmation and supported verified claim", () => {
    expect(() => requireInviteIdentity("one@example.com", undefined, {})).toThrow();
    expect(() => requireInviteIdentity("one@example.com", "confirmed", { email_verified: false })).toThrow();
  });
  test("invite identity normalizes and matches exactly", () => {
    expect(requireInviteIdentity(" One@Example.com ", "confirmed", { email_verified: true }, "one@example.com")).toBe("one@example.com");
  });
  test("global RH does not authorize another org interview", async () => {
    await expect(requireInterviewAccess(client({ role: "rh", interviewOrg: "other-org" }), USER, "interview")).rejects.toThrow();
  });
  test("cross-org conductor is denied", async () => {
    await expect(requireInterviewAccess(client({ conductor: USER, interviewOrg: "other-org" }), USER, "interview")).rejects.toThrow();
  });
  test("same-org RH conductor and manager authorized", async () => {
    for (const fixture of [{ role: "rh" }, { role: "gestor", conductor: USER }, { role: "gestor", manager: true }]) await requireInterviewAccess(client(fixture), USER, "interview");
  });
  test("unrelated same-org employee cannot analyze", async () => {
    await expect(requireInterviewAccess(client({ role: "colaborador" }), USER, "interview")).rejects.toThrow();
  });
});