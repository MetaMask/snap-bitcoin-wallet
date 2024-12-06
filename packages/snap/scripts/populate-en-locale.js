const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const messages = require('../messages.json');

console.log('[populate-en-locale] - attempt to populate en locale');

const englishLocale = {
  locale: 'en',
  messages: Object.entries(messages).reduce((acc, [key, { message }]) => {
    acc[key] = { message };
    return acc;
  }, {}),
};

// Write en locale file
try {
  writeFileSync(
    join(__dirname, '../locales/en.json'),
    JSON.stringify(englishLocale, null, 2),
  );
  console.log('[populate-en-locale] - en locale populated');
} catch (error) {
  console.error('Error writing en locale file', error);
  throw error;
}
