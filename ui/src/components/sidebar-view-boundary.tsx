import { Errored, Loading, Repeat, type ParentProps } from "solid-js";
import { t } from "../lib/reactive/i18n.ts";

/** The fixed sidebar shell stays mounted while an optional view loads. */
export function SidebarViewBoundary(
  props: ParentProps<{ fallback?: import("@solidjs/web").JSX.Element }>,
) {
  return (
    <Errored
      fallback={(_error, reset) => (
        <div class="sidebar-view-loading sidebar-session-error callout danger" role="alert">
          <span>{t("lazyView.errorTitle")}</span>
          <button class="btn btn--sm" type="button" onClick={reset}>
            {t("common.retry")}
          </button>
        </div>
      )}
    >
      <Loading
        fallback={
          props.fallback ?? (
            <div
              class="sidebar-view-loading sidebar-recent-sessions__list"
              role="status"
              aria-label={t("common.loading")}
              aria-busy="true"
            >
              <Repeat count={4}>
                {() => (
                  <span
                    class="sidebar-session-tree__loading skeleton skeleton-line"
                    aria-hidden="true"
                  />
                )}
              </Repeat>
            </div>
          )
        }
      >
        {props.children}
      </Loading>
    </Errored>
  );
}
