# PHASE 4: LAMBDA FUNCTIONS - CREATE YOUR OWN FILES

## File Structure to Create:

```
Project-3/
├── src/
│   └── lambdas/
│       ├── api-handler/
│       │   ├── package.json        (CREATE THIS)
│       │   └── index.js            (CREATE THIS)
│       ├── worker/
│       │   ├── package.json        (CREATE THIS)
│       │   └── index.js            (CREATE THIS)
│       └── notifier/
│           ├── package.json        (CREATE THIS)
│           └── index.js            (CREATE THIS)
```

---

## FILE 1: src/lambdas/api-handler/package.json

```json
{
  "name": "api-handler",
  "version": "1.0.0",
  "description": "API Handler Lambda for order management",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0",
    "uuid": "^9.0.0"
  }
}
```

---

## FILE 2: src/lambdas/api-handler/index.js

```javascript
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();
const s3 = new AWS.S3();

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const QUEUE_URL = process.env.QUEUE_URL;
const S3_BUCKET = process.env.S3_BUCKET;

// ==================== MAIN HANDLER ====================
exports.handler = async (event) => {
  console.log('API Handler - Received event:', JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const resource = event.resource;

    // Route to appropriate function
    if (resource === '/orders' && httpMethod === 'POST') {
      return await createOrder(event);
    } else if (resource === '/orders/{orderId}' && httpMethod === 'GET') {
      return await getOrder(event);
    } else if (resource === '/orders' && httpMethod === 'GET') {
      return await listOrders(event);
    } else if (resource === '/upload-url' && httpMethod === 'POST') {
      return await getPresignedUrl(event);
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid endpoint' })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};

// ==================== CREATE ORDER ====================
async function createOrder(event) {
  try {
    const body = JSON.parse(event.body);
    
    // Validate required fields
    if (!body.customerId || !body.items || !body.items.length) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: customerId, items' })
      };
    }

    const orderId = uuidv4();
    const timestamp = Date.now();
    
    // Calculate total price
    const total = body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const order = {
      orderId,
      customerId: body.customerId,
      items: body.items,
      total,
      status: 'PENDING',
      timestamp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shippingAddress: body.shippingAddress || {},
      customerEmail: body.customerEmail || ''
    };

    // Save order to DynamoDB
    await dynamodb.put({
      TableName: ORDERS_TABLE,
      Item: order
    }).promise();

    console.log('Order created and saved to DynamoDB:', orderId);

    // Send message to SQS for async processing
    await sqs.sendMessage({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        action: 'PROCESS_ORDER',
        orderId,
        customerId: body.customerId,
        timestamp
      })
    }).promise();

    console.log('Order sent to SQS for processing:', orderId);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Order created successfully',
        orderId,
        order
      })
    };
  } catch (error) {
    console.error('Create order error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create order', message: error.message })
    };
  }
}

// ==================== GET ORDER ====================
async function getOrder(event) {
  try {
    const orderId = event.pathParameters.orderId;

    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing orderId in path' })
      };
    }

    const result = await dynamodb.get({
      TableName: ORDERS_TABLE,
      Key: { orderId }
    }).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Order not found' })
      };
    }

    console.log('Retrieved order:', orderId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Get order error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get order', message: error.message })
    };
  }
}

// ==================== LIST ORDERS ====================
async function listOrders(event) {
  try {
    const customerId = event.queryStringParameters?.customerId;
    
    if (!customerId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing customerId query parameter' })
      };
    }

    const result = await dynamodb.query({
      TableName: ORDERS_TABLE,
      IndexName: 'CustomerIdIndex',
      KeyConditionExpression: 'customerId = :customerId',
      ExpressionAttributeValues: {
        ':customerId': customerId
      },
      ScanIndexForward: false // Most recent first
    }).promise();

    console.log(`Retrieved ${result.Items.length} orders for customer:`, customerId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        count: result.Items.length,
        orders: result.Items
      })
    };
  } catch (error) {
    console.error('List orders error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list orders', message: error.message })
    };
  }
}

// ==================== GET PRESIGNED URL ====================
async function getPresignedUrl(event) {
  try {
    const body = JSON.parse(event.body);
    const { orderId, fileName, fileType } = body;

    if (!orderId || !fileName || !fileType) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: orderId, fileName, fileType' })
      };
    }

    const key = `orders/${orderId}/${fileName}`;
    
    const presignedUrl = s3.getSignedUrl('putObject', {
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: fileType,
      Expires: 3600 // 1 hour
    });

    console.log('Generated presigned URL for:', key);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Presigned URL generated successfully',
        uploadUrl: presignedUrl,
        key,
        expiresIn: 3600
      })
    };
  } catch (error) {
    console.error('Get presigned URL error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate presigned URL', message: error.message })
    };
  }
}
```

