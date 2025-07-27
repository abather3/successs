# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2025-01-27

### Added
- **Blue/Green Deployment Strategy**: Comprehensive deployment pipeline with zero-downtime updates
- **Database Migration Framework**: Forward-compatible schema migrations with rollback support
- **Enhanced Queue Status Management**: Processing status with backward-compatible enum values
- **Deployment Automation**: Docker-based containerization for consistent deployments
- **Rollback Procedures**: Non-breaking rollback strategy preserving enum values
- **Comprehensive Test Suite**: Full test coverage for daily reports functionality
  - Backend Jest tests for `/reports/daily/:date` endpoint
  - Frontend React Testing Library tests for daily reports component
  - Regression protection for API and UI components
- **RBAC Security Enhancements**:
  - SUPER_ADMIN role with complete hierarchy support
  - JWT debugging utility with detailed token analysis
  - Enhanced error messages for permission violations
- **Real-time Features**:
  - WebSocket payment status updates
  - Payment settlement processing with race condition protection
  - Live queue status broadcasting

## [Unreleased]

### Planned
- Advanced analytics dashboard
- Mobile application support
- Multi-tenant architecture

### Fixed
- **RBAC Permission System**: Complete audit and fixes for Role-Based Access Control
  - Added missing SUPER_ADMIN role to user hierarchy
  - Fixed incomplete role hierarchies in middleware
  - Enhanced error messages with specific role requirements
  - Added JWT debugging tools for troubleshooting permissions
  - Updated all middleware to include SUPER_ADMIN in admin-level checks
- **WebSocket Payment Updates**: Implemented real-time payment status broadcasting
  - Added subscription handler for payment status updates
  - Fixed race conditions in payment settlement processing
  - Enhanced WebSocket service with structured payment event payloads
  - Added role-based access control for payment update subscriptions
- **Settlement Processing Loop**: Resolved confirmation processing deadlock issues
  - Fixed database lock contention during concurrent settlement operations
  - Implemented proper transaction management for payment operations
  - Added prevention for duplicate settlement rows
  - Resolved recursive status recalculation causing processing loops

### Changed
- Enhanced daily reports error handling and null value normalization
- Improved test coverage for daily reports functionality
- Updated role permission matrix to include SUPER_ADMIN hierarchy
- Enhanced WebSocket gateway with payment status broadcasting capabilities
- Improved database transaction handling for payment settlements

### Technical Details
- **Backend Tests**: `backend/src/__tests__/routes/dailyReports.test.ts`
  - Tests API endpoint behavior for non-existent reports
  - Validates numeric defaults (0) for null database values
  - Tests error handling and different date formats
  - Ensures proper response structure with `exists: false`

- **Frontend Tests**: `frontend/src/__tests__/components/DailyReportsComponent.test.tsx`
  - Tests component rendering when no reports are available
  - Validates "No past reports available" message display
  - Tests API integration and error handling
  - Ensures proper UI state management

### Test Coverage
- All tests pass successfully
- Backend API behavior validated
- Frontend UI behavior validated
- Integration between backend and frontend confirmed
- Regression protection implemented for daily reports functionality
