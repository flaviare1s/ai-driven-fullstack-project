/**
 * HTTP status codes shared across the whole monorepo (frontend + backend +
 * business modules). Kept framework-agnostic on purpose: this package is
 * consumed by React (Next.js) and by NestJS, so it must never depend on either.
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusName = keyof typeof HttpStatus;
export type HttpStatusCode = (typeof HttpStatus)[HttpStatusName];
