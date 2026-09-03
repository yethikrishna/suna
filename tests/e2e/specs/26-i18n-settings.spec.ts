import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { queryDatabaseRows, runDatabaseSql } from "../helpers/database";
import {
  createAuthUser,
  deleteAuthUser,
  installBrowserSessionDirect,
  signIn,
} from "../helpers/session-auth";

const locales = ["de", "it", "zh", "ja", "pt", "fr", "es", "sr", "en"] as const;
type Locale = (typeof locales)[number];

const nativeLocaleNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  zh: "中文",
  ja: "日本語",
  pt: "Português",
  fr: "Français",
  es: "Español",
  sr: "Српски",
};

interface LocaleMessages {
  settings: {
    rail: {
      settings: string;
      backToApp: string;
      groups: Record<string, string>;
      items: Record<string, { label: string; description?: string }>;
    };
    preferences: {
      title: string;
      languageTitle: string;
      keyboardTitle: string;
      modifierKey: string;
      shortcuts: Record<string, string>;
    };
    profile: {
      profilePicture: string;
      email: string;
      name: string;
      organizations: { title: string; manage: string };
      dangerZone: string;
      deleteAccount: string;
    };
    security: {
      twoFactorTitle: string;
      authenticatorApp: string;
      addAuthenticatorApp: string;
      noFactorEnrolled: string;
      devices: string;
      signOutOtherDevices: string;
    };
  };
}

interface AccountRow {
  account_id: string;
}

function messages(locale: Locale): LocaleMessages {
  return JSON.parse(
    readFileSync(
      new URL(`../../../apps/web/translations/${locale}.json`, import.meta.url),
      "utf8",
    ),
  ) as LocaleMessages;
}

async function chooseLocale(page: Page, locale: Locale): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname.endsWith("/auth/v1/user"),
  );

  const combobox = page.getByRole("combobox").first();
  await combobox.click();
  await page
    .getByRole("option", { name: nativeLocaleNames[locale], exact: true })
    .click();

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    user_metadata?: { locale?: string };
  };
  expect(body.user_metadata?.locale).toBe(locale);
}

test.describe("26 — Settings localization", () => {
  test("each supported locale persists and renders the complete language-and-shortcuts surface", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const runId = Date.now().toString(36);
    const email = `e2e-i18n-settings-${runId}@example.test`;
    const password = "E2eI18nSettings123!";
    const supabaseUrl =
      process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
    const authOptions = { supabaseUrl, password };
    const user = await createAuthUser(email, authOptions);
    const session = await signIn(email, authOptions);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    try {
      await installBrowserSessionDirect(
        page,
        session,
        "/settings/preferences",
        authOptions,
      );
      await expect(page.getByRole("combobox").first()).toBeVisible();

      for (const locale of locales) {
        await test.step(`${locale} persists through Supabase and renders every visible settings string`, async () => {
          const copy = messages(locale);
          await chooseLocale(page, locale);

          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(
            page.getByRole("heading", {
              name: copy.settings.rail.settings,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: copy.settings.rail.backToApp }),
          ).toBeVisible();
          await expect(
            page.getByRole("navigation", { name: copy.settings.rail.settings }),
          ).toBeVisible();
          await expect(
            page.getByRole("tab", {
              name: copy.settings.rail.items.preferences.label,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", {
              name: copy.settings.preferences.title,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", {
              name: copy.settings.preferences.languageTitle,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", {
              name: copy.settings.preferences.keyboardTitle,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByText(copy.settings.preferences.modifierKey, {
              exact: true,
            }),
          ).toBeVisible();

          for (const shortcut of Object.values(
            copy.settings.preferences.shortcuts,
          )) {
            await expect(
              page.getByText(shortcut, { exact: true }).first(),
            ).toBeVisible();
          }

          await expect(page.getByRole("combobox").first()).toHaveText(
            nativeLocaleNames[locale],
          );

          await page
            .getByRole("tab", {
              name: copy.settings.rail.items.profile.label,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("heading", {
              name: copy.settings.rail.items.profile.label,
              exact: true,
            }),
          ).toBeVisible();
          for (const profileText of [
            copy.settings.profile.profilePicture,
            copy.settings.profile.email,
            copy.settings.profile.name,
            copy.settings.profile.organizations.title,
            copy.settings.profile.organizations.manage,
            copy.settings.profile.dangerZone,
            copy.settings.profile.deleteAccount,
          ]) {
            await expect(
              page.getByText(profileText, { exact: true }).first(),
            ).toBeVisible();
          }

          await page
            .getByRole("tab", {
              name: copy.settings.rail.items.security.label,
              exact: true,
            })
            .click();
          for (const securityText of [
            copy.settings.security.twoFactorTitle,
            copy.settings.security.authenticatorApp,
            copy.settings.security.addAuthenticatorApp,
            copy.settings.security.noFactorEnrolled,
            copy.settings.security.devices,
            copy.settings.security.signOutOtherDevices,
          ]) {
            await expect(
              page.getByText(securityText, { exact: true }).first(),
            ).toBeVisible();
          }

          await page
            .getByRole("tab", {
              name: copy.settings.rail.items.preferences.label,
              exact: true,
            })
            .click();
          await expect(page.getByRole("combobox").first()).toBeVisible();
        });
      }

      expect(pageErrors).toEqual([]);
    } finally {
      const accounts = await queryDatabaseRows<AccountRow>(
        "select distinct account_id::text from kortix.account_members where user_id = $1::uuid",
        [user.id],
      ).catch(() => []);
      for (const account of accounts) {
        await runDatabaseSql(
          "delete from kortix.accounts where account_id = $1::uuid",
          [account.account_id],
        );
      }
      await deleteAuthUser(user.id, authOptions);
    }
  });
});
