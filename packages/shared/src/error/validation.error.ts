import { HttpStatus } from '../http';
import { DomainError } from './domain.error';

/** Raised when input fails domain/business validation. HTTP 422. */
export class ValidationError extends DomainError {
  readonly statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
}