---

## FILE 3: src/lambdas/worker/package.json

```json
{
  "name": "worker",
  "version": "1.0.0",
  "description": "Worker Lambda for async order processing",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0"
  }
}
```

---

## FILE 4: src/lambdas/worker/index.js

```javascript
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// ==================== MAIN HANDLER ====================
exports.handler = async (event) => {
  console.log('Worker Lambda - Received event:', JSON.stringify(event, null, 2));

  try {
    // Process each SQS message
    const results = await Promise.all(
      event.Records.map(record => processMessage(record))
    );

    console.log('All messages processed:', results);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Messages processed', results })
    };
  } catch (error) {
    console.error('Error processing messages:', error);
    throw error;
  }
};

// ==================== PROCESS SINGLE MESSAGE ====================
async function processMessage(record) {
  try {
    const messageBody = JSON.parse(record.body);
    console.log('Processing message:', messageBody);

    const { action, orderId, customerId, timestamp } = messageBody;

    if (action !== 'PROCESS_ORDER') {
      console.log('Unknown action:', action);
      return { statusCode: 400, message: 'Unknown action' };
    }

    // Get order from DynamoDB
    const orderResult = await dynamodb.get({
      TableName: ORDERS_TABLE,
      Key: { orderId }
    }).promise();

    if (!orderResult.Item) {
      console.error('Order not found:', orderId);
      return { statusCode: 404, message: 'Order not found' };
    }

    const order = orderResult.Item;
    console.log('Retrieved order:', order);

    // Simulate order processing (validation, inventory check, etc.)
    const processedOrder = await simulateOrderProcessing(order);

    // Update order status in DynamoDB
    await dynamodb.update({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': processedOrder.status,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    console.log(`Order status updated to ${processedOrder.status}:`, orderId);

    // Publish notification to SNS
    await publishNotification({
      orderId,
      customerId,
      status: processedOrder.status,
      message: processedOrder.message,
      timestamp: new Date().toISOString()
    });

    console.log('Notification published for order:', orderId);

    return {
      statusCode: 200,
      message: 'Order processed successfully',
      orderId,
      newStatus: processedOrder.status
    };
  } catch (error) {
    console.error('Error processing message:', error);
    throw error;
  }
}

// ==================== SIMULATE ORDER PROCESSING ====================
async function simulateOrderProcessing(order) {
  try {
    console.log('Simulating order processing for:', order.orderId);

    // Simulate validation
    if (!order.items || order.items.length === 0) {
      return {
        status: 'FAILED',
        message: 'Order has no items'
      };
    }

    // Simulate inventory check (random success/failure for demo)
    const inventoryAvailable = Math.random() > 0.1; // 90% success rate

    if (!inventoryAvailable) {
      return {
        status: 'FAILED',
        message: 'Insufficient inventory'
      };
    }

    // Simulate address validation
    if (!order.shippingAddress || !order.shippingAddress.street) {
      return {
        status: 'FAILED',
        message: 'Invalid shipping address'
      };
    }

    // Simulate payment processing
    const paymentProcessed = Math.random() > 0.05; // 95% success rate

    if (!paymentProcessed) {
      return {
        status: 'FAILED',
        message: 'Payment processing failed'
      };
    }

    // All checks passed
    return {
      status: 'CONFIRMED',
      message: 'Order confirmed and ready for fulfillment'
    };
  } catch (error) {
    console.error('Error in order processing simulation:', error);
    return {
      status: 'FAILED',
      message: error.message
    };
  }
}

// ==================== PUBLISH NOTIFICATION ====================
async function publishNotification(notification) {
  try {
    const message = {
      orderId: notification.orderId,
      customerId: notification.customerId,
      status: notification.status,
      message: notification.message,
      timestamp: notification.timestamp
    };

    await sns.publish({
      TopicArn: SNS_TOPIC_ARN,
      Message: JSON.stringify(message, null, 2),
      Subject: `Order Update: ${notification.orderId}`
    }).promise();

    console.log('Notification published to SNS:', notification.orderId);
  } catch (error) {
    console.error('Error publishing notification:', error);
    throw error;
  }
}
```

---

## FILE 5: src/lambdas/notifier/package.json

```json
{
  "name": "notifier",
  "version": "1.0.0",
  "description": "Notifier Lambda for sending email notifications",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0"
  }
}
```

---

## FILE 6: src/lambdas/notifier/index.js

```javascript
const AWS = require('aws-sdk');

const ses = new AWS.SES({ region: 'us-east-1' });

// ==================== MAIN HANDLER ====================
exports.handler = async (event) => {
  console.log('Notifier Lambda - Received event:', JSON.stringify(event, null, 2));

  try {
    // Process SNS message
    const message = JSON.parse(event.Records[0].Sns.Message);
    console.log('Processing notification:', message);

    // Send email notification
    await sendEmailNotification(message);

    console.log('Notification sent successfully for order:', message.orderId);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Notification sent' })
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// ==================== SEND EMAIL NOTIFICATION ====================
async function sendEmailNotification(notification) {
  try {
    const { orderId, customerId, status, message, timestamp } = notification;

    // Format email content based on order status
    const emailContent = formatEmailContent(orderId, status, message);

    const params = {
      Source: 'noreply@example.com', // Update with verified SES email
      Destination: {
        ToAddresses: ['customer@example.com'] // In production, use customer email
      },
      Message: {
        Subject: {
          Data: emailContent.subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: emailContent.html,
            Charset: 'UTF-8'
          },
          Text: {
            Data: emailContent.text,
            Charset: 'UTF-8'
          }
        }
      }
    };

    // Uncomment below to actually send emails
    // await ses.sendEmail(params).promise();
    
    // For now, just log it
    console.log('Email notification formatted:', params);
    console.log('NOTE: Email sending disabled. To enable, verify email in SES and uncomment ses.sendEmail()');

    return { statusCode: 200, message: 'Email notification processed' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// ==================== FORMAT EMAIL CONTENT ====================
function formatEmailContent(orderId, status, message) {
  const statusMessages = {
    CONFIRMED: {
      title: 'Order Confirmed',
      color: '#28a745'
    },
    FAILED: {
      title: 'Order Processing Failed',
      color: '#dc3545'
    },
    SHIPPED: {
      title: 'Order Shipped',
      color: '#007bff'
    },
    DELIVERED: {
      title: 'Order Delivered',
      color: '#17a2b8'
    }
  };

  const statusInfo = statusMessages[status] || { title: 'Order Update', color: '#6c757d' };

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 20px auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="border-left: 4px solid ${statusInfo.color}; padding-left: 16px; margin-bottom: 20px;">
            <h2 style="color: ${statusInfo.color}; margin: 0;">${statusInfo.title}</h2>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p>Hello,</p>
            <p>Your order <strong>${orderId}</strong> status has been updated.</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Message:</strong> ${message}</p>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
            <p style="margin: 5px 0;"><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    ${statusInfo.title}
    
    Your order ${orderId} status has been updated.
    Status: ${status}
    Message: ${message}
    
    Updated: ${new Date().toLocaleString()}
    
    This is an automated message. Please do not reply to this email.
  `;

  return {
    subject: `${statusInfo.title} - Order ${orderId}`,
    html,
    text
  };
}
```

---

## INSTRUCTIONS TO CREATE FILES:

### Step 1: Create Directories (if not already done)
```powershell
cd "d:\Sneghalatha\AWS_Cloud_Engineer\Module-wise-Project\Project-3"
mkdir -Force src\lambdas\api-handler
mkdir -Force src\lambdas\worker
mkdir -Force src\lambdas\notifier
```

### Step 2: Create Each File

**For api-handler:**
- Create `src\lambdas\api-handler\package.json` with FILE 1 content
- Create `src\lambdas\api-handler\index.js` with FILE 2 content

**For worker:**
- Create `src\lambdas\worker\package.json` with FILE 3 content
- Create `src\lambdas\worker\index.js` with FILE 4 content

**For notifier:**
- Create `src\lambdas\notifier\package.json` with FILE 5 content
- Create `src\lambdas\notifier\index.js` with FILE 6 content

### Step 3: Install Dependencies
```powershell
cd src\lambdas\api-handler
npm install

cd ..\worker
npm install

cd ..\notifier
npm install

cd ..\..\..
```

### Step 4: Verify Structure
```powershell
tree /F src\lambdas
```

---

## Next: After Creating Files

Once you've created all 6 files and installed dependencies, run:

```powershell
sam validate --template template.yaml
sam build
```

If both commands succeed, you're ready for **PHASE 5**!

