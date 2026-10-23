/* @vitest-environment jsdom */
import { expect, it } from "vitest";
import { flattenTranslations } from "../../../scripts/lib/control-ui-i18n-sync-plan.ts";
import { useLazyEnglishTest } from "./lazy-english.test-support.ts";

const loadI18n = useLazyEnglishTest();

it("loads optional panel copy on first use and preserves shared namespaces", async () => {
  const { en, manager } = await loadI18n();
  const { registerChatSessionEnglish } = await import("./locales/en-chat-session.ts");
  registerChatSessionEnglish();
  const details = en.chat.sessionDetails;
  const diff = en.chat.sessionDiff;
  const files = en.chat.workspaceFiles;
  const desktopFiles = files.desktop;
  const rail = en.chat.rail;
  const terminal = en.terminal;
  const config = en.configView;
  expect(manager.t("chat.sessionDetails.title")).toBe("Details");
  expect(manager.t("chat.sessionDetails.progressHidden")).toBe(
    "Task progress hidden in this browser.",
  );
  expect(manager.t("chat.sessionDiff.show")).toBe("Show session changes");
  expect(manager.t("chat.workspaceFiles.desktop.sessionFiles")).toBe("Session files");
  expect(manager.t("chat.rail.selectionTooLong")).toBe(
    "These comments are too long for Side chat. Use a shorter selection or comment.",
  );
  expect(manager.t("terminal.open")).toBe("Open terminal");
  expect(manager.t("configView.adminRequired")).toBe(
    "Configuration changes require operator.admin access.",
  );

  await manager.setLocale("de");
  for (const { key, load, catalog } of [
    {
      key: "chat.sessionDetails.contextEstimate",
      load: () => import("../pages/chat/components/chat-details-context.tsx"),
      catalog: async () =>
        (await import("./locales/en-chat-details.ts")).registerChatDetailsEnglish.catalog,
    },
    {
      key: "chat.sessionDiff.copyCommand",
      load: () => import("../pages/chat/components/session-diff-copy.tsx"),
      catalog: async () =>
        (await import("./locales/en-chat-diff.ts")).registerChatDiffEnglish.catalog,
    },
    {
      key: "chat.workspaceFiles.desktop.filePath",
      load: () => import("../pages/chat/components/chat-session-workspace-breadcrumb.tsx"),
      catalog: async () =>
        (await import("./locales/en-chat-files.ts")).registerChatFilesEnglish.catalog,
    },
    {
      key: "chat.rail.askSubmit",
      load: () => import("../pages/chat/components/chat-session-rail-composer.tsx"),
      catalog: async () =>
        (await import("./locales/en-chat-rail.ts")).registerChatRailEnglish.catalog,
    },
    {
      key: "terminal.uploadTooLarge",
      load: () => import("../components/terminal/terminal-file-upload.ts"),
      catalog: async () =>
        (await import("./locales/en-terminal.ts")).registerTerminalEnglish.catalog,
    },
    {
      key: "configView.autoSaveSaved",
      load: () => import("../components/settings-save-indicator.tsx"),
      catalog: async () =>
        (await import("./locales/en-settings.ts")).registerSettingsEnglish.catalog,
    },
  ]) {
    expect(manager.t(key)).toBe(key);
    await load();
    for (const [catalogKey, value] of flattenTranslations(await catalog())) {
      expect(manager.t(catalogKey)).toBe(value);
    }
  }
  // Broad chat consumers can register after the optional panels have loaded.
  registerChatSessionEnglish();
  expect(manager.t("chat.workspaceFiles.desktop.filePath")).toBe("File path");
  expect(manager.t("common.health")).toBe("Gesundheit");
  expect(en.chat.sessionDetails).toBe(details);
  expect(en.chat.sessionDiff).toBe(diff);
  expect(en.chat.workspaceFiles).toBe(files);
  expect(en.chat.workspaceFiles.desktop).toBe(desktopFiles);
  expect(en.chat.rail).toBe(rail);
  expect(en.terminal).toBe(terminal);
  expect(en.configView).toBe(config);
});
