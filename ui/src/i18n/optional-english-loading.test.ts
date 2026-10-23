/* @vitest-environment jsdom */
import { expect, it } from "vitest";
import { flattenTranslations } from "../../../scripts/lib/control-ui-i18n-sync-plan.ts";
import { useLazyEnglishTest } from "./lazy-english.test-support.ts";

const loadI18n = useLazyEnglishTest();

it.each([
  {
    surface: "page headers",
    load: () => import("../components/solid/hub-page-header.tsx"),
  },
  {
    surface: "command palette search",
    load: () => import("../components/command-palette-catalog-search.ts"),
  },
  {
    surface: "settings search",
    load: () => import("../pages/config/settings-targets.ts"),
  },
])("loads route descriptions for $surface on first use", async ({ load }) => {
  const { en, manager } = await loadI18n({
    common: { health: "Gesundheit" },
    subtitles: { cron: "Geplante Aufgaben" },
  });
  const translate = (key: string) => manager.t(key);
  const subtitles = en.subtitles;
  const { titleForRoute, subtitleForRoute } = await import("../app-navigation.ts");
  expect(titleForRoute("chat")).toBe("Chat");
  expect(subtitleForRoute("skills", translate)).toBe("subtitles.skills");

  await manager.setLocale("de");
  await load();

  expect(subtitleForRoute("skills", translate)).toBe("Manage your agent skills");
  expect(subtitleForRoute("cron", translate)).toBe("Geplante Aufgaben");
  expect(manager.t("common.health")).toBe("Gesundheit");
  expect(en.subtitles).toBe(subtitles);
});

it("loads optional English copy at each view boundary while keeping shared labels eager", async () => {
  const { en, manager } = await loadI18n();
  const about = en.aboutPage;
  const dashboards = en.dashboardsPage;
  expect(manager.t("aboutPage.artifactDetails")).toBe("Control UI build details");
  expect(manager.t("aboutPage.copiedCommit")).toBe("Commit hash copied");
  await manager.setLocale("de");
  for (const { key, load, catalog } of [
    {
      key: "aboutPage.tagline",
      load: () => import("../pages/about/view.tsx"),
      catalog: async () => (await import("./locales/en-about.ts")).registerAboutEnglish.catalog,
    },
    {
      key: "dashboardsPage.emptyDescription",
      load: () => import("../pages/dashboards/view.tsx"),
      catalog: async () =>
        (await import("./locales/en-dashboards.ts")).registerDashboardsEnglish.catalog,
    },
  ]) {
    expect(manager.t(key)).toBe(key);
    await load();
    for (const [catalogKey, value] of flattenTranslations(await catalog())) {
      expect(manager.t(catalogKey)).toBe(value);
    }
    expect(manager.t("common.health")).toBe("Gesundheit");
    expect(en.aboutPage).toBe(about);
    expect(en.dashboardsPage).toBe(dashboards);
  }
});
