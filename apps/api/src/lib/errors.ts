export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = "Avtorizatsiya talab qilinadi", code = "UNAUTHORIZED") => new AppError(401, code, message);
export const forbidden = (message = "Ruxsat yo'q", code = "FORBIDDEN") => new AppError(403, code, message);
export const notFound = (message = "Topilmadi", code = "NOT_FOUND") => new AppError(404, code, message);
export const conflict = (message: string, code = "CONFLICT") => new AppError(409, code, message);
export const tooMany = (message: string, details?: unknown) => new AppError(429, "TOO_MANY", message, details);
