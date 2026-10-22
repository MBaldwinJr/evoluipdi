import { describe, expect, mock, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";

interface Context {
  readonly supabase: ReturnType<typeof createClient<Database>>;
  readonly userId: string;
  readonly claims: Record<string, unknown>;
}
type Handler = (input: { data: Record<string, unknown>; context: Context }) => Promise<unknown>;
// Exercise the actual handlers without RPC transport, hosted auth, or production mutations.
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: Handler) => handler,
    };
    return builder;
  },
}));
mock.module("../../src/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
let rpcFailure = false;
mock.module("../../src/lib/hardening-rpc.server", () => ({
  hardeningRpcClient: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { data: ORG, error: rpcFailure ? { message: "role insert failed" } : null };
    },
  },
  assertRpcSuccess: (error: unknown) => {
    if (error) throw new Error("Operation failed");
  },
}));
const { orgGetEntitlements, orgCreateFromCnpj, orgUpdatePlan } =
  await import("../../src/lib/org.functions");
const { inviteCreate, inviteAccept } = await import("../../src/lib/invites.functions");
const USER = "00000000-0000-0000-0000-000000000001";
const ORG = "00000000-0000-0000-0000-000000000010";
interface Fixture {
  readonly role?: string;
  readonly superAdmin?: boolean;
  readonly email?: string;
  readonly inviteEmail?: string;
}
function setup(fixture: Fixture) {
  const reads: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  const supabase = createClient<Database>("https://fixture.invalid", "fixture", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const table = new URL(String(input)).pathname.split("/").pop() ?? "";
        reads.push(table);
        if (init?.method === "POST" && table === "org_invites")
          writes.push(JSON.parse(String(init.body)));
        const bodies: Record<string, unknown> = {
          user_roles: fixture.superAdmin ? [{ role: "super_admin" }] : [],
          org_members: fixture.role ? [{ role: fixture.role }] : [],
          org_plans: [{ plan_code: "free", modules: ["rh"], limits: {}, valid_to: null }],
          org_invites: { email: fixture.inviteEmail ?? "one@example.com", role: "rh", org_id: ORG },
        };
        return new Response(JSON.stringify(bodies[table] ?? []), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  supabase.auth.getUser = async () => ({
    data: {
      user: {
        id: USER,
        email: fixture.email,
        email_confirmed_at: "2026-01-01",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-01-01",
      },
    },
    error: null,
  });
  return { reads, writes, context: { supabase, userId: USER, claims: {} } };
}
async function run(handler: unknown, context: Context, data: Record<string, unknown>) {
  if (typeof handler !== "function") throw new Error("Handler not callable");
  return handler({ context, data });
}

describe("P0 handler regressions", () => {
  test("cross-org entitlement denial happens before org_plans read", async () => {
    const fixture = setup({});
    await expect(run(orgGetEntitlements, fixture.context, { org_id: ORG })).rejects.toThrow();
    expect(fixture.reads.includes("org_plans")).toBe(false);
  });
  test("super-admin and same-org RH can read entitlements", async () => {
    for (const permissions of [{ superAdmin: true }, { role: "rh" }]) {
      const fixture = setup(permissions);
      await expect(
        run(orgGetEntitlements, fixture.context, { org_id: ORG }),
      ).resolves.toMatchObject({ plan_code: "free" });
      expect(fixture.reads.includes("org_plans")).toBe(true);
    }
  });
  test("paid plan and forged Receita facts never reach creation RPC", async () => {
    const previousFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ razao_social: "Server-verified company" }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    try {
      rpcCalls.length = 0;
      rpcFailure = false;
      await run(orgCreateFromCnpj, setup({}).context, {
        cnpj: "12345678000101",
        timezone: "America/Sao_Paulo",
        plan_code: "enterprise",
        payload: { razao_social: "Forged company" },
      });
      expect(requests[0]).toBe("https://brasilapi.com.br/api/cnpj/v1/12345678000101");
      expect(rpcCalls[0]).toEqual({
        name: "hardening_create_org",
        args: {
          actor_id: USER,
          company: {
            razao_social: "Server-verified company",
            cnpj: "12345678000101",
            timezone: "America/Sao_Paulo",
          },
        },
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
  test("org admin and RH cannot invoke plan mutation for any paid plan", async () => {
    rpcCalls.length = 0;
    for (const role of ["admin", "rh"])
      for (const plan_code of ["starter", "pro", "enterprise"]) {
        await expect(
          run(orgUpdatePlan, setup({ role }).context, { org_id: ORG, plan_code }),
        ).rejects.toThrow();
      }
    expect(rpcCalls).toHaveLength(0);
  });
  test("RH cannot insert admin invite but can insert normalized RH invite", async () => {
    const fixture = setup({ role: "rh" });
    await expect(
      run(inviteCreate, fixture.context, { org_id: ORG, role: "admin", email: "one@example.com" }),
    ).rejects.toThrow();
    expect(fixture.writes).toHaveLength(0);
    await run(inviteCreate, fixture.context, {
      org_id: ORG,
      role: "rh",
      email: " One@Example.com ",
    });
    expect(fixture.writes[0]).toMatchObject({ email: "one@example.com", role: "rh" });
  });
  test("missing and mismatching authenticated email never consume invite", async () => {
    rpcCalls.length = 0;
    for (const email of [undefined, "other@example.com"])
      await expect(
        run(inviteAccept, setup({ email }).context, { token: "token" }),
      ).rejects.toThrow();
    expect(rpcCalls).toHaveLength(0);
  });
  test("role-write transaction error propagates instead of false success", async () => {
    rpcFailure = true;
    try {
      await expect(
        run(inviteAccept, setup({ email: "one@example.com" }).context, { token: "token" }),
      ).rejects.toThrow("Operation failed");
    } finally {
      rpcFailure = false;
    }
  });
});
