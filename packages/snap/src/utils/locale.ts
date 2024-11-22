export type Locale = Record<
  string,
  {
    message: string;
  }
>;

/**
 * Retrieves the user's locale preferences.
 *
 * @returns A promise that resolves to the user's locale messages.
 */
export async function getUserLocale(): Promise<Locale> {
  try {
    const { locale } = await snap.request({ method: 'snap_getPreferences' });
    return (await import(`../../locales/${locale}.json`)).messages;
  } catch {
    return (await import(`../../locales/en.json`)).messages;
  }
}
