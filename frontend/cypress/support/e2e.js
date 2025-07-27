// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests from command log
const origLog = Cypress.log
Cypress.log = function (opts, ...other) {
  if (opts.displayName === 'fetch' || opts.displayName === 'xhr') {
    return
  }
  return origLog(opts, ...other)
}

// Custom error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing the test on uncaught exceptions
  // that are not critical to the test
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  return true
})
