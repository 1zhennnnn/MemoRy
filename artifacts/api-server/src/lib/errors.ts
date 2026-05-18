import type { Request, Response, NextFunction } from "express";

export const ERROR_CODES = {
  UNAUTHORIZED:  "UNAUTHORIZED",
  FORBIDDEN:     "FORBIDDEN",
  NOT_FOUND:     "NOT_FOUND",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_INPUT: "INVALID_INPUT",
  CONFLICT:      "CONFLICT",
  AI_ERROR:      "AI_ERROR",
  INTERNAL:      "INTERNAL",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  constructor(
    public override message: string,
    public code: ErrorCode | string,
    public status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }
  req.log.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
}
