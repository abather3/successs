module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    
    // Standard React/TypeScript rules
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    'prefer-const': 'warn',
    
    // Security-related rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-script-url': 'error',
    
    // Code quality rules
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // Rules to prevent common React mistakes
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    
    // Accessibility rules
    'jsx-a11y/alt-text': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      rules: {
        // TypeScript specific rules
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        
      }
    }
  ],
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  }
};
