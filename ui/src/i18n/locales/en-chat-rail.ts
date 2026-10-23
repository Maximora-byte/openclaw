import type { TranslationMap } from "../lib/types.ts";
import { en } from "./en.ts";

// Panel copy loads only with its optional rendering consumers.
const enChatRail = {
  chat: {
    rail: {
      title: "Side chat",
      subtitle: "Ask about this session or its project",
      expand: "Expand side chat",
      collapse: en.chat.rail.collapse,
      close: "Close side chat",
      show: en.chat.rail.show,
      clear: en.chat.rail.clear,
      pullRequests: "Pull requests",
      checksPassing: "{count} passed",
      checksFailing: "{count} failed",
      checksPending: "{count} running",
      finished: "Finished {time}",
      empty: "Answers come from this session's transcript and its project files.",
      askLabel: "Ask in side chat",
      askPlaceholder: "Ask a question",
      askImageQuestion: "What does this image show?",
      selectionTooLong: en.chat.rail.selectionTooLong,
      askSubmit: "Ask",
      askBusy: "Side chat is already answering a question.",
      askHistoryUnavailable: "Couldn't load this session's history.",
      askMissing: "This session is no longer available.",
      askModelUnavailable: "No utility model is configured for this session.",
      askImageUnsupported:
        "This Side chat model cannot read images. Choose an image-capable model, then retry.",
      askRateLimited: "Side chat reached its question limit. Try again shortly.",
      askUnavailable: "Side chat cannot answer right now.",
      askRetry: "Retry",
      health: {
        "on-track": "On track",
        grinding: "Working",
        stuck: "Stuck",
        "waiting-on-user": "Waiting on you",
        "wrapping-up": "Wrapping up",
        done: "Done",
        failed: "Failed",
      },
    },
  },
} satisfies TranslationMap;

export const registerChatRailEnglish = Object.assign(
  () => {
    Object.assign(en.chat.rail, enChatRail.chat.rail);
  },
  { catalog: enChatRail },
);
