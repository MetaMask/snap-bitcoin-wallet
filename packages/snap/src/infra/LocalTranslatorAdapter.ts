import type { Messages, Translator } from '../entities';

export class LocalTranslatorAdapter implements Translator {
  #messages: Messages;

  #locale: string;

  constructor() {
    this.#locale = '';
    this.#messages = {};
  }

  async load(locale: string): Promise<Messages> {
    if (this.#locale === locale) {
      return this.#messages;
    }

    try {
      this.#messages = (await import(`../../locales/${locale}.json`)).messages;
    } catch (error) {
      this.#messages = (await import(`../../locales/en.json`)).messages;
    }

    this.#locale = locale;
    return this.#messages;
  }
}
