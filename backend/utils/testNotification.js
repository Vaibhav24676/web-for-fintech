import notificationService from './notificationService.js';

/**
 * Simple test function to verify the notification service works
 */
async function testNotification() {
  console.log('Testing notification service...');
  
  try {
    const result = await notificationService.notifyPartner({
      partnerId: 'test-partner',
      callbackUrl: 'https://webhook.site/75e1dd3e-2c70-4c10-ab68-cb3452655e98',
      eventType: 'test_notification',
      data: {
        message: 'This is a test notification',
        timestamp: new Date().toISOString()
      },
      user: {
        _id: 'system',
        role: 'system'
      }
    });
    
    console.log('Notification test result:', result);
  } catch (error) {
    console.error('Error testing notification:', error);
  }
}

// Run the test
testNotification();
