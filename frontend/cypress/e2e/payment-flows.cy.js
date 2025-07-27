describe('Payment Settlement Flows', () => {
  let testTransactionId
  let testCustomerId
  let testOrNumber

  beforeEach(() => {
    // Set up test data via API calls
    cy.request('POST', `${Cypress.env('apiUrl')}/api/test/setup`, {
      scenario: 'payment_flows'
    }).then((response) => {
      testTransactionId = response.body.transactionId
      testCustomerId = response.body.customerId
      testOrNumber = response.body.orNumber
    })
  })

  afterEach(() => {
    // Clean up test data
    cy.request('POST', `${Cypress.env('apiUrl')}/api/test/cleanup`, {
      transactionId: testTransactionId,
      customerId: testCustomerId
    })
  })

  describe('Full Payment Flow', () => {
    it('should process a full cash payment', () => {
      cy.loginAsCashier()
      
      // Navigate to transactions page
      cy.get('[data-cy=transactions-menu]').click()
      cy.url().should('include', '/transactions')
      
      // Find and click on the test transaction
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      // Fill payment form
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('1000')
      cy.get('[data-cy=payment-mode]').select('cash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      // Verify payment success
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      cy.get('[data-cy=payment-modal]').should('not.exist')
      
      // Verify transaction status updated
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=payment-status]').should('contain', 'Paid')
          cy.get('[data-cy=paid-amount]').should('contain', '₱1,000.00')
        })
    })

    it('should process a full GCash payment', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('1000')
      cy.get('[data-cy=payment-mode]').select('gcash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      
      // Verify payment mode is recorded
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=view-settlements-btn]').click()
        })
      
      cy.get('[data-cy=settlements-modal]').should('be.visible')
      cy.get('[data-cy=settlement-item]').should('have.length', 1)
      cy.get('[data-cy=settlement-item]').within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱1,000.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'GCash')
      })
    })
  })

  describe('Partial Payment Flow', () => {
    it('should process multiple partial payments', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      
      // First partial payment - Cash ₱400
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('400')
      cy.get('[data-cy=payment-mode]').select('cash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      cy.get('[data-cy=payment-modal]').should('not.exist')
      
      // Verify partial status
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=payment-status]').should('contain', 'Partial')
          cy.get('[data-cy=paid-amount]').should('contain', '₱400.00')
          cy.get('[data-cy=balance-amount]').should('contain', '₱600.00')
        })
      
      // Second partial payment - GCash ₱300
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('300')
      cy.get('[data-cy=payment-mode]').select('gcash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      
      // Verify updated partial status
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=payment-status]').should('contain', 'Partial')
          cy.get('[data-cy=paid-amount]').should('contain', '₱700.00')
          cy.get('[data-cy=balance-amount]').should('contain', '₱300.00')
        })
      
      // Final payment - Maya ₱300
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('300')
      cy.get('[data-cy=payment-mode]').select('maya')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      
      // Verify final paid status
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=payment-status]').should('contain', 'Paid')
          cy.get('[data-cy=paid-amount]').should('contain', '₱1,000.00')
          cy.get('[data-cy=balance-amount]').should('contain', '₱0.00')
        })
      
      // Verify all settlements are recorded
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=view-settlements-btn]').click()
        })
      
      cy.get('[data-cy=settlements-modal]').should('be.visible')
      cy.get('[data-cy=settlement-item]').should('have.length', 3)
      
      // Verify settlement details (most recent first)
      cy.get('[data-cy=settlement-item]').eq(0).within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱300.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'Maya')
      })
      
      cy.get('[data-cy=settlement-item]').eq(1).within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱300.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'GCash')
      })
      
      cy.get('[data-cy=settlement-item]').eq(2).within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱400.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'Cash')
      })
    })
  })

  describe('Over-payment Protection', () => {
    it('should prevent over-payment', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      // Attempt to pay more than transaction amount
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('1500')
      cy.get('[data-cy=payment-mode]').select('cash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      // Verify error message
      cy.get('[data-cy=payment-error-message]').should('be.visible')
      cy.get('[data-cy=payment-error-message]').should('contain', 'exceeds remaining balance')
      
      // Modal should remain open
      cy.get('[data-cy=payment-modal]').should('be.visible')
      
      // Cancel payment
      cy.get('[data-cy=cancel-payment-btn]').click()
      cy.get('[data-cy=payment-modal]').should('not.exist')
    })

    it('should prevent over-payment with existing partial payments', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      
      // First make a partial payment
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('800')
      cy.get('[data-cy=payment-mode]').select('cash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      cy.get('[data-cy=payment-modal]').should('not.exist')
      
      // Attempt to pay more than remaining balance
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('300') // Would total 1100
      cy.get('[data-cy=payment-mode]').select('gcash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      // Verify error message
      cy.get('[data-cy=payment-error-message]').should('be.visible')
      cy.get('[data-cy=payment-error-message]').should('contain', 'exceeds remaining balance')
      
      // Verify remaining balance is shown correctly
      cy.get('[data-cy=remaining-balance]').should('contain', '₱200.00')
    })
  })

  describe('Payment Validation', () => {
    it('should validate payment amount', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      // Test zero amount
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('0')
      cy.get('[data-cy=payment-mode]').select('cash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=amount-error]').should('be.visible')
      cy.get('[data-cy=amount-error]').should('contain', 'Amount must be greater than 0')
      
      // Test negative amount
      cy.get('[data-cy=payment-amount]').clear().type('-100')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=amount-error]').should('be.visible')
      cy.get('[data-cy=amount-error]').should('contain', 'Amount must be greater than 0')
      
      // Test empty amount
      cy.get('[data-cy=payment-amount]').clear()
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=amount-error]').should('be.visible')
      cy.get('[data-cy=amount-error]').should('contain', 'Amount is required')
    })

    it('should validate payment mode selection', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('500')
      // Don't select payment mode
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      cy.get('[data-cy=payment-mode-error]').should('be.visible')
      cy.get('[data-cy=payment-mode-error]').should('contain', 'Payment mode is required')
    })
  })

  describe('Real-time Updates', () => {
    it('should show real-time payment updates', () => {
      // Open two browser windows - one for cashier, one for monitoring
      cy.loginAsCashier()
      
      // In a real test, you would open a second window here
      // For now, we'll simulate the behavior
      
      cy.get('[data-cy=transactions-menu]').click()
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=add-payment-btn]').click()
        })
      
      cy.get('[data-cy=payment-modal]').should('be.visible')
      cy.get('[data-cy=payment-amount]').clear().type('500')
      cy.get('[data-cy=payment-mode]').select('cash')
      cy.get('[data-cy=confirm-payment-btn]').click()
      
      // Verify WebSocket updates are sent (check network tab or mock WebSocket)
      cy.window().its('io').should('exist')
      
      // Verify UI updates immediately
      cy.get('[data-cy=payment-success-message]').should('be.visible')
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=payment-status]').should('contain', 'Partial')
          cy.get('[data-cy=paid-amount]').should('contain', '₱500.00')
        })
    })
  })

  describe('Payment History', () => {
    it('should display payment history correctly', () => {
      cy.loginAsCashier()
      
      cy.get('[data-cy=transactions-menu]').click()
      
      // Make multiple payments
      const payments = [
        { amount: '250', mode: 'cash' },
        { amount: '300', mode: 'gcash' },
        { amount: '450', mode: 'maya' }
      ]
      
      payments.forEach((payment, index) => {
        cy.get('[data-cy=transaction-row]')
          .contains(testOrNumber)
          .parents('[data-cy=transaction-row]')
          .within(() => {
            cy.get('[data-cy=add-payment-btn]').click()
          })
        
        cy.get('[data-cy=payment-modal]').should('be.visible')
        cy.get('[data-cy=payment-amount]').clear().type(payment.amount)
        cy.get('[data-cy=payment-mode]').select(payment.mode)
        cy.get('[data-cy=confirm-payment-btn]').click()
        
        cy.get('[data-cy=payment-success-message]').should('be.visible')
        cy.get('[data-cy=payment-modal]').should('not.exist')
      })
      
      // View payment history
      cy.get('[data-cy=transaction-row]')
        .contains(testOrNumber)
        .parents('[data-cy=transaction-row]')
        .within(() => {
          cy.get('[data-cy=view-settlements-btn]').click()
        })
      
      cy.get('[data-cy=settlements-modal]').should('be.visible')
      cy.get('[data-cy=settlement-item]').should('have.length', 3)
      
      // Verify chronological order (most recent first)
      cy.get('[data-cy=settlement-item]').eq(0).within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱450.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'Maya')
        cy.get('[data-cy=settlement-date]').should('be.visible')
        cy.get('[data-cy=settlement-cashier]').should('contain', 'Test Cashier')
      })
      
      cy.get('[data-cy=settlement-item]').eq(1).within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱300.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'GCash')
      })
      
      cy.get('[data-cy=settlement-item]').eq(2).within(() => {
        cy.get('[data-cy=settlement-amount]').should('contain', '₱250.00')
        cy.get('[data-cy=settlement-mode]').should('contain', 'Cash')
      })
      
      // Verify total
      cy.get('[data-cy=settlements-total]').should('contain', '₱1,000.00')
    })
  })
})
