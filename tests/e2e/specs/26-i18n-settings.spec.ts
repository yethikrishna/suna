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
    appearance: {
      theme: string;
      conversationDensity: string;
      wallpaper: string;
      defaultWallpaper: string;
      themes: Record<string, string>;
      densities: Record<string, { label: string }>;
      wallpapers: Record<string, string>;
    };
    sessions: {
      notifications: string;
      enableNotifications: string;
      notificationTypes: string;
      behavior: string;
      sendTestNotification: string;
      types: Record<string, { label: string; description: string }>;
      notificationBehavior: Record<
        string,
        { label: string; description: string }
      >;
      sounds: string;
      soundPacks: Record<string, { label: string; description: string }>;
      volume: string;
      soundEvents: Record<string, { label: string; description: string }>;
    };
    connected: {
      github: string;
      install: string;
      connect: string;
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
      const appOrigin = new URL(
        process.env.E2E_BASE_URL || "http://localhost:3000",
      ).origin;
      await page.context().grantPermissions(["notifications"], {
        origin: appOrigin,
      });
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
              name: copy.settings.rail.items.appearance.label,
              exact: true,
            })
            .click();
          for (const appearanceText of [
            copy.settings.appearance.theme,
            copy.settings.appearance.conversationDensity,
            copy.settings.appearance.wallpaper,
            copy.settings.appearance.defaultWallpaper,
            ...Object.values(copy.settings.appearance.themes),
            ...Object.values(copy.settings.appearance.densities).map(
              (density) => density.label,
            ),
          ]) {
            await expect(
              page.getByText(appearanceText, { exact: true }).first(),
            ).toBeVisible();
          }
          for (const [wallpaperId, wallpaperName] of Object.entries(
            copy.settings.appearance.wallpapers,
          )) {
            await expect(
              page.getByRole("button", {
                name:
                  wallpaperId === "dither"
                    ? `${wallpaperName} ${copy.settings.appearance.defaultWallpaper}`
                    : wallpaperName,
                exact: true,
              }),
            ).toBeVisible();
          }

          await page
            .getByRole("tab", {
              name: copy.settings.rail.items.sessions.label,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("heading", {
              name: copy.settings.sessions.notifications,
              exact: true,
            }),
          ).toBeVisible();
          const notificationSwitch = page.getByRole("switch", {
            name: copy.settings.sessions.enableNotifications,
            exact: true,
          });
          if (!(await notificationSwitch.isChecked())) {
            await notificationSwitch.click();
          }
          await expect(notificationSwitch).toBeChecked();
          for (const notificationText of [
            copy.settings.sessions.notificationTypes,
            copy.settings.sessions.behavior,
            copy.settings.sessions.sendTestNotification,
            ...Object.values(copy.settings.sessions.types).flatMap((item) => [
              item.label,
              item.description,
            ]),
            ...Object.values(
              copy.settings.sessions.notificationBehavior,
            ).flatMap((item) => [item.label, item.description]),
          ]) {
            await expect(
              page.getByText(notificationText, { exact: true }).first(),
            ).toBeVisible();
          }
          await expect(
            page.getByRole("heading", {
              name: copy.settings.sessions.sounds,
              exact: true,
            }),
          ).toBeVisible();
          const defaultPack = copy.settings.sessions.soundPacks.opencode;
          await page
            .getByRole("radio", {
              name: `${defaultPack.label} ${defaultPack.description}`,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("slider", {
              name: copy.settings.sessions.volume,
              exact: true,
            }),
          ).toBeVisible();
          for (const eventCopy of Object.values(
            copy.settings.sessions.soundEvents,
          )) {
            await expect(
              page.getByText(eventCopy.label, { exact: true }).first(),
            ).toBeVisible();
            await expect(
              page.getByText(eventCopy.description, { exact: true }).first(),
            ).toBeVisible();
          }

          await page
            .getByRole("tab", {
              name: copy.settings.rail.items.connected.label,
              exact: true,
            })
            .click();
          for (const connectedText of [
            copy.settings.connected.github,
            copy.settings.connected.install,
          ]) {
            await expect(
              page.getByText(connectedText, { exact: true }).first(),
            ).toBeVisible();
          }
          await expect(
            page.getByRole("button", {
              name: `Github ${copy.settings.connected.connect}`,
              exact: true,
            }),
          ).toBeVisible();

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
