import { ping } from '../src/index';

describe('module', () => {
  it('deve responder com pong', () => {
    expect(ping()).toBe('pong');
  });
});
