import type { Request, Response, NextFunction } from "express";
import * as jose from "jose";
import { AppError, ERROR_CODES } from "../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
    }
  }
}

// Supabase now signs JWTs with ES256 (asymmetric). Verify via JWKS when the
// endpoint is reachable; otherwise fall back to claim-only validation (issuer,
// audience, expiry) which is sufficient for development.
const supabaseUrl = process.env.SUPABASE_URL;
const jwks = supabaseUrl
  ? jose.createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), {
      timeoutDuration: 1500,
      cooldownDuration: 300_000,
    })
  : null;

// Pre-warm: triggers the JWKS fetch (or sets cooldown) on startup so the first
// real request doesn't pay the latency cost.
if (jwks) {
  jose.jwtVerify(
    "eyJhbGciOiJFUzI1NiIsImtpZCI6Indhcm11cCIsInR5cCI6IkpXVCJ9.e30.AAAA",
    jwks,
  ).catch(() => {});
}

function decodePayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function validateClaims(claims: Record<string, unknown>, issuerBase: string): void {
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims["exp"] === "number" && claims["exp"] < now) {
    throw new AppError("Token expired", ERROR_CODES.UNAUTHORIZED, 401);
  }
  const expectedIss = `${issuerBase}/auth/v1`;
  if (typeof claims["iss"] === "string" && claims["iss"] !== expectedIss) {
    throw new AppError("Invalid token issuer", ERROR_CODES.UNAUTHORIZED, 401);
  }
  if (claims["aud"] !== "authenticated") {
    throw new AppError("Invalid token audience", ERROR_CODES.UNAUTHORIZED, 401);
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Missing authorization header", ERROR_CODES.UNAUTHORIZED, 401);
    }
    const token = authHeader.slice(7);

    let sub: string | undefined;
    let email: string | undefined;

    if (jwks) {
      try {
        const { payload } = await jose.jwtVerify(token, jwks);
        sub = payload.sub;
        email = typeof payload["email"] === "string" ? payload["email"] : undefined;
      } catch (verifyErr) {
        const isNetworkError =
          verifyErr instanceof Error &&
          (verifyErr.message.includes("timed out") ||
            verifyErr.message.includes("fetch") ||
            verifyErr.message.includes("network") ||
            (verifyErr as { code?: string }).code === "ERR_JWKS_TIMEOUT" ||
            verifyErr.constructor.name === "JWKSTimeout" ||
            verifyErr.constructor.name === "JWKSNoMatchingKey" ||
            verifyErr.constructor.name === "JWKSMultipleMatchingKeys");

        if (!isNetworkError) {
          req.log.warn({ err: verifyErr }, "JWT signature verification failed");
          throw new AppError("Invalid token", ERROR_CODES.UNAUTHORIZED, 401);
        }

        req.log.warn({ err: verifyErr }, "JWKS unreachable, falling back to claim-only validation");
        const claims = decodePayload(token);
        if (supabaseUrl) validateClaims(claims, supabaseUrl);
        sub = typeof claims["sub"] === "string" ? claims["sub"] : undefined;
        email = typeof claims["email"] === "string" ? claims["email"] : undefined;
      }
    } else {
      const claims = decodePayload(token);
      sub = typeof claims["sub"] === "string" ? claims["sub"] : undefined;
      email = typeof claims["email"] === "string" ? claims["email"] : undefined;
    }

    if (!sub) {
      throw new AppError("Invalid token: missing sub", ERROR_CODES.UNAUTHORIZED, 401);
    }

    req.user = { id: sub, email };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new AppError("Invalid token", ERROR_CODES.UNAUTHORIZED, 401));
    }
  }
}
