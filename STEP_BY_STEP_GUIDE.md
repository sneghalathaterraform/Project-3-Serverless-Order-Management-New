# Serverless Event-Driven Order Processing System - Step-by-Step Guide

## Project Overview
This guide will help you build a fully serverless, event-driven order processing system using AWS SAM + Node.js that includes:
- Real-time order processing via API Gateway
- Async workflows using SNS/SQS
- Order data storage in DynamoDB
- Image uploads via presigned S3 URLs
- CloudFront distribution for frontend
- Private Lambda execution via VPC endpoints

---

## PHASE 1: PREREQUISITES & SETUP (30-45 minutes)

### Step 1.1: Install Required Tools
Run these commands in PowerShell (as Administrator):

```powershell
# 1. Install AWS CLI v2
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# 2. Install AWS SAM CLI using pip
pip install aws-sam-cli --upgrade

# 3. Install Node.js (if not already installed)
# Download from https://nodejs.org/ (LTS version 18+)

# 4. Verify installations
aws --version
sam --version
node --version
npm --version
```

**Expected Output:**
```
AWS CLI 2.x.x
AWS SAM CLI 1.x.x
node v18.x.x
npm 9.x.x
```

### Step 1.2: Configure AWS Credentials

```powershell
# Configure AWS credentials
aws configure

# You will be prompted for:
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region: us-east-1
# Default output format: json
```

**Get AWS Credentials:**
1. Go to AWS Console → IAM → Users → Your User
2. Create access key
3. Save Access Key ID & Secret Access Key
4. Use them in `aws configure`

### Step 1.3: Verify AWS Access

```powershell
# Test AWS connection
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "XXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-user"
# }
```

✅ **Phase 1 Complete!**

---

## PHASE 2: PROJECT STRUCTURE & INITIALIZATION (15 minutes)

### Step 2.1: Create Project Directory Structure

Navigate to your project folder:

```powershell
cd d:\Sneghalatha\AWS_Cloud_Engineer\Module-wise-Project\Project-3

# Create folder structure
mkdir src\lambdas\api-handler
mkdir src\lambdas\worker
mkdir src\lambdas\notifier
mkdir src\frontend\public
mkdir src\frontend\src
mkdir config
mkdir tests
mkdir scripts
mkdir docs

# Verify structure
tree /F
```

### Step 2.2: Initialize Git Repository (Optional but Recommended)

```powershell
# Initialize git
git init

# Create .gitignore
@"
.aws-sam/
build/
dist/
.DS_Store
*.log
node_modules/
.env
.env.local
sam.yaml
samconfig.toml
"@ | Out-File -FilePath .gitignore -Encoding UTF8

# Initial commit
git add .
git commit -m "Initial project structure"
```

### Step 2.3: Initialize SAM Application

```powershell
# Note: We'll use our custom template.yaml instead of sam init
# Just verify SAM is working
sam --version

# Create samconfig.toml for deployment configuration
@"
version = 0.1

[default.deploy.parameters]
stack_name = "serverless-order-app"
s3_bucket = "auto"
s3_prefix = "serverless-order-app"
region = "us-east-1"
confirm_changeset = false
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Environment=dev"
"@ | Out-File -FilePath samconfig.toml -Encoding UTF8
```

✅ **Phase 2 Complete!**

---

## PHASE 3: INFRASTRUCTURE AS CODE - SAM TEMPLATE (20 minutes)

### Step 3.1: Create SAM Template (template.yaml)

Create `template.yaml` in the project root with DynamoDB, S3, SNS, SQS, and Lambda configurations.

**Key Components:**
- **DynamoDB**: Orders table with GSI for customer queries
- **S3 Buckets**: One for images, one for frontend
- **SNS/SQS**: For async order processing
- **Lambda**: API handler, worker, notifier
- **API Gateway**: REST API endpoints
- **CloudFront**: CDN for frontend

```yaml
# See template.yaml file in project root
# This includes all infrastructure definitions
```

### Step 3.2: Validate SAM Template

```powershell
# Validate template syntax
sam validate --template template.yaml

# Expected output:
# template.yaml is valid
```

### Step 3.3: Build SAM Project

```powershell
# Build the SAM application (this prepares Lambda code)
sam build --use-container

# This will:
# - Install dependencies for each Lambda function
# - Package code for deployment
# - Create .aws-sam/build directory
```

✅ **Phase 3 Complete!**

---

## PHASE 4: LAMBDA FUNCTIONS - NODE.JS CODE (45 minutes)

### Step 4.1: API Handler Lambda (CRUD Operations)

