import { Reflector } from '@nestjs/core';
import {
  RateLimit,
  RATE_LIMIT_KEY,
  RATE_LIMIT_WINDOW_KEY,
} from './rate-limit.decorator';

class Controller {
  @RateLimit(5, 60_000)
  strict() {}

  @RateLimit(30)
  defaultWindow() {}
}

describe('@RateLimit', () => {
  const reflector = new Reflector();

  it('attaches both the limit and the window', () => {
    // The original implementation combined the two SetMetadata calls with
    // `&&`, which returned only the second. The limit never reached the
    // handler, so RateLimitGuard fell back to its default of 100 and every
    // annotated route was effectively unlimited at the number written.
    expect(reflector.get(RATE_LIMIT_KEY, Controller.prototype.strict)).toBe(5);
    expect(
      reflector.get(RATE_LIMIT_WINDOW_KEY, Controller.prototype.strict),
    ).toBe(60_000);
  });

  it('defaults the window to one minute', () => {
    expect(
      reflector.get(RATE_LIMIT_KEY, Controller.prototype.defaultWindow),
    ).toBe(30);
    expect(
      reflector.get(RATE_LIMIT_WINDOW_KEY, Controller.prototype.defaultWindow),
    ).toBe(60_000);
  });
});
