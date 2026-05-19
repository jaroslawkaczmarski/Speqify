import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ApiError } from "@speqify/shared";

/** Stable error codes surfaced to clients. */
export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "session_unavailable"
  | "internal_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  // 423 Locked — the resource exists but the review window is not currently open.
  session_unavailable: 423,
  internal_error: 500,
};

/** Throw to abort a request with the standard error envelope. */
export class ApiException extends HTTPException {
  constructor(
    readonly code: ErrorCode,
    readonly detail: string,
  ) {
    super(STATUS[code] as 400, { message: detail });
  }
}

export function errorEnvelope(code: ErrorCode, message: string, correlationId: string): ApiError {
  return { error: { code, message, correlationId } };
}

export function fail(c: Context, code: ErrorCode, message: string): Response {
  const correlationId = String(c.get("correlationId") ?? "");
  return c.json(errorEnvelope(code, message, correlationId), STATUS[code] as 400);
}
