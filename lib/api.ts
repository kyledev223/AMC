import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ConfigError } from "./env";
import { requireDb } from "./db";

/** An error whose message is safe and useful to show the user. */
export class UserError extends Error {
  readonly name = "UserError";
  constructor(message: string, readonly status = 400, readonly code = "bad_request") {
    super(message);
  }
}

export function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Turns any thrown value into a JSON response without leaking internals. */
export function handleError(err: unknown, where: string) {
  if (err instanceof UserError) return jsonError(err.message, err.status, err.code);
  if (err instanceof ZodError) return jsonError(err.issues[0]?.message ?? "Invalid request", 400, "invalid_request");
  if (err instanceof ConfigError) {
    console.error(`[${where}] config:`, err.message);
    return jsonError("Minting isn't open yet. Try again later.", 503, "not_configured");
  }
  console.error(`[${where}]`, err instanceof Error ? `${err.name}: ${err.message}` : err);
  return jsonError("Something went wrong on our side. Nothing was charged unless your wallet shows a confirmed transaction. Try again in a minute.", 500, "internal");
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new UserError("The request body must be JSON", 400, "invalid_json");
  }
  return schema.parse(body);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Constant-time comparison of a provided secret against the configured one. */
export function secretMatches(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Reads a secret from `Authorization: Bearer <secret>` or the named header. */
export function bearerOrHeader(req: Request, header: string): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.headers.get(header);
}

/**
 * Fixed-window rate limit stored in Postgres so it holds across serverless instances.
 * Throws a 429 UserError when the limit is hit.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const db = requireDb();
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const row = await db.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.windowStart.getTime() !== windowStart.getTime()) {
      return tx.rateLimit.upsert({ where: { key }, create: { key, windowStart, count: 1 }, update: { windowStart, count: 1 } });
    }
    return tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  });
  if (row.count > limit) {
    const retry = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000);
    throw new UserError(`Too many requests. Wait ${retry} seconds and try again.`, 429, "rate_limited");
  }
}
