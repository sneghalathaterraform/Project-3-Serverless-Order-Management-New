'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const dynamoClient = new DynamoDBClient({});
const dynamo       = DynamoDBDocumentClient.from(dynamoClient);
const snsClient    = new SNSClient({});

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const LOG_LEVEL    = process.env.LOG_LEVEL || 'INFO';

const log = (level, message, data = {}) => {
  if (level === 'DEBUG' && LOG_LEVEL !== 'DEBUG') return;
  console.log(JSON.stringify({ level, message, ...data, timestamp: new Date().toISOString() }));
};

// Simulate inventory check / business validation
const validateOrder = (order) => {
  if (!order.items || order.items.length === 0) return { valid: false, reason: 'No items in order' };
  if (order.total <= 0) return { valid: false, reason: 'Invalid order total' };
  // Simulate occasional inventory failures for testing (1 in 20)
  if (Math.random() < 0.05) return { valid: false, reason: 'Inventory not available' };
  return { valid: true };
};

const updateOrderStatus = async (orderId, status, extra = {}) => {
  const now = new Date().toISOString();
  await dynamo.send(new UpdateCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt' +
      (extra.trackingNumber ? ', trackingNumber = :tracking' : ''),
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': now,
      ...(extra.trackingNumber ? { ':tracking': extra.trackingNumber } : {}),
    },
  }));
  log('INFO', 'Order status updated', { orderId, status });
};

const publishNotification = async (order, status, message) => {
  await snsClient.send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject: `Order ${status}: ${order.orderId}`,
    Message: JSON.stringify({
      orderId: order.orderId,
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      status,
      message,
      total: order.total,
      timestamp: new Date().toISOString(),
    }),
    MessageAttributes: {
      status: { DataType: 'String', StringValue: status },
    },
  }));
  log('INFO', 'SNS notification published', { orderId: order.orderId, status });
};

const processOrder = async (message) => {
  const { orderId } = message;
  log('INFO', 'Processing order', { orderId });

  // Fetch full order from DynamoDB
  const result = await dynamo.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } }));
  if (!result.Item) {
    log('ERROR', 'Order not found', { orderId });
    throw new Error(`Order ${orderId} not found`);
  }

  const order = result.Item;

  // Mark as PROCESSING
  await updateOrderStatus(orderId, 'PROCESSING');

  // Validate
  const validation = validateOrder(order);
  if (!validation.valid) {
    await updateOrderStatus(orderId, 'FAILED');
    await publishNotification(order, 'FAILED',
      `Your order could not be processed: ${validation.reason}`);
    log('WARN', 'Order failed validation', { orderId, reason: validation.reason });
    return;
  }

  // Simulate processing delay (would be real business logic in production)
  const trackingNumber = `TRK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // Mark as CONFIRMED
  await updateOrderStatus(orderId, 'CONFIRMED', { trackingNumber });
  await publishNotification(order, 'CONFIRMED',
    `Your order has been confirmed! Tracking number: ${trackingNumber}`);

  log('INFO', 'Order confirmed', { orderId, trackingNumber });
};

exports.handler = async (event) => {
  log('INFO', 'Worker triggered', { recordCount: event.Records.length });

  const results = await Promise.allSettled(
    event.Records.map(async (record) => {
      let message;
      try {
        message = JSON.parse(record.body);
      } catch {
        log('ERROR', 'Failed to parse SQS message', { body: record.body });
        throw new Error('Invalid message format');
      }
      await processOrder(message);
    })
  );

  // Report any failures so SQS can retry/DLQ them
  const failures = results
    .map((r, i) => ({ result: r, id: event.Records[i].messageId }))
    .filter(({ result }) => result.status === 'rejected');

  if (failures.length > 0) {
    log('ERROR', 'Some messages failed', { failures: failures.map(f => f.id) });
    // Return batch item failures to avoid re-processing successful ones
    return {
      batchItemFailures: failures.map(({ id }) => ({ itemIdentifier: id })),
    };
  }

  log('INFO', 'All messages processed successfully');
};