import { createMemo, lazy, onSettled, Show } from "solid-js";
import type { ApplicationContext } from "../../app/context.ts";
import { t } from "../../lib/reactive/i18n.ts";
import { projectOwner } from "../../lib/reactive/projection.ts";
import { ChatImportBoundary } from "../chat/components/chat-import-boundary.tsx";
import { clawCreatorFlow } from "./creator-flow.ts";
import "../../styles/claw-creator.css";

const ClawReviewDialog = lazy(() => import("./creator-review-dialog.tsx"), {
  export: "ClawReviewDialog",
});

export function ClawCreatorReview(props: { context: ApplicationContext }) {
  const current = createMemo(() => {
    const flow = clawCreatorFlow(props.context);
    return { flow, view: projectOwner(flow, (owner) => owner) };
  });
  const flow = () => current().flow;
  const view = () => current().view;
  onSettled(() => {
    const context = props.context;
    const owner = clawCreatorFlow(context);
    const pathname = context.router.getState().location.pathname;
    return context.router.subscribe(() => {
      if (context.router.getState().location.pathname !== pathname) {
        owner.retirePresentation();
      }
    });
  });
  return (
    <>
      <Show when={view().read().modalOpen && view().read().review}>
        <ChatImportBoundary
          identity={[props.context]}
          fallback={() => null}
          subtitle={t("clawsDraft.reviewTitle")}
        >
          <ClawReviewDialog flow={flow()} view={view()} />
        </ChatImportBoundary>
      </Show>
      <Show
        when={
          view().read().hasActiveDraft &&
          !view().read().modalOpen &&
          !view().read().publication &&
          view().read().error
        }
      >
        {(error) => (
          <div class="claw-creator__notice claw-creator__notice--error" role="alert">
            {error()}
            <button class="btn btn--sm" onClick={() => flow().retryReview()}>
              {t("clawsDraft.retryReview")}
            </button>
          </div>
        )}
      </Show>
      <Show
        when={
          view().read().review &&
          !view().read().modalOpen &&
          !view().read().publication &&
          !view().read().error
        }
      >
        <button class="claw-creator__reopen btn btn--sm" onClick={() => flow().reopen()}>
          {t("clawsDraft.reopen")}
        </button>
      </Show>
    </>
  );
}
