import {
  DomainError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../src/index';

describe('domain errors', () => {
  it('DomainError extends the native Error and defaults to status code 500', () => {
    const error = new DomainError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('DomainError');
    expect(error.message).toBe('boom');
    expect(error.statusCode).toBe(500);
  });

  it('ValidationError overrides the status code with 422', () => {
    const error = new ValidationError('invalid');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('ValidationError');
    expect(error.statusCode).toBe(422);
  });

  it('NotFoundError overrides the status code with 404', () => {
    const error = new NotFoundError('missing');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
  });

  it('UnauthorizedError overrides the status code with 401', () => {
    const error = new UnauthorizedError('nope');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('UnauthorizedError');
    expect(error.statusCode).toBe(401);
  });
});
