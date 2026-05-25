'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, GetBucketLocationCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});
const s3Client = new S3Client({});

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const QUEUE_URL    = process.env.QUEUE_URL;
const S3_BUCKET    = process.env.S3_BUCKET;
const LOG_LEVEL    = process.env.LOG_LEVEL || 'INFO';

const log = (level, message, data = {}) => {
  if (level === 'DEBUG' && LOG_LEVEL !== 'DEBUG') return;
  console.log(JSON.stringify({ level, message, ...data, timestamp: new Date().toISOString() }));
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify(body),
});

// â”€â”€ POST /orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const createOrder = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const { customerId, customerEmail, items, shippingAddress } = body;

  if (!customerId || !customerEmail || !items || !Array.isArray(items) || items.length === 0) {
    return response(400, { error: 'Missing required fields: customerId, customerEmail, items' });
  }

  const orderId  = uuidv4();
  const now      = Date.now();
  const total    = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const order = {
    orderId,
    customerId,
    customerEmail,
    items,
    shippingAddress: shippingAddress || {},
    total: Math.round(total * 100) / 100,
    status: 'PENDING',
    timestamp: now,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  await dynamo.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
  log('INFO', 'Order created', { orderId, customerId });

  // Send to SQS for async processing
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ action: 'PROCESS_ORDER', orderId, customerId, timestamp: now }),
  }));
  log('INFO', 'Order queued for processing', { orderId });

  return response(201, { message: 'Order created successfully', orderId, order });
};

// â”€â”€ GET /orders/{orderId} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getOrder = async (event) => {
  const { orderId } = event.pathParameters || {};
  if (!orderId) return response(400, { error: 'orderId is required' });

  const result = await dynamo.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } }));

  if (!result.Item) return response(404, { error: `Order ${orderId} not found` });

  log('INFO', 'Order retrieved', { orderId });
  return response(200, { order: result.Item });
};

// â”€â”€ GET /orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const listOrders = async (event) => {
  const { customerId } = (event.queryStringParameters || {});

  let result;
  if (customerId) {
    result = await dynamo.send(new QueryCommand({
      TableName: ORDERS_TABLE,
      IndexName: 'CustomerIdIndex',
      KeyConditionExpression: 'customerId = :cid',
      ExpressionAttributeValues: { ':cid': customerId },
      ScanIndexForward: false,   // newest first
    }));
  } else {
    result = await dynamo.send(new ScanCommand({ TableName: ORDERS_TABLE }));
  }

  log('INFO', 'Orders listed', { customerId, count: result.Items.length });
  return response(200, { orders: result.Items, count: result.Items.length });
};

// â”€â”€ POST /upload-url â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getPresignedUrl = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const { orderId, fileName, fileType } = body;
  if (!orderId || !fileName || !fileType) {
    return response(400, { error: 'Missing required fields: orderId, fileName, fileType' });
  }

  const key = `orders/${orderId}/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  log('INFO', 'Presigned URL generated', { orderId, key });
  return response(200, { uploadUrl, key, expiresIn: 3600 });
};

// â”€â”€ Router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.handler = async (event) => {
  log('DEBUG', 'Incoming event', { method: event.httpMethod, path: event.path });

  try {
    const method = event.httpMethod;
    const path   = event.path || '';

    if (method === 'OPTIONS') return response(200, {});

    if (method === 'POST' && path.endsWith('/orders'))      return createOrder(event);
    if (method === 'GET'  && path.match(/\/orders\/[^/]+$/)) return getOrder(event);
    if (method === 'GET'  && path.endsWith('/orders'))       return listOrders(event);
    if (method === 'POST' && path.endsWith('/upload-url'))   return getPresignedUrl(event);

    return response(404, { error: 'Route not found' });
  } catch (err) {
    log('ERROR', 'Unhandled error', { error: err.message, stack: err.stack });
    return response(500, { error: 'Internal server error' });
  }
};
