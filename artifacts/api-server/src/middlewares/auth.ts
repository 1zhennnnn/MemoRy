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

function parseJwtPayload(token: string): { sub?: string; email?: string } {
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString()) as {
      sub?: string;
      email?: string;
    };
  } catch {
    return {};
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
    const secret = process.env.SUPABASE_JWT_SECRET;

    let sub: string | undefined;
    let email: string | undefined;

    if (secret) {
      try {
        const { payload } = await jose.jwtVerify(
          token,
          new TextEncoder().encode(secret),
        );
        sub = payload.sub;
        email = typeof payload["email"] === "string" ? payload["email"] : undefined;
      } catch (verifyErr) {
        req.log.warn({ err: verifyErr }, "JWT verification failed");
        throw new AppError("Invalid token", ERROR_CODES.UNAUTHORIZED, 401);
      }
    } else {
      // parse-only mode for development
      const payload = parseJwtPayload(token);
      sub = payload.sub;
      email = payload.email;
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
