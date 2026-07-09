import { HttpStatus } from '../http';

/**
 * Base class for every application domain error. Extends the native JavaScript
 * `Error` and carries an HTTP `statusCode` (defaulting to 500 / Internal Server
 * Error). Subclasses override `statusCode` according to the kind of error they
 * represent.
 */
export class DomainError extends Error {
  readonly statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;

  constructor(message: string) {
    super(message);
    // Use the concrete subclass name (e.g. "NotFoundError") in stack traces.
    this.name = this.constructor.name;
    // Restore the prototype chain so `instanceof` keeps working even when this
    // code is transpiled/bundled down to older targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