Create file: `src/lambdas/api-handler/package.json`

```json
{
  "name": "api-handler",
  "version": "1.0.0",
  "description": "API Handler for order management",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0",
    "uuid": "^9.0.0"
  }
}
```

Create file: `src/lambdas/api-handler/index.js`

**Functions:**
- `createOrder()` - POST /orders
- `getOrder()` - GET /orders/{orderId}
- `listOrders()` - GET /orders?customerId=xxx
- `getPresignedUrl()` - POST /upload-url

**Key Logic:**
```javascript
- Validate input
- Generate unique orderId using UUID
- Save order to DynamoDB
- Send message to SQS for async processing
- Return presigned URL for S3 uploads
```

### Step 4.2: Worker Lambda (Process Orders - SQS Trigger)

Create file: `src/lambdas/worker/package.json`

```json
{
  "name": "worker",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0"
  }
}
```

Create file: `src/lambdas/worker/index.js`

**Functions:**
- `handler()` - Triggered by SQS messages
- `processOrder()` - Update order status, validate inventory
- `publishNotification()` - Send to SNS topic

**Key Logic:**
```javascript
- Receive message from SQS
- Parse order data
- Simulate order processing (validation, inventory check)
- Update DynamoDB with new status (PROCESSING → CONFIRMED/FAILED)
- Publish event to SNS topic
- Send message to SQS completion
```

### Step 4.3: Notifier Lambda (Email/SMS - SNS Trigger)

Create file: `src/lambdas/notifier/package.json`

```json
{
  "name": "notifier",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0"
  }
}
```

Create file: `src/lambdas/notifier/index.js`

**Functions:**
- `handler()` - Triggered by SNS messages
- `sendNotification()` - Send email via SES

**Key Logic:**
```javascript
- Receive SNS notification
- Extract order details
- Format email/SMS message
- Send via SES (Simple Email Service)
- Log notification status
```

### Step 4.4: Install Dependencies for All Lambda Functions

```powershell
# Navigate to each lambda directory and install dependencies

cd src/lambdas/api-handler
npm install
cd ../..

cd src/lambdas/worker
npm install
cd ../..

cd src/lambdas/notifier
npm install
cd ../..

# Go back to project root
cd ../../
```

✅ **Phase 4 Complete!**

---

## PHASE 5: DYNAMODB SCHEMA & SETUP (15 minutes)

### Step 5.1: Create Orders Table Schema

**Table Name:** `dev-orders` (or `prod-orders` for production)

**Primary Key:**
- **Partition Key:** `orderId` (String) - Unique identifier
- **Sort Key:** None (we use GSI for customer queries)

**Global Secondary Index (GSI):**
- **Index Name:** `CustomerIdIndex`
- **Partition Key:** `customerId` (String)
- **Sort Key:** `timestamp` (Number)
- **Projection:** All attributes

**Attributes:**
```
{
  orderId: string (PK),
  customerId: string,
  timestamp: number,
  status: string (PENDING, PROCESSING, CONFIRMED, SHIPPED, DELIVERED, FAILED),
  items: [
    {
      productId: string,
      productName: string,
      quantity: number,
      price: number
    }
  ],
  total: number,
  createdAt: string (ISO timestamp),
  updatedAt: string (ISO timestamp),
  shippingAddress: {
    street: string,
    city: string,
    state: string,
    zip: string,
    country: string
  },
  customerEmail: string,
  trackingNumber: string (optional),
  notes: string (optional)
}
```

### Step 5.2: Billing Mode

- **Billing Mode:** PAY_PER_REQUEST (On-demand)
  - Best for variable workloads
  - No upfront capacity planning
  - Pay only for what you use

### Step 5.3: Enable Streaming (Optional)

- **DynamoDB Streams:** NEW_AND_OLD_IMAGES
- Captures all data modifications
- Can trigger Lambda functions on table changes

✅ **Phase 5 Complete!**

---

## PHASE 6: SNS/SQS CONFIGURATION (10 minutes)

### Step 6.1: SQS Queue Setup

**Queue Name:** `dev-order-processing-queue`

**Configuration:**
```
- Visibility Timeout: 300 seconds (5 minutes)
- Message Retention Period: 86400 seconds (1 day)
- Receive Message Wait Time: 20 seconds (long polling)
- Dead Letter Queue (DLQ): dev-order-processing-dlq
  - Max Receive Count: 3
```

**Message Format (JSON):**
```json
{
  "action": "PROCESS_ORDER",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "CUST-001",
  "timestamp": 1684000000
}
```

