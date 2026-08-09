import type {
  Bootstrap,
  ComparePayload,
  MultiPayload,
  SearchPayload,
  SearchRequest,
  SearchStep,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}

export function fetchBootstrap(): Promise<Bootstrap> {
  return requestJson<Bootstrap>("/api/bootstrap");
}

export function fetchNetwork(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/api/network");
}

export function compareRoutes(request: Omit<SearchRequest, "algorithm">): Promise<ComparePayload> {
  return requestJson<ComparePayload>("/api/compare", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function optimizeMultiRoute(request: Record<string, unknown>): Promise<MultiPayload> {
  return requestJson<MultiPayload>("/api/multi-route", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function streamSearch(
  request: SearchRequest,
  onStep: (step: SearchStep) => void,
): Promise<SearchPayload> {
  return new Promise((resolve, reject) => {
    const explicitBase = API_BASE || window.location.origin;
    const websocketBase = explicitBase.replace(/^http/, "ws");
    const socket = new WebSocket(`${websocketBase}/ws/search`);
    let settled = false;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ ...request, capture_trace: false }));
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "step") onStep(message.step as SearchStep);
      if (message.type === "complete") {
        settled = true;
        resolve(message.payload as SearchPayload);
        socket.close();
      }
      if (message.type === "error") {
        settled = true;
        reject(new Error(typeof message.detail === "string" ? message.detail : "Invalid request"));
        socket.close();
      }
    });
    socket.addEventListener("error", () => {
      if (!settled) reject(new Error("Không thể kết nối WebSocket tới backend."));
    });
    socket.addEventListener("close", () => {
      if (!settled) reject(new Error("Kết nối tìm đường đã đóng trước khi hoàn tất."));
    });
  });
}
