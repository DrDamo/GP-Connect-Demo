import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'server/dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Context modules export their provider and its hook together.
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
        allowExportNames: ['useAuth', 'useOnboarding', 'useGuideNav', 'useDomainWarnings'],
      }],
      // The remaining setState-in-effect sites sync state from a prop or an
      // async result. They cost an extra render, not correctness, so they are
      // reported without failing lint until each is reworked.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