### Step 6.2: SNS Topic Setup

**Topic Name:** `dev-order-notifications`

**Event Publishing:**
- Order Status Changed
- Order Shipped
- Order Delivered
- Order Failed

**Message Format (JSON):**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "CUST-001",
  "status": "CONFIRMED",
  "message": "Your order has been confirmed",
  "timestamp": "2024-05-20T10:30:00Z"
}
```

### Step 6.3: Connect Notifier Lambda to SNS

- When order notification is published to SNS topic
- Notifier Lambda is automatically triggered
- Sends email notification to customer

✅ **Phase 6 Complete!**

---

## PHASE 7: S3 & CLOUDFRONT SETUP (15 minutes)

### Step 7.1: S3 Buckets

**Bucket 1: Image Storage**
```
Name: {account-id}-order-images-dev
Purpose: Store order images/attachments
Versioning: Enabled
Access: Private (via presigned URLs)
CORS: Enabled
```

**Bucket 2: Frontend**
```
Name: {account-id}-order-app-frontend-dev
Purpose: Host React frontend
Static Website: Enabled
Index Document: index.html
Error Document: index.html
Access: Private (accessed via CloudFront)
```

### Step 7.2: CloudFront Configuration

**Distribution:**
```
Default Root Object: index.html
Origins:
  1. S3 Frontend Bucket (for static files)
  2. API Gateway (for /api/* requests)

Behaviors:
  - *.html, *.css, *.js → Cache
  - /api/* → No cache (forward all headers/cookies)
  
Protocols: HTTPS only
```

### Step 7.3: Presigned URLs for Uploads

```javascript
// In API Handler Lambda
const presignedUrl = s3.getSignedUrl('putObject', {
  Bucket: 'order-images-bucket',
  Key: `orders/${orderId}/${fileName}`,
  ContentType: fileType,
  Expires: 3600 // 1 hour
});
```

**Why Presigned URLs?**
- Clients upload directly to S3
- No data passes through Lambda (cost savings)
- Automatic expiration (1 hour)
- Secure and scalable

✅ **Phase 7 Complete!**

---

## PHASE 8: REACT FRONTEND SETUP (30 minutes)

### Step 8.1: Create React App

```powershell
# Navigate to frontend directory
cd src/frontend

# Create React app using Create React App
npx create-react-app . --template minimal

# Or use Vite (faster alternative)
npm create vite@latest . -- --template react
npm install
```

### Step 8.2: Key Frontend Pages

**1. Create Order Page**
- Form for customer info, items, shipping address
- POST to `/api/orders`
- Display order confirmation

**2. Order Status Page**
- Display orders by customer
- GET `/api/orders?customerId=xxx`
- Real-time status updates

**3. Image Upload Page**
- Request presigned URL
- Upload image directly to S3
- Link image to order

**4. Order History Page**
- List all past orders
- Filter by status
- Download receipts

### Step 8.3: API Integration

```javascript
// Example API calls
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// Create order
const createOrder = async (orderData) => {
  const response = await fetch(`${API_ENDPOINT}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(orderData)
  });
  return response.json();
};

// Get presigned URL
const getUploadUrl = async (orderId, fileName) => {
  const response = await fetch(`${API_ENDPOINT}/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ orderId, fileName, fileType: 'image/jpeg' })
  });
  return response.json();
};
```

### Step 8.4: Environment Variables

Create `.env` file:
```
REACT_APP_API_ENDPOINT=https://your-api-endpoint.execute-api.us-east-1.amazonaws.com/dev
REACT_APP_API_KEY=your-api-key-here
```

### Step 8.5: Build Frontend

```powershell
# Build production bundle
npm run build

# Output goes to 'build' directory
# This gets deployed to S3
```

✅ **Phase 8 Complete!**

---

## PHASE 9: DEPLOYMENT WITH SAM (20 minutes)

### Step 9.1: Build SAM Application

```powershell
# Go to project root
cd d:\Sneghalatha\AWS_Cloud_Engineer\Module-wise-Project\Project-3

# Build with container
sam build --use-container

# Or build locally (if Node.js 18 is available)
sam build
```

### Step 9.2: Deploy to AWS

```powershell
# Deploy with guided prompts
sam deploy --guided

# You will be prompted for:
# Stack Name: serverless-order-app
# Region: us-east-1
# Parameter Environment: dev
# Confirm changes before deploy: Y
# Allow SAM CLI IAM role: Y
# Save parameters: Y

# Or use automatic deployment
sam deploy --stack-name serverless-order-app \
           --region us-east-1 \
           --parameter-overrides Environment=dev \
           --capabilities CAPABILITY_IAM
```

### Step 9.3: Check Deployment Status

```powershell
# View CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name serverless-order-app \
  --region us-east-1

# View stack outputs
aws cloudformation describe-stacks \
  --stack-name serverless-order-app \
  --query 'Stacks[0].Outputs' \
  --region us-east-1
```

### Step 9.4: Note API Endpoint & Outputs

From CloudFormation stack outputs, copy:
- API Endpoint URL
- CloudFront Domain Name
- DynamoDB Table Name
- S3 Bucket Names

### Step 9.5: Deploy Frontend to S3

```powershell
# Build React app
cd src/frontend
npm run build

# Get frontend bucket name from CloudFormation outputs
$FRONTEND_BUCKET = "your-frontend-bucket-name"

# Upload to S3
aws s3 sync build/ s3://$FRONTEND_BUCKET/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

✅ **Phase 9 Complete!**

---

## PHASE 10: TESTING & VALIDATION (30 minutes)

### Step 10.1: Test API Endpoints Using Postman/curl

**Test 1: Create Order**
```powershell
$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    "customerId" = "CUST-001"
    "customerEmail" = "customer@example.com"
    "items" = @(
        @{
            "productId" = "PROD-001"
            "productName" = "Product A"
            "quantity" = 2
            "price" = 29.99
        }
    )
    "shippingAddress" = @{
        "street" = "123 Main St"
        "city" = "New York"
        "state" = "NY"
        "zip" = "10001"
        "country" = "USA"
    }
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://your-api-endpoint/dev/orders" `
  -Method POST `
  -Headers $headers `
  -Body $body

$response | ConvertTo-Json
```

**Test 2: Get Order**
```powershell
$orderId = "550e8400-e29b-41d4-a716-446655440000"

$response = Invoke-RestMethod -Uri "https://your-api-endpoint/dev/orders/$orderId" `
  -Method GET

$response | ConvertTo-Json
```

**Test 3: List Customer Orders**
```powershell
$response = Invoke-RestMethod -Uri "https://your-api-endpoint/dev/orders?customerId=CUST-001" `
  -Method GET

$response | ConvertTo-Json
```

**Test 4: Get Presigned URL**
```powershell
$body = @{
    "orderId" = "550e8400-e29b-41d4-a716-446655440000"
    "fileName" = "receipt.jpg"
    "fileType" = "image/jpeg"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://your-api-endpoint/dev/upload-url" `
  -Method POST `
  -Body $body

$response | ConvertTo-Json
```

### Step 10.2: Monitor Logs

```powershell
# View API Handler Lambda logs
aws logs tail /aws/lambda/dev-api-handler --follow

# View Worker Lambda logs
aws logs tail /aws/lambda/dev-order-worker --follow

# View Notifier Lambda logs
aws logs tail /aws/lambda/dev-order-notifier --follow
```

### Step 10.3: Check DynamoDB

```powershell
# Scan orders table
aws dynamodb scan --table-name dev-orders --region us-east-1

# Query by customer
aws dynamodb query --table-name dev-orders \
  --index-name CustomerIdIndex \
  --key-condition-expression "customerId = :cid" \
  --expression-attribute-values '{":cid":{"S":"CUST-001"}}' \
  --region us-east-1
```

### Step 10.4: Monitor SQS & SNS

```powershell
# Check SQS queue messages
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/{account-id}/dev-order-processing-queue

# Publish test message to SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:{account-id}:dev-order-notifications \
  --message '{"orderId":"test","status":"CONFIRMED"}'
```

### Step 10.5: Test Frontend

```powershell
# Get CloudFront URL from outputs
# Open in browser: https://your-cloudfront-url

# Test creating order from UI
# Test uploading image
# Test viewing order status
```

✅ **Phase 10 Complete!**

---

## PHASE 11: CLEANUP & BEST PRACTICES (10 minutes)

### Step 11.1: Delete Stack (When Done Testing)

```powershell
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name serverless-order-app \
  --region us-east-1

# Watch deletion progress
aws cloudformation describe-stacks \
  --stack-name serverless-order-app \
  --region us-east-1
```

### Step 11.2: Best Practices Implemented

✅ **Serverless**: No servers to manage  
✅ **Event-Driven**: Asynchronous order processing  
✅ **Scalable**: Auto-scales with demand  
✅ **Cost-Effective**: Pay-per-use pricing  
✅ **Secure**: Private Lambda functions, IAM roles, presigned URLs  
✅ **Resilient**: DLQ for failed messages, retries  
✅ **Observable**: CloudWatch logs, X-Ray tracing  
✅ **Fast**: CloudFront CDN for frontend  

### Step 11.3: Production Checklist

- [ ] Set up custom domain (Route 53)
- [ ] Enable AWS WAF for API Gateway
- [ ] Configure DLQ alarms
- [ ] Set up CloudWatch dashboards
- [ ] Enable X-Ray tracing
- [ ] Configure VPC endpoints for private access
- [ ] Enable encryption at rest (DynamoDB, S3)
- [ ] Set up backup strategy for DynamoDB
- [ ] Configure Lambda reserved concurrency
- [ ] Set up cost anomaly alerts

✅ **Phase 11 Complete!**

---

## QUICK REFERENCE - AWS CLI COMMANDS

```powershell
# Deployment
sam build
sam deploy --guided
sam deploy --stack-name serverless-order-app --region us-east-1

# View outputs
aws cloudformation describe-stacks --stack-name serverless-order-app --query 'Stacks[0].Outputs'

# Test API
Invoke-RestMethod -Uri $API_ENDPOINT -Method POST -Body $json

# View logs
aws logs tail /aws/lambda/dev-api-handler --follow

# Query DynamoDB
aws dynamodb scan --table-name dev-orders
aws dynamodb query --table-name dev-orders --index-name CustomerIdIndex ...

# Check SQS
aws sqs receive-message --queue-url $QUEUE_URL

# Publish SNS
aws sns publish --topic-arn $TOPIC_ARN --message $message

# Deploy frontend
aws s3 sync build/ s3://$BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id $ID --paths "/*"

# Cleanup
aws cloudformation delete-stack --stack-name serverless-order-app
```

---

## ARCHITECTURE DIAGRAM SUMMARY

```
┌─────────────────────────────────────────────────────────────┐
│                        USER (Browser)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │    CloudFront (CDN)           │
         │  ├─ Static files (HTML/CSS/JS)│
         │  └─ API requests to API Gateway│
         └────────────────┬──────────────┘
                          │
              ┌───────────┴──────────────┐
              ▼                          ▼
    ┌──────────────────┐      ┌──────────────────────┐
    │  S3 Frontend     │      │  API Gateway + Auth  │
    │  Bucket          │      │  ├─ POST /orders     │
    │                  │      │  ├─ GET /orders/{id} │
    │                  │      │  ├─ GET /orders      │
    └──────────────────┘      │  └─ POST /upload-url │
                              └──────────────┬───────┘
                                             │
                                             ▼
                                ┌─────────────────────────┐
                                │  Lambda: API Handler    │
                                │  ├─ Validate request    │
                                │  ├─ Save to DynamoDB    │
                                │  ├─ Send to SQS         │
                                │  └─ Return presigned URL│
                                └──────────────┬──────────┘
                    ┌───────────────┬──────────┴─────────────┐
                    │               │                        │
                    ▼               ▼                        ▼
        ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
        │   DynamoDB       │  │ SQS Queue    │  │  S3 Image        │
        │   Orders Table   │  │              │  │  Bucket          │
        │                  │  │ (Async work) │  │                  │
        └──────────────────┘  └────────┬─────┘  └──────────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ Lambda: Worker  │
                             │ ├─ Process order│
                             │ ├─ Update status│
                             │ └─ Publish SNS  │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │  SNS Topic      │
                             │                 │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ Lambda: Notifier│
                             │ ├─ Send email   │
                             │ └─ Send SMS     │
                             └─────────────────┘
```

---

## TOTAL ESTIMATED TIME
- Phase 1 (Setup): 30-45 minutes
- Phase 2 (Structure): 15 minutes
- Phase 3 (SAM Template): 20 minutes
- Phase 4 (Lambda): 45 minutes
- Phase 5 (DynamoDB): 15 minutes
- Phase 6 (SNS/SQS): 10 minutes
- Phase 7 (S3/CloudFront): 15 minutes
- Phase 8 (Frontend): 30 minutes
- Phase 9 (Deployment): 20 minutes
- Phase 10 (Testing): 30 minutes
- Phase 11 (Cleanup): 10 minutes

**Total: 3-4 hours**

---

## NEXT STEPS
1. Start with Phase 1 (Prerequisites)
2. Follow each phase sequentially
3. Test after each major phase
4. Move to Phase 9 (Deployment) only after code is ready
5. Use Phase 10 for comprehensive testing
6. Document any issues in `/docs` folder

Good luck! 🚀
