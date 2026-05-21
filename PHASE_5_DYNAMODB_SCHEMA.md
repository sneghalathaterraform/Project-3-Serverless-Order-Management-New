# PHASE 5: DYNAMODB SCHEMA - VALIDATION & UNDERSTANDING

## Overview

Good news! ✅ **Your DynamoDB table is already defined in `template.yaml`**

I created the table configuration when we set up the SAM template. Now we need to:
1. Understand the schema
2. Validate the configuration
3. Learn about the table structure

---

## Step 5.1: Review Your DynamoDB Configuration in template.yaml

The following section in `template.yaml` defines your Orders table:

```yaml
OrdersTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub '${Environment}-orders'        # dev-orders (dev) or prod-orders (prod)
    BillingMode: PAY_PER_REQUEST                   # Pay per request (on-demand)
    AttributeDefinitions:
      - AttributeName: orderId
        AttributeType: S                            # String
      - AttributeName: customerId
        AttributeType: S                            # String
      - AttributeName: timestamp
        AttributeType: N                            # Number
    KeySchema:
      - AttributeName: orderId
        KeyType: HASH                               # Partition Key
    GlobalSecondaryIndexes:
      - IndexName: CustomerIdIndex
        KeySchema:
          - AttributeName: customerId
            KeyType: HASH                           # Partition Key
          - AttributeName: timestamp
            KeyType: RANGE                          # Sort Key
        Projection:
          ProjectionType: ALL                       # Project all attributes
    StreamSpecification:
      StreamViewType: NEW_AND_OLD_IMAGES           # Enable streams
```

---

## Step 5.2: Understand the Schema Structure

### **Primary Key: orderId**

| Attribute | Type | Purpose |
|-----------|------|---------|
| **orderId** | String (PK) | Unique identifier for each order |
| | | Generated using UUID v4 |
| | | Example: `550e8400-e29b-41d4-a716-446655440000` |

**Why orderId?**
- ✅ Globally unique
- ✅ No conflicts across all orders
- ✅ Good for direct order lookup

**Query Example:**
```
GET order with orderId = "550e8400-e29b-41d4-a716-446655440000"
Response time: ~10-20ms (very fast)
```

---

### **Global Secondary Index (GSI): CustomerIdIndex**

| Attribute | Type | Purpose |
|-----------|------|---------|
| **customerId** (Partition Key) | String | Customer identifier |
| **timestamp** (Sort Key) | Number | Order creation time (Unix timestamp) |

**Why this GSI?**
- ✅ Query all orders by customer
- ✅ Sort by most recent first (timestamp descending)
- ✅ Supports pagination

**Query Example:**
```
GET all orders where customerId = "CUST-001"
Sort by timestamp (newest first)
Response: [Order 3, Order 2, Order 1]
```

---

## Step 5.3: Complete Schema - All Attributes

Your DynamoDB orders table will have these attributes:

```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",  // Partition Key
  "customerId": "CUST-001",                             // GSI Partition Key
  "timestamp": 1684000000,                              // GSI Sort Key (Unix timestamp)
  "status": "PENDING",                                  // Order status: PENDING, PROCESSING, CONFIRMED, FAILED
  "items": [
    {
      "productId": "PROD-001",
      "productName": "Laptop",
      "quantity": 1,
      "price": 999.99
    }
  ],
  "total": 999.99,                                      // Total order amount
  "createdAt": "2024-05-20T10:30:00Z",                 // ISO timestamp
  "updatedAt": "2024-05-20T10:35:00Z",                 // Last update time
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  },
  "customerEmail": "customer@example.com",
  "trackingNumber": "TRACK-123456",                     // Optional, added after shipment
  "notes": "Fragile - Handle with care"                // Optional notes
}
```

---

## Step 5.4: Billing Mode - PAY_PER_REQUEST

### What It Means:

```
Pay per request (On-Demand):
- Price per read request: ~$0.25 per 1 million reads
- Price per write request: ~$1.25 per 1 million writes
- No upfront capacity planning
- Auto-scales with demand
- Best for: Variable workloads, unpredictable traffic
```

### Cost Example:

```
Scenario 1: 1 million orders created per month
- Write cost: 1,000,000 × ($1.25 / 1,000,000) = ~$1.25
- Read cost: 3,000,000 × ($0.25 / 1,000,000) = ~$0.75
- Total: ~$2.00/month for storage + requests

Scenario 2: 10 million orders per month
- Write cost: ~$12.50
- Read cost: ~$7.50
- Total: ~$20/month
```

### Alternatives (Not Used Here):

```
Provisioned Capacity:
- Specify read/write capacity upfront
- Pay for capacity even if unused
- Better for predictable, high-volume workloads
```

---

## Step 5.5: DynamoDB Streams - NEW_AND_OLD_IMAGES

### What It Captures:

```yaml
StreamViewType: NEW_AND_OLD_IMAGES

Captures:
- NEW_IMAGE: New item after update
- OLD_IMAGE: Previous item before update
- Both image types in each stream record
```

### Use Cases:

```
1. Trigger Lambda on order updates
2. Audit trail - track all changes
3. Replicate to data warehouse
4. Real-time analytics
5. Send notifications on status change
```

### Example Stream Record:

```json
{
  "eventName": "MODIFY",
  "dynamodb": {
    "Keys": {
      "orderId": { "S": "550e8400-e29b-41d4-a716-446655440000" }
    },
    "NewImage": {
      "status": { "S": "CONFIRMED" },
      "updatedAt": { "S": "2024-05-20T10:35:00Z" }
    },
    "OldImage": {
      "status": { "S": "PENDING" },
      "updatedAt": { "S": "2024-05-20T10:30:00Z" }
    }
  }
}
```

