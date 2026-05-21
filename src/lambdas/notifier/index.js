'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({});
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

// SES requires a verified sender address - set this via env or replace with your verified email
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@example.com';

const log = (level, message, data = {}) => {
  if (level === 'DEBUG' && LOG_LEVEL !== 'DEBUG') return;
  console.log(JSON.stringify({ level, message, ...data, timestamp: new Date().toISOString() }));
};

const STATUS_TEMPLATES = {
  CONFIRMED: {
    subject: (orderId) => `✅ Order Confirmed - #${orderId}`,
    body: (data) => `
Hello,

Great news! Your order #${data.orderId} has been confirmed.

Order Summary:
- Order ID:        ${data.orderId}
- Status:          CONFIRMED
- Total:           $${data.total || 'N/A'}
- Tracking Number: ${data.trackingNumber || 'Will be assigned when shipped'}

${data.message || ''}

Thank you for your order!

Best regards,
The Order Processing Team
    `.trim(),
  },
  FAILED: {
    subject: (orderId) => `❌ Order Failed - #${orderId}`,
    body: (data) => `
Hello,

Unfortunately, your order #${data.orderId} could not be processed.

Reason: ${data.message || 'An unexpected error occurred'}

Please contact support or try placing a new order.

We apologize for the inconvenience.

Best regards,
The Order Processing Team
    `.trim(),
  },
  SHIPPED: {
    subject: (orderId) => `🚚 Order Shipped - #${orderId}`,
    body: (data) => `
Hello,

Your order #${data.orderId} has been shipped!

Tracking Number: ${data.trackingNumber || 'N/A'}

${data.message || ''}

Thank you for your patience!

Best regards,
The Order Processing Team
    `.trim(),
  },
  DEFAULT: {
    subject: (orderId) => `Order Update - #${orderId}`,
    body: (data) => `
Hello,

Your order #${data.orderId} has been updated.

New Status: ${data.status}
${data.message ? `\nMessage: ${data.message}` : ''}

Best regards,
The Order Processing Team
    `.trim(),
  },
};

const sendEmail = async (toAddress, subject, body) => {
  await sesClient.send(new SendEmailCommand({
    Source: SENDER_EMAIL,
    Destination: { ToAddresses: [toAddress] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: body, Charset: 'UTF-8' } },
    },
  }));
  log('INFO', 'Email sent', { to: toAddress, subject });
};

const processNotification = async (snsMessage) => {
  let data;
  try {
    data = JSON.parse(snsMessage);
  } catch {
    log('ERROR', 'Failed to parse SNS message', { snsMessage });
    throw new Error('Invalid SNS message format');
  }

  const { orderId, customerEmail, status, message, total, trackingNumber } = data;

  if (!customerEmail) {
    log('WARN', 'No customer email in notification, skipping', { orderId });
    return;
  }

  const template = STATUS_TEMPLATES[status] || STATUS_TEMPLATES.DEFAULT;
  const subject  = template.subject(orderId);
  const body     = template.body({ orderId, status, message, total, trackingNumber });

  await sendEmail(customerEmail, subject, body);
  log('INFO', 'Notification processed', { orderId, status, customerEmail });
};

exports.handler = async (event) => {
  log('INFO', 'Notifier triggered', { recordCount: event.Records.length });

  const results = await Promise.allSettled(
    event.Records.map(async (record) => {
      const snsMessage = record.Sns.Message;
      await processNotification(snsMessage);
    })
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    failures.forEach(f => log('ERROR', 'Notification failed', { error: f.reason?.message }));
    // SNS does not support partial batch failure responses, so we throw to signal failure
    throw new Error(`${failures.length} notification(s) failed`);
  }

  log('INFO', 'All notifications sent successfully');
};