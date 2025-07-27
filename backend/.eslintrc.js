module.exports = {
  languageOptions: {
    globals: {
      process: 'readonly',
      console: 'readonly',
      __dirname: 'readonly',
      require: 'readonly',
      module: 'readonly',
      exports: 'readonly',
      Buffer: 'readonly',
      setTimeout: 'readonly',
      setInterval: 'readonly',
      clearTimeout: 'readonly',
      clearInterval: 'readonly'
    },
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  plugins: {
    security: require('eslint-plugin-security')
  },
  rules: {
    ...require('eslint-plugin-security').configs.recommended.rules,
    // Add custom security rules
    'security/detect-sql-injection': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error'
  }
};

