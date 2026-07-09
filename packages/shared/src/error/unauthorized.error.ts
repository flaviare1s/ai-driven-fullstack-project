import { HttpStatus } from '../http';
import { DomainError } from './domain.error';

/** Raised when authentication is missing or invalid. HTTP 401. */
export class UnauthorizedError extends DomainError {
  readonly statusCode = HttpStatus.UNAUTHORIZED;
}
