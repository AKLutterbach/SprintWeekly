module.exports = {
  root: true,
  parser: 'espree', // Use default parser for JS/JSX files
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  env: {
    node: true,
    jest: true,
    es2020: true
  },
  ignorePatterns: ['dist/', 'node_modules/'],
  extends: [
    'eslint:recommended'
  ],
  overrides: [
    {
      // Use TypeScript parser only for TypeScript files
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ],
  rules: {
    // project-specific adjustments
    'no-console': 'off'
  }
};
