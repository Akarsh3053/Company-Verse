// ─────────────────────────────────────────────────────────────────────────────
// Backend API client (frontend.md §4).
//
// Base URL from NEXT_PUBLIC_API_BASE_URL (default http://127.0.0.1:8000).
// `POST /game/bundle` runs a 60–90s AI pipeline, so the bundle call uses a long
// (≥120s) timeout. All calls surface typed errors for the UI's retry handling.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ChatRequest,
  ChatResponse,
  GameBundle,
  UserPersona,
} from "@/types/bundle";
import { parseBundle } from "@/schema/bundle";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

/** How long to wait for the headline bundle call (the AI pipeline is slow). */
export const BUNDLE_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  readonly status: number;
  /** True for network failures / aborts (no HTTP status). */
  readonly isNetwork: boolean;

  constructor(message: string, status: number, isNetwork = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

/** A friendly, user-facing description of an error for retry screens. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) {
      return "Couldn't reach the backend. Is it running at " + API_BASE_URL + "?";
    }
    switch (error.status) {
      case 503:
        return "The knowledge service isn't ready yet (backend misconfigured). Try again.";
      case 501:
        return "This provider isn't implemented on the backend. Check its configuration.";
      case 404:
        return "Not found. That game or NPC doesn't exist.";
      default:
        return error.message || `Request failed (HTTP ${error.status}).`;
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Chain an externally-provided signal (e.g. component unmount) into ours.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      aborted ? "The request timed out." : "Network request failed.",
      0,
      true,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data?.detail) {
        detail =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail);
      }
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Generate a new game bundle for a persona. The headline call — slow (60–90s).
 * Validates the response at the boundary; throws on invalid shapes.
 */
export async function createBundle(
  persona: UserPersona,
  signal?: AbortSignal,
): Promise<GameBundle> {
  const raw = await request<unknown>("/game/bundle", {
    method: "POST",
    body: persona,
    timeoutMs: BUNDLE_TIMEOUT_MS,
    signal,
  });
  return validate(raw);
}

/** Resume a previously generated bundle. Returns instantly server-side. */
export async function getBundle(
  userKey: string,
  signal?: AbortSignal,
): Promise<GameBundle> {
  const raw = await request<unknown>(
    `/game/bundle/${encodeURIComponent(userKey)}`,
    { signal },
  );
  return validate(raw);
}

/** List existing bundle keys (for a "Continue" menu). */
export async function listBundles(signal?: AbortSignal): Promise<string[]> {
  return request<string[]>("/game/bundles", { signal });
}

/** Free-form, grounded chat with one of a bundle's NPCs. */
export async function chat(
  payload: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  return request<ChatResponse>("/game/chat", {
    method: "POST",
    body: payload,
    timeoutMs: 60_000,
    signal,
  });
}

function validate(raw: unknown): GameBundle {
  const result = parseBundle(raw);
  if (!result.success || !result.data) {
    const detail = (result.issues ?? []).join("; ");
    throw new ApiError(
      `The backend returned an invalid game bundle. ${detail}`,
      0,
    );
  }
  return result.data as GameBundle;
}
