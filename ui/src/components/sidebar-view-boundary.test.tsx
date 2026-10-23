/* @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import * as recovery from "../app/stale-chunk-reload.ts";
import { mountSolid } from "../test-helpers/mount-solid.ts";
import { waitForSolid } from "../test-helpers/solid-settle.ts";
import { SidebarViewBoundary } from "./sidebar-view-boundary.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

function failedSidebarView(error: Error) {
  let failure: Error | undefined = error;
  const Content = () => {
    if (failure) {
      throw failure;
    }
    return <span>Sidebar recovered</span>;
  };
  const mounted = mountSolid(() => (
    <SidebarViewBoundary>
      <Content />
    </SidebarViewBoundary>
  ));
  return { ...mounted, recover: () => (failure = undefined) };
}

it("retries an ordinary sidebar failure without reloading the document", async () => {
  const reload = vi.spyOn(recovery, "retryStaleChunkReloadWhenReachable");
  const view = failedSidebarView(new Error("Temporary sidebar failure"));
  await waitForSolid(() => expect(view.getByRole("button", { name: "Retry" })).toBeDefined());
  view.recover();
  view.getByRole("button", { name: "Retry" }).click();
  await waitForSolid(() => expect(view.container.textContent).toContain("Sidebar recovered"));
  expect(reload).not.toHaveBeenCalled();
});

it("offers document recovery when a sidebar chunk is stale", async () => {
  const reload = vi.spyOn(recovery, "retryStaleChunkReloadWhenReachable").mockResolvedValue(true);
  const view = failedSidebarView(new TypeError("Failed to fetch dynamically imported module"));
  await waitForSolid(() => expect(view.getByRole("button", { name: "Reload" })).toBeDefined());
  view.getByRole("button", { name: "Reload" }).click();
  expect(reload).toHaveBeenCalledOnce();
});
