import type { TranslationMap } from "../lib/types.ts";
import { en } from "./en.ts";

// Panel copy loads only with its optional rendering consumers.
const enChatFiles = {
  chat: {
    workspaceFiles: {
      attachments: "Attachments",
      attachmentsLoading: "Loading transcript attachments…",
      attachmentsUnknown: "Transcript attachment coverage is not yet known.",
      attachmentsPartial:
        "Showing attachments available in the loaded transcript. Earlier or omitted content may contain more.",
      mobile: {
        searchFolder: "Search in {folder}",
        empty: "No files match this view.",
        unavailable: "Workspace files are unavailable.",
        disconnected: "Gateway is disconnected.",
      },
      desktop: {
        sessionFiles: en.chat.workspaceFiles.desktop.sessionFiles,
        project: "Project",
        closeSearch: "Close file search",
        filePath: "File path",
        hiddenFolders: "Show hidden folders",
      },
      label: "Session workspace",
      collapse: en.chat.workspaceFiles.collapse,
      showFiles: en.chat.workspaceFiles.showFiles,
      dockRight: "Dock to the right",
      dockBottom: "Dock to the bottom",
      workspace: "Session",
      files: "Workspace",
      refresh: "Refresh session workspace",
      loading: "Loading session workspace…",
      changed: "Changed",
      read: "Read",
      artifacts: en.chat.workspaceFiles.artifacts,
      browser: "Project files",
      root: en.chat.workspaceFiles.root,
      search: "Search files",
      searchResults: "Search results",
      parentFolder: "Parent folder",
      noBrowserFiles: "No files in this folder.",
      folderUnavailable: "This folder is unavailable. Open its parent folder to continue browsing.",
      noSearchResults: "No matching files.",
      truncated: "Showing the first matching files. Refine the search to narrow results.",
      session: "Session",
      missing: "Missing",
      filterAll: "All",
      filters: "Filter files",
      changedCount: "{count} changed",
      readCount: "{count} read",
      artifactCount: "{count} artifacts",
      actions: "Workspace file actions",
      preview: "Preview",
      copyPath: en.chat.workspaceFiles.copyPath,
    },
  },
} satisfies TranslationMap;

export const registerChatFilesEnglish = Object.assign(
  () => {
    const { desktop, ...files } = enChatFiles.chat.workspaceFiles;
    Object.assign(en.chat.workspaceFiles, files);
    Object.assign(en.chat.workspaceFiles.desktop, desktop);
  },
  { catalog: enChatFiles },
);
