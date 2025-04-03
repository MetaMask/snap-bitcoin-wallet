export type Messages = Record<string, { message: string }>;

/**
 * A Translator.
 */
export type Translator = {
  /**
   * Load messages given a locale. Defaults to english if the locale is not found.
   * @param locale - the locale.
   */
  load(locale: string): Promise<Messages>;
};
