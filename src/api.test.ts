import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareRoutes, formatErrorDetail, streamSearch } from "./api";
import { searchPayloadFixture, stepFixture } from "./test/fixtures";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  emit(type: string, event: Event) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe("API diagnostics", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports HTTP status when an error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => "<html><body>Bad gateway</body></html>",
    } as Response));

    await expect(compareRoutes({
      start: "a",
      goal: "b",
      criterion: "balanced",
      traffic_profile: "normal",
    })).rejects.toThrow("HTTP 502 Bad Gateway: Bad gateway");
  });

  it("preserves validation locations and messages", () => {
    expect(formatErrorDetail([
      { loc: ["body", "algorithm"], msg: "Input should be dijkstra or greedy" },
    ], "Invalid request")).toBe("algorithm: Input should be dijkstra or greedy");
  });

  it("delivers search steps before the terminal payload", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const onStep = vi.fn();
    const pending = streamSearch({
      start: "a",
      goal: "b",
      algorithm: "dijkstra",
      criterion: "balanced",
      traffic_profile: "normal",
    }, onStep, { timeoutMs: 10_000 });
    const socket = MockWebSocket.instances[0];
    socket.readyState = MockWebSocket.OPEN;
    socket.emit("open", new Event("open"));
    socket.emit("message", new MessageEvent("message", {
      data: JSON.stringify({ type: "step", step: stepFixture }),
    }));

    expect(onStep).toHaveBeenCalledWith(stepFixture);

    const payload = searchPayloadFixture();
    socket.emit("message", new MessageEvent("message", {
      data: JSON.stringify({ type: "complete", payload }),
    }));
    await expect(pending).resolves.toEqual(payload);
  });

  it("rejects and closes after a malformed WebSocket message", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const pending = streamSearch({
      start: "a",
      goal: "b",
      algorithm: "dijkstra",
      criterion: "balanced",
      traffic_profile: "normal",
    }, vi.fn(), { timeoutMs: 10_000 });
    const socket = MockWebSocket.instances[0];
    socket.readyState = MockWebSocket.OPEN;
    socket.emit("message", new MessageEvent("message", { data: "{malformed-json" }));

    await expect(pending).rejects.toThrow("malformed WebSocket message");
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });
});
