import { Type } from "typebox";
import { expect, it, vi } from "vitest";
import { toToolDefinitions } from "../agents/agent-tool-definition-adapter.js";
import { wrapToolDefinition } from "../agents/sessions/tools/tool-definition-wrapper.js";
import { createZeroUsageFixture } from "../agents/test-helpers/usage-fixtures.js";
import { decodePostgresError } from "../infra/postgres-sync/protocol.js";
import { SqliteWorkerError } from "../infra/sqlite-worker-contract.js";
import { createAssistantMessageEventStream } from "../llm/utils/event-stream.js";
import { Agent, type AgentEvent } from "./agent-core.js";

it.each([
  {
    name: "unknown outcome",
    failure: new SqliteWorkerError("Synthetic unacknowledged write", "outcome-unknown"),
    local: true,
  },
  {
    name: "database cancellation",
    failure: decodePostgresError({
      name: "error",
      code: "57014",
      message: "Synthetic cancellation",
    }),
    local: true,
  },
  {
    name: "primary disk failure with uncertain cleanup",
    failure: (() => {
      const primary = Object.assign(new Error("Synthetic disk failure"), { code: "SQLITE_FULL" });
      return new AggregateError(
        [primary, new SqliteWorkerError("Synthetic unconfirmed cleanup", "outcome-unknown")],
        "Synthetic operation and cleanup failure",
        { cause: primary },
      );
    })(),
    local: true,
  },
  { name: "ordinary tool failure", failure: new Error("Synthetic tool failure"), local: false },
  {
    name: "ordinary SQLite tool contention",
    failure: Object.assign(new Error("Synthetic plugin database contention"), {
      code: "SQLITE_BUSY",
    }),
    local: false,
  },
  {
    name: "ordinary AbortError tool failure",
    failure: Object.assign(new Error("Synthetic tool abort"), { name: "AbortError" }),
    local: false,
  },
])("settles accepted tools before reporting $name", async ({ failure, local }) => {
  const siblingStarted = Promise.withResolvers<void>();
  const failureThrown = Promise.withResolvers<void>();
  const releaseSibling = Promise.withResolvers<void>();
  let siblingSettled = false;
  let requests = 0;
  const agent = new Agent({
    initialState: {
      tools: toToolDefinitions([
        {
          name: "failing",
          label: "Failing tool",
          description: "Synthetic failure",
          parameters: Type.Object({}),
          async execute() {
            await siblingStarted.promise;
            failureThrown.resolve();
            throw failure;
          },
        },
        {
          name: "sibling",
          label: "Sibling tool",
          description: "Synthetic accepted work",
          parameters: Type.Object({}),
          async execute() {
            siblingStarted.resolve();
            await releaseSibling.promise;
            siblingSettled = true;
            return { content: [{ type: "text", text: "Completed" }], details: {} };
          },
        },
      ]).map((definition) => wrapToolDefinition(definition)),
    },
    streamFn: (model) => {
      const first = requests++ === 0;
      const output = createAssistantMessageEventStream();
      const message = {
        role: "assistant" as const,
        api: model.api,
        provider: model.provider,
        model: model.id,
        content: first
          ? [
              { type: "toolCall" as const, id: "fail", name: "failing", arguments: {} },
              { type: "toolCall" as const, id: "hold", name: "sibling", arguments: {} },
            ]
          : [{ type: "text" as const, text: "Continued" }],
        stopReason: first ? ("toolUse" as const) : ("stop" as const),
        timestamp: 0,
        usage: createZeroUsageFixture(),
      };
      output.push({ type: "done", reason: message.stopReason, message });
      output.end();
      return output;
    },
  });
  const events: AgentEvent[] = [];
  agent.subscribe((event) => {
    events.push(event);
  });
  const pending = agent.prompt("Run the synthetic tools");
  void pending.catch(() => {});
  try {
    await failureThrown.promise;
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(agent.state.isStreaming).toBe(true);
    expect(siblingSettled).toBe(false);
  } finally {
    releaseSibling.resolve();
    await pending.catch(() => {});
  }
  if (local) {
    await expect(pending).rejects.toBe(failure);
  } else {
    await expect(pending).resolves.toBeUndefined();
  }
  expect(siblingSettled).toBe(true);
  expect(agent.state.isStreaming).toBe(false);
  expect(requests).toBe(local ? 1 : 2);
  expect(
    events.some(
      (event) =>
        event.type === "message_end" &&
        event.message.role === "toolResult" &&
        event.message.toolCallId === "hold",
    ),
  ).toBe(true);
});

it("preserves ordinary caller abort behavior", async () => {
  const reason = Object.assign(new Error("Synthetic user cancellation"), { name: "AbortError" });
  const agent = new Agent({
    streamFn: vi.fn(() => {
      throw new Error("Unexpected provider request");
    }),
  });
  agent.subscribe((event) => {
    if (event.type === "turn_start") {
      agent.abort(reason);
    }
  });
  await expect(agent.prompt("Synthetic cancelled turn")).resolves.toBeUndefined();
  expect(agent.state.isStreaming).toBe(false);
  expect(agent.state.messages).toContainEqual(
    expect.objectContaining({
      role: "assistant",
      stopReason: "aborted",
    }),
  );
});

it.each([
  new SqliteWorkerError("Synthetic unacknowledged write", "outcome-unknown"),
  decodePostgresError({ name: "error", code: "57014", message: "Synthetic cancellation" }),
])("retains local database failures through the agent loop", async (failure) => {
  const agent = new Agent({
    transformContext: async () => {
      throw failure;
    },
    streamFn: vi.fn(() => {
      throw new Error("Unexpected provider request");
    }),
  });
  const events: AgentEvent[] = [];
  agent.subscribe((event) => {
    events.push(event);
  });
  await expect(agent.prompt("Synthetic turn")).rejects.toBe(failure);
  expect(agent.state.isStreaming).toBe(false);
  expect(
    events.some((event) => event.type === "message_end" && event.message.role === "assistant"),
  ).toBe(false);
});

it.each(["before-provider", "after-provider-abort"] as const)(
  "retains a local abort reason %s",
  async (phase) => {
    const failure = new SqliteWorkerError("Synthetic lost connection", "outcome-unknown");
    const agent: Agent = new Agent({
      streamFn: () => {
        const stream = createAssistantMessageEventStream();
        const model = agent.state.model;
        const message = {
          role: "assistant" as const,
          content: [],
          api: model.api,
          provider: model.provider,
          model: model.id,
          stopReason: "aborted" as const,
          timestamp: Date.now(),
          usage: createZeroUsageFixture(),
        };
        stream.push({ type: "error", reason: "aborted", error: message });
        stream.end();
        return stream;
      },
    });
    agent.subscribe((event) => {
      if (
        (phase === "before-provider" && event.type === "turn_start") ||
        (phase === "after-provider-abort" &&
          event.type === "message_end" &&
          event.message.role === "assistant")
      ) {
        agent.abort(failure);
      }
    });
    await expect(agent.prompt("Synthetic abort")).rejects.toBe(failure);
    expect(agent.state.isStreaming).toBe(false);
  },
);
