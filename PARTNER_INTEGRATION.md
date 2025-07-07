# Partner Portal Integration Guide

## Database Architecture

This system uses two separate MongoDB databases:

1. **Main Database (fintech_bank)**
   - Stores core application data including users, customers, consents, partners, and audit logs
   - Primary database for all financial and customer data

2. **Partner Portal Database**
   - Separate database for partner portal functionality
   - Contains partner contracts, audit logs, and user data
   - Accessed via the Partner Portal module

## Integration Architecture

The integration between the main application and Partner Portal is designed to be resilient,
allowing the core API to function normally even when the Partner Portal is unavailable.

### Key Components

1. **Partner Sync Service** (`utils/partnerSyncService.js`)
   - Synchronizes critical partner data between databases
   - Runs on a configurable interval (default: 1 hour)
   - Ensures essential partner contract data is available in the main database

2. **Resilient Validation** (`models/consentModel.js`)
   - Gracefully handles partner validation when Partner Portal is unavailable
   - Allows consent creation with warnings rather than hard failures

3. **Reconnection Strategy** (`server.js`)
   - Attempts to establish Partner Portal connection at startup
   - Provides optional retry mechanism for reconnection
   - Continues normal operation without Partner Portal features when unavailable

4. **Enhanced Health Monitoring** (`server.js` - `/health` endpoint)
   - Provides detailed status of both databases
   - Reports sync status and connection details
   - Helps diagnose integration issues

## Configuration

Add the following environment variables to control the integration:

```
# Partner Portal Database
PARTNER_DB_URI=mongodb://localhost:27017/partner_portal

# Partner Sync Service
PARTNER_SYNC_INTERVAL=3600000  # Sync interval in milliseconds (default: 1 hour)

# Reconnection Strategy
ENABLE_PARTNER_PORTAL_RETRY=true  # Enable automatic reconnection attempts
PARTNER_PORTAL_RETRY_INTERVAL=300000  # Retry interval in milliseconds (default: 5 minutes)
```

## Troubleshooting

### Common Issues

1. **"Partner database not connected"**
   - Check that `PARTNER_DB_URI` is set correctly
   - Verify the Partner Portal database is running and accessible
   - Check network connectivity between the application and database server

2. **Partner Validation Warnings**
   - These are expected when Partner Portal is unavailable
   - Check the sync status via the `/health` endpoint
   - Force a sync using the Partner Sync Service: `partnerSyncService.forceSyncNow()`

3. **Missing Partner Data**
   - Check last sync time in the health endpoint
   - Verify data exists in the Partner Portal database
   - Try forcing a sync operation

## Architectural Decisions

1. **Data Duplication vs. Cross-Database References**
   - Essential partner data is duplicated in the main database for resilience
   - This creates a small storage overhead but ensures the system remains functional

2. **Soft Validation vs. Hard Requirements**
   - The system uses soft validation (warnings) rather than hard failures
   - This prioritizes system availability over strict consistency

3. **Async Sync vs. Real-time Consistency**
   - Partner data is synchronized periodically rather than in real-time
   - This improves performance but means there may be a delay in data propagation

## Verification Status

✅ **INTEGRATION FULLY VERIFIED** (Last verified: July 7, 2025)

All components described in this document have been tested and verified working:
- ✅ Dual database architecture operational
- ✅ Partner Sync Service functional  
- ✅ Resilient validation implemented
- ✅ Reconnection strategy working
- ✅ Health monitoring endpoint active
- ✅ Environment configuration correct

**Verification Scripts:**
- `verify-partner-integration.js` - Comprehensive integration test
- `test-final-verification.js` - Overall system verification
- See `PARTNER_INTEGRATION_VERIFICATION.md` for detailed test results

## Future Improvements

1. **Event-Based Synchronization**
   - Implement an event bus to trigger immediate synchronization on data changes
   - Reduces delay in data propagation while maintaining system resilience

2. **Circuit Breaker Pattern**
   - Add circuit breaker for Partner Portal operations to prevent cascading failures
   - Automatically degrade gracefully when issues are detected

3. **Bidirectional Sync**
   - Implement bidirectional synchronization to keep both databases in sync
   - Currently sync is one-way (Partner Portal → Main Database)
