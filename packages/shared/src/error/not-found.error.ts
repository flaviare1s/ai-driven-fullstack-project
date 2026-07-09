import { HttpStatus } from '../http';
import { DomainError } from './domain.error';

/** Raised when a requested resource does not exist. HTTP 404. */
export class NotFoundError extends DomainError {
  readonly statusCode = HttpStatus.NOT_FOUND;
}
