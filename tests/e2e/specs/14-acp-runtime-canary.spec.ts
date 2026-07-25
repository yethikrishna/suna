import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createApiJsonClient } from "../helpers/http";
import {
  type AuthSession,
  type AuthUser,
  createAuthUser,
  deleteAuthUser,
  installBrowserSession,
  signIn,
} from "../helpers/session-auth";

const enabled = process.env.E2E_ENABLE_ACP_RUNTIME === "1";
const apiBase = process.env.E2E_API_URL || "http://localhost:8008/v1";
const supabaseUrl = process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
const databaseUrl =
  process.env.E2E_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const password = "AcpRuntimeCanary123!";
const api = createApiJsonClient(apiBase);
const authOptions = { supabaseUrl, password };

async function waitForReadySession(
  token: string,
  projectId: string,
  sessionId: string,
  expectedTransport: "acp" | "rest",
): Promise<void> {
  const deadline = Date.now() + 6 * 60_000;
  let last = "";
  while (Date.now() < deadline) {
    const result = await api<{
      stage: string;
      runtime_transport?: "acp" | "rest";
      sandbox?: { status?: string; external_id?: string | null } | null;
    }>(
      token,
      "POST",
      `/projects/${projectId}/sessions/${sessionId}/start?wait_ms=8000`,
      {},
    );
    last = `${result.stage}:${result.sandbox?.status ?? "none"}:${result.runtime_transport}`;
    if (
      result.stage === "ready" &&
      result.sandbox?.status === "active" &&
      result.sandbox.external_id &&
      result.runtime_transport === expectedTransport
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`session did not become ready: ${last}`);
}

test.describe.serial("14 — OpenCode ACP runtime canary", () => {
  test.skip(
    !enabled,
    "Set E2E_ENABLE_ACP_RUNTIME=1 for the real sandbox flow.",
  );
  test.setTimeout(12 * 60_000);

  let user: AuthUser;
  let auth: AuthSession;
  let projectId = "";
  let sessionId = "";

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(12 * 60_000);
    const email = `acp-runtime-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
    user = await createAuthUser(email, authOptions);
    auth = await signIn(email, authOptions);

    const accounts = await api<
      Array<{ account_id: string; personal_account?: boolean }>
    >(auth.access_token, "GET", "/accounts");
    const account =
      accounts.find((item) => item.personal_account) ?? accounts[0];
    expect(account?.account_id).toBeTruthy();
    execFileSync(
      "psql",
      [
        databaseUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `INSERT INTO kortix.credit_accounts (account_id, balance, tier)
         VALUES ('${account.account_id}', 1000, 'tier_2_20')
         ON CONFLICT (account_id)
         DO UPDATE SET balance = 1000, tier = 'tier_2_20'`,
      ],
      { stdio: "ignore" },
    );

    const project = await api<{ project_id: string }>(
      auth.access_token,
      "POST",
      "/projects/provision",
      {
        account_id: account.account_id,
        name: `ACP runtime E2E ${Date.now()}`,
        seed_starter: true,
      },
      201,
    );
    projectId = project.project_id;
    await api(auth.access_token, "PATCH", `/projects/${projectId}/onboarding`, {
      completed: true,
    });
    await api(
      auth.access_token,
      "PATCH",
      `/projects/${projectId}/experimental`,
      { feature: "acp_runtime", enabled: true },
    );
    const session = await api<{ session_id: string }>(
      auth.access_token,
      "POST",
      `/projects/${projectId}/sessions`,
      {
        name: "ACP browser canary",
        opencode_model: "kortix/claude-sonnet-4.6",
      },
      201,
    );
    sessionId = session.session_id;
    await waitForReadySession(auth.access_token, projectId, sessionId, "acp");
  });

  test.afterAll(async ({}, testInfo) => {
    testInfo.setTimeout(2 * 60_000);
    if (projectId && sessionId) {
      await api(
        auth.access_token,
        "DELETE",
        `/projects/${projectId}/sessions/${sessionId}`,
      ).catch(() => {});
    }
    if (projectId) {
      await api(auth.access_token, "DELETE", `/projects/${projectId}`).catch(
        () => {},
      );
    }
    if (user?.id) {
      await deleteAuthUser(user.id, {
        supabaseUrl,
        envFiles: ["apps/api/.env", "apps/web/.env"],
      });
    }
  });

  test("routes ACP first and preserves the REST rollback", async ({ page }) => {
    const acpPromptRequests: string[] = [];
    const restPromptRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      if (
        request.url().includes("/kortix/acp/") &&
        request.postData()?.includes('"method":"session/prompt"')
      ) {
        acpPromptRequests.push(request.url());
      }
      if (request.url().includes("/prompt_async")) {
        restPromptRequests.push(request.url());
      }
    });

    await installBrowserSession(
      page,
      auth,
      `/projects/${projectId}/sessions/${sessionId}`,
      password,
    );
    const input = page.getByRole("textbox", { name: "Message input" });
    await expect(input).toBeVisible({ timeout: 120_000 });
    const welcomeCard = page.getByRole("complementary", {
      name: /Welcome from Marko/i,
    });
    await welcomeCard
      .getByRole("button", { name: "Dismiss" })
      .click({ timeout: 10_000 })
      .catch(() => {});
    await expect(welcomeCard).toBeHidden({ timeout: 10_000 });
    await input.fill("Reply with exactly: ACP_PONG");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText("ACP_PONG", { exact: true }).last(),
    ).toBeVisible({
      timeout: 120_000,
    });
    expect(acpPromptRequests).toHaveLength(1);
    expect(restPromptRequests).toHaveLength(0);

    await api(
      auth.access_token,
      "PATCH",
      `/projects/${projectId}/experimental`,
      { feature: "acp_runtime", enabled: false },
    );
    await waitForReadySession(auth.access_token, projectId, sessionId, "rest");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(input).toBeVisible({ timeout: 120_000 });
    await input.fill("Reply with exactly: REST_PONG");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText("REST_PONG", { exact: true }).last(),
    ).toBeVisible({
      timeout: 120_000,
    });
    expect(restPromptRequests).toHaveLength(1);
  });
});
