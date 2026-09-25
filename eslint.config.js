import js from '@eslint/js'
import pluginRouter from '@tanstack/eslint-plugin-router'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** Security bans from spec §12. */
const bannedSyntax = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Raw HTML is banned (XSS). Render text.' },
  { selector: "MemberExpression[property.name='innerHTML']", message: 'innerHTML is banned (XSS).' },
  {
    selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
    message: 'sql.raw is banned (injection).',
  },
  { selector: "NewExpression[callee.name='Function']", message: 'new Function is banned.' },
]

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      '.output',
      'dist',
      'coverage',
      'test-results',
      'playwright-report',
      'src/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...pluginRouter.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...bannedSyntax],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use server functions. Only the LLM provider may call fetch.' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Throwing router redirects/notFound is the TanStack idiom.
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'package', package: '@tanstack/router-core', name: ['NotFoundError', 'Redirect'] }] },
      ],
    },
  },
  {
    files: ['src/server/ai/providers/anthropic.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['tests/**', '*.config.{js,ts}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
)
