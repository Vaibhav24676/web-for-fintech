import fetch from 'node-fetch';
import auditService from './auditService.js';

/**
 * Service for sending notifications to partners
 */
const notificationService = {
  /**
   * Send a notification to a partner's callback URL
   * @param {Object} options - Notification options
   * @param {string} options.partnerId - Partner ID
   * @param {string} options.callbackUrl - Partner's callback URL
   * @param {string} options.eventType - Type of event (e.g., 'consent_created')
   * @param {Object} options.data - Data to send to the partner
   * @param {Object} options.user - User making the request (for audit logs)
   * @returns {Promise<Object>} - Response from the partner's callback URL
   */
  async notifyPartner(options) {
    const { partnerId, callbackUrl, eventType, data, user } = options;
    
    if (!callbackUrl) {
      console.warn(`No callback URL configured for partner: ${partnerId}`);
      return { success: false, message: 'No callback URL configured' };
    }

    try {
      // Create a notification object
      const notification = {
        eventType,
        timestamp: new Date().toISOString(),
        partnerId,
        data
      };

      // Send the notification to the partner's callback URL
      console.log(`Attempting to send notification to ${callbackUrl}`);
      console.log(`Notification payload:`, JSON.stringify(notification, null, 2));
      
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': eventType,
        },
        body: JSON.stringify(notification),
      });
      
      console.log(`Notification response status: ${response.status}`);
    
      // Check if the notification was successfully sent
      const success = response.ok;
      const responseData = await response.json().catch(() => ({}));

      // Log the notification event
      await auditService.logEvent({
        eventType: 'partner_notification_sent',
        actorType: user?.role || 'system',
        actorId: user?._id || 'system',
        partnerId,
        actionDetails: {
          eventType,
          callbackUrl,
          success,
          responseStatus: response.status,
        },
        metadata: { 
          responseBody: JSON.stringify(responseData).slice(0, 1000) // Truncate if too long
        }
      }).catch(err => console.error('Error logging notification:', err));

      return { 
        success, 
        status: response.status, 
        message: success ? 'Notification sent successfully' : 'Failed to send notification',
        response: responseData
      };
    } catch (error) {
      console.error(`Error notifying partner ${partnerId}:`, error);
      
      // Log the error
      await auditService.logEvent({
        eventType: 'partner_notification_failed',
        actorType: user?.role || 'system',
        actorId: user?._id || 'system',
        partnerId,
        actionDetails: {
          eventType,
          callbackUrl,
          error: error.message
        }
      }).catch(err => console.error('Error logging notification failure:', err));
      
      return { success: false, message: `Error: ${error.message}` };
    }
  }
};

export default notificationService;
