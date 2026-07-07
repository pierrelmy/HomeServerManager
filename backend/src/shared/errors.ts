export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code: string) {
    super(message)
  }
}

export const badRequest = (message: string) => new HttpError(400, message, "BAD_REQUEST")
export const notFound = (message: string) => new HttpError(404, message, "NOT_FOUND")
export const conflict = (message: string) => new HttpError(409, message, "CONFLICT")
export const forbidden = (message = "Administrator access is required") => new HttpError(403, message, "FORBIDDEN")
export const unauthorized = (message = "Authentication is required") => new HttpError(401, message, "UNAUTHORIZED")
