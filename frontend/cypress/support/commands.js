// Example commands.js

Cypress.Commands.add('loginAsAdmin', () => {
  cy.viewport(1280, 720)
  cy.visit('/login')
  cy.get('input[name="email"]').type(Cypress.env('adminEmail'))
  cy.get('input[name="password"]').type(Cypress.env('adminPassword'))
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard')
})

Cypress.Commands.add('loginAsCashier', () => {
  cy.viewport(1280, 720)
  cy.visit('/login')
  cy.get('input[name="email"]').type(Cypress.env('cashierEmail'))
  cy.get('input[name="password"]').type(Cypress.env('cashierPassword'))
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard')
})

Cypress.Commands.add('loginAsSales', () => {
  cy.viewport(1280, 720)
  cy.visit('/login')
  cy.get('input[name="email"]').type(Cypress.env('salesEmail'))
  cy.get('input[name="password"]').type(Cypress.env('salesPassword'))
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard')
})

// Add more custom Cypress commands and overwrite existing commands here.
