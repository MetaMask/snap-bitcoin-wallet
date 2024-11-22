/* eslint-disable no-restricted-globals */
import { getUserLocale } from './locale';

jest.mock('../../locales/en.json', () => ({
  messages: { greeting: { message: 'Hello' } },
}));

describe('getUserLocale', () => {
  it("should return the locale messages for the user's preferred locale", async () => {
    (global as any).snap = {
      request: jest.fn().mockResolvedValue({ locale: 'en' }),
    };

    const locale = await getUserLocale();
    expect(locale).toStrictEqual({ greeting: { message: 'Hello' } });
  });

  it("should return the default locale messages if the user's preferred locale is not available", async () => {
    (global as any).snap = {
      request: jest.fn().mockRejectedValue(new Error('Locale not found')),
    };

    const locale = await getUserLocale();
    expect(locale).toStrictEqual({ greeting: { message: 'Hello' } });
  });
});