---

## Step 5.6: Table Capacity & Performance

### Expected Performance:

| Operation | Latency | Notes |
|-----------|---------|-------|
| Put Item | 10-20ms | Write single order |
| Get Item | 10-20ms | Retrieve by orderId |
| Query GSI | 20-50ms | Get orders by customer (up to 1MB) |
| Scan | 100-500ms | Scan all items (avoid in production) |
| Update Item | 15-25ms | Update order status |

### Scaling:

```
On-demand means:
- 0 requests → $0 charge
- 1,000 requests → proportional charge
- 1,000,000 requests → auto-scales, proportional charge
No provisioning needed!
```

---

## Step 5.7: Verify Table Definition in Code

Open your `template.yaml` file and verify:

```powershell
# Navigate to project root
cd "d:\Sneghalatha\AWS_Cloud_Engineer\Module-wise-Project\Project-3"

# Open template.yaml to view DynamoDB section
# Line 31-79 contains the OrdersTable definition

# Or search for OrdersTable
Select-String -Path template.yaml -Pattern "OrdersTable" -Context 5,10
```

Expected output should show the OrdersTable resource definition.

---

## Step 5.8: Access Patterns Supported

Your schema supports these query patterns:

### **Pattern 1: Get Single Order**
```
Access by: orderId (Primary Key)
Latency: 10-20ms
DynamoDB: GetItem
Code:
  const result = await dynamodb.get({
    TableName: ORDERS_TABLE,
    Key: { orderId }
  }).promise();
```

### **Pattern 2: List Customer Orders**
```
Access by: customerId + timestamp
Latency: 20-50ms
DynamoDB: Query on GSI
Code:
  const result = await dynamodb.query({
    TableName: ORDERS_TABLE,
    IndexName: 'CustomerIdIndex',
    KeyConditionExpression: 'customerId = :cid',
    ExpressionAttributeValues: { ':cid': 'CUST-001' },
    ScanIndexForward: false  // Most recent first
  }).promise();
```

### **Pattern 3: List All Orders (Admin)**
```
Access by: Scan all items
Latency: 100-500ms (avoid for large tables)
DynamoDB: Scan
Code:
  const result = await dynamodb.scan({
    TableName: ORDERS_TABLE
  }).promise();
```

---

## Step 5.9: No Additional Action Needed

✅ **The DynamoDB table will be created automatically when you deploy SAM**

You don't need to manually create it! The `sam deploy` command will:
1. Read `template.yaml`
2. See the OrdersTable resource
3. Create the table in your AWS account
4. Configure all indexes and streams
5. Set up proper permissions

---

## Step 5.10: DynamoDB Best Practices Implemented ✅

| Best Practice | Implementation |
|---------------|-----------------|
| **Unique Primary Key** | ✅ orderId (UUID) |
| **Partition Key Distribution** | ✅ UUID ensures even distribution |
| **Efficient Queries** | ✅ GSI on customerId + timestamp |
| **Projections** | ✅ ProjectAll for GSI (all attributes available) |
| **Streams** | ✅ Enabled for NEW_AND_OLD_IMAGES |
| **Scalability** | ✅ On-demand billing mode |
| **Cost Optimization** | ✅ Pay only for what you use |

---

## Step 5.11: Schema Validation Checklist

Run this in PowerShell to validate the template syntax:

```powershell
# Navigate to project root
cd "d:\Sneghalatha\AWS_Cloud_Engineer\Module-wise-Project\Project-3"

# Validate SAM template
sam validate --template template.yaml

# Expected output:
# template.yaml is valid
```

---

## 📊 DynamoDB Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              DynamoDB Orders Table                          │
│                 (dev-orders)                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Primary Key (HASH):                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ orderId (String)                                    │  │
│  │ Example: 550e8400-e29b-41d4-a716-446655440000     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Other Attributes:                                         │
│  • customerId (String)                                    │
│  • timestamp (Number)                                     │
│  • status (String)                                        │
│  • items (List)                                           │
│  • total (Number)                                         │
│  • shippingAddress (Map)                                  │
│  • customerEmail (String)                                 │
│  • createdAt (String)                                     │
│  • updatedAt (String)                                     │
│  • trackingNumber (String - optional)                     │
│  • notes (String - optional)                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Global Secondary Index: CustomerIdIndex                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Partition Key: customerId (String)                  │  │
│  │ Sort Key: timestamp (Number)                        │  │
│  │ Projection: ALL attributes                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Enables Query: Get all orders by customer (sorted)        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Billing: PAY_PER_REQUEST (On-Demand)                      │
│  Streams: NEW_AND_OLD_IMAGES enabled                       │
├─────────────────────────────────────────────────────────────┤
```

---

## ✅ Phase 5 Complete!

Your DynamoDB schema is:
- ✅ Defined in template.yaml
- ✅ Optimized for access patterns
- ✅ Cost-effective (on-demand billing)
- ✅ Scalable (auto-scaling)
- ✅ Observable (streams enabled)

---

## ⏭️ Next Steps: PHASE 6 & 7

Your infrastructure components are now complete:
1. ✅ template.yaml (defines: DynamoDB, S3, SNS, SQS, Lambda, API Gateway, CloudFront)
2. ✅ Lambda functions (api-handler, worker, notifier)
3. ✅ DynamoDB schema (Orders table with GSI)

**Next: PHASE 6 - Build & Deploy**

Run these commands:
```powershell
# Validate everything
sam validate --template template.yaml

# Build SAM (prepares code + dependencies)
sam build

# Deploy to AWS
sam deploy --guided
```

Ready to continue? 🚀
