import type {
  Bootstrap,
  ComparePayload,
  MultiPayload,
  SearchPayload,
  SearchRequest,
  SearchStep,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const DEFAULT_STREAM_TIMEOUT_MS = 30_000;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : null;

export function formatErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail.trim();

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        const record = asRecord(item);
        if (!record) return typeof item === "string" ? item : null;
        const location = Array.isArray(record.loc)
          ? record.loc.filter((part) => part !== "body").map(String).join(".")
          : "";
        const message = typeof record.msg === "string"
          ? record.msg
          : typeof record.message === "string" ? record.message : "";
        if (!message) return null;
        return location ? `${location}: ${message}` : message;
      })
      .filter((item): item is string => Boolean(item));
    if (messages.length) return messages.join("; ");
  }

  const record = asRecord(detail);
  if (record) {
    if (typeof record.message === "string") return record.message;
    if (typeof record.msg === "string") return record.msg;
  }
  return fallback;
}

const responseSnippet = (raw: string) => raw
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 180);

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const raw = await response.text();
  let body: unknown = null;

  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      if (response.ok) {
        throw new Error(`Invalid JSON response from ${path}.`);
      }
    }
  }

  if (!response.ok) {
    const record = asRecord(body);
    const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    const fallback = responseSnippet(raw);
    const detail = formatErrorDetail(record?.detail, fallback || "Request failed");
    throw new Error(`${status}: ${detail}`);
  }
  return body as T;
}

export function fetchBootstrap(): Promise<Bootstrap> {
  return requestJson<Bootstrap>("/api/bootstrap");
}

export function fetchNetwork(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/network");
}

export function compareRoutes(
  request: Omit<SearchRequest, "algorithm">,
  signal?: AbortSignal,
): Promise<ComparePayload> {
  return requestJson<ComparePayload>("/api/compare", {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  });
}

export function optimizeMultiRoute(
  request: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<MultiPayload> {
  return requestJson<MultiPayload>("/api/multi-route", {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  });
}

interface StreamOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function streamSearch(
  request: SearchRequest,
  onStep: (step: SearchStep) => void,
  options: StreamOptions = {},
): Promise<SearchPayload> {
  return new Promise((resolve, reject) => {
    const explicitBase = API_BASE || window.location.origin;
    const websocketBase = explicitBase.replace(/^http/, "ws");
    const socket = new WebSocket(`${websocketBase}/ws/search`);
    const timeoutMs = options.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", handleAbort);
    };
    const closeSocket = () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
      closeSocket();
    };
    const finish = (payload: SearchPayload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
      closeSocket();
    };
    function handleAbort() {
      fail(new DOMException("Search cancelled.", "AbortError"));
    }

    const timeout = window.setTimeout(() => {
      fail(new Error(`Search timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    if (options.signal?.aborted) {
      handleAbort();
      return;
    }
    options.signal?.addEventListener("abort", handleAbort, { once: true });

    socket.addEventListener("open", () => {
      if (!settled) socket.send(JSON.stringify({ ...request, capture_trace: false }));
    });
    socket.addEventListener("message", (event) => {
      if (settled) return;
      let message: Record<string, unknown>;
      try {
        const parsed = JSON.parse(String(event.data));
        const record = asRecord(parsed);
        if (!record || typeof record.type !== "string") throw new Error("Invalid message shape");
        message = record;
      } catch {
        fail(new Error("Backend sent a malformed WebSocket message."));
        return;
      }

      if (message.type === "step") {
        const step = asRecord(message.step);
        if (!step) {
          fail(new Error("Backend sent an invalid search step."));
          return;
        }
        onStep(message.step as SearchStep);
      } else if (message.type === "complete") {
        const payload = asRecord(message.payload);
        if (!payload) {
          fail(new Error("Backend completed without a valid route payload."));
          return;
        }
        finish(message.payload as SearchPayload);
      } else if (message.type === "error") {
        fail(new Error(formatErrorDetail(message.detail, "Invalid request")));
      }
    });
    socket.addEventListener("error", () => {
      fail(new Error("Could not connect to the backend WebSocket."));
    });
    socket.addEventListener("close", () => {
      if (!settled) fail(new Error("The search connection closed before completion."));
    });
  });
}
