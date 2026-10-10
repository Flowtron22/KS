const readonly = names => Object.fromEntries(names.map(name => [name, 'readonly']));

export default [
  {
    files: ['src/**/*.js', 'tests/**/*.mjs', 'tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: readonly(['structuredClone']) },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error',
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: readonly(['document', 'window', 'localStorage', 'fetch', 'Worker', 'URL', 'Blob', 'setTimeout', 'clearTimeout', 'crypto', 'matchMedia', 'self', 'navigator', 'File']),
    },
  },
  {
    files: ['tests/**/*.mjs', 'tools/**/*.mjs'],
    languageOptions: { globals: readonly(['process', 'console', 'URL', 'fetch', 'Buffer', 'setTimeout']) },
  },
];
