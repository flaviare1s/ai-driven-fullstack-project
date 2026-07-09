/**
 * Shared, framework-agnostic contracts used by both the frontend and the
 * backend (and by the business modules in `modules/*`).
 */

/** Standard envelope for successful API responses. */
export interface ApiResponse<TData> {
  data: TData;
  message?: string;
}

/** Standard shape for API error payloads. */
export interface ApiError {
  statusCode: number;
  message: string;
}

/** Narrow away `null` and `undefined` (handy in `.filter(isDefined)`). */
export function isDefined<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}
