import { HttpStatus, isDefined } from '../src/index';

describe('shared', () => {
  it('exposes shared HTTP status codes', () => {
    expect(HttpStatus.OK).toBe(200);
    expect(HttpStatus.NOT_FOUND).toBe(404);
    expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
  });

  it('narrows defined values with isDefined', () => {
    expect([1, null, 2, undefined].filter(isDefined)).toEqual([1, 2]);
  });
});
