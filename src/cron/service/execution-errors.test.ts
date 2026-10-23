import { expect, it } from "vitest";
import { SqliteWorkerError } from "../../infra/sqlite-worker-contract.js";
import { normalizeCronRunErrorText } from "./execution-errors.js";

it("renders uncertain cron writes with the shared recovery guidance", () => {
  const primary = new SqliteWorkerError("PRIVATE_DATABASE_DETAIL", "outcome-unknown");
  const error = new AggregateError(
    [primary, new Error("PRIVATE_CLEANUP_DETAIL")],
    "PRIVATE_AGGREGATE",
    {
      cause: primary,
    },
  );
  const text = normalizeCronRunErrorText(error);
  expect(text).toMatch(/confirm|saved/i);
  expect(text).toMatch(/check|reopen|retry/i);
  expect(text).not.toContain("PRIVATE_");
});
