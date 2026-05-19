// ─────────────────────────────────────────────
// Libraries to talk to AWS services
// ─────────────────────────────────────────────
const { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// ─────────────────────────────────────────────
// Connect to DynamoDB and S3
// Region is automatically read from Lambda env
// ─────────────────────────────────────────────
const dynamo = new DynamoDBClient({});
const s3     = new S3Client({});

// Read environment variables set in lambda.tf
const TABLE  = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.IMAGES_BUCKET;

// ─────────────────────────────────────────────
// Main handler — runs on every API request
// Decides what to do based on method + path
// ─────────────────────────────────────────────
exports.handler = async (event) => {
  const method = event.httpMethod;
  const path   = event.path;

  try {
    // POST /v1/inspections → create new inspection
    if (method === "POST" && path.endsWith("/inspections")) {
      return await createInspection(JSON.parse(event.body));
    }

    // GET /v1/inspections → list all inspections
    if (method === "GET" && path.endsWith("/inspections")) {
      return await listInspections();
    }

    // GET /v1/inspections/{id} → get one inspection
    if (method === "GET" && event.pathParameters?.id) {
      return await getInspection(event.pathParameters.id);
    }

    return response(404, { message: "Route not found" });

  } catch (err) {
    console.error("Error:", err);
    return response(500, { message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// Create a new inspection
// Saves to DynamoDB + returns a presigned S3 URL
// so the user can upload their photo directly
// ─────────────────────────────────────────────
async function createInspection(data) {
  // Generate a unique ID using built-in Node.js crypto
  const { randomUUID } = require("crypto");
  const id       = randomUUID();
  const imageKey = `inspections/${id}/photo.jpg`;
  const now      = new Date().toISOString();

  // Save inspection record to DynamoDB
  await dynamo.send(new PutItemCommand({
    TableName: TABLE,
    Item: {
      id:          { S: id },
      title:       { S: data.title       || "Untitled" },
      description: { S: data.description || "" },
      status:      { S: "pending" },
      imageKey:    { S: imageKey },
      createdAt:   { S: now }
    }
  }));

  // Generate a temporary upload URL (valid for 15 minutes)
  // User uploads photo directly to S3 using this URL
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: imageKey, ContentType: "image/jpeg" }),
    { expiresIn: 900 }
  );

  return response(201, { id, uploadUrl });
}

// ─────────────────────────────────────────────
// Get one inspection by ID
// ─────────────────────────────────────────────
async function getInspection(id) {
  const result = await dynamo.send(new GetItemCommand({
    TableName: TABLE,
    Key: { id: { S: id } }
  }));

  if (!result.Item) return response(404, { message: "Inspection not found" });
  return response(200, flatten(result.Item));
}

// ─────────────────────────────────────────────
// List all inspections
// ─────────────────────────────────────────────
async function listInspections() {
  const result = await dynamo.send(new ScanCommand({ TableName: TABLE }));
  return response(200, { items: result.Items.map(flatten) });
}

// ─────────────────────────────────────────────
// Helper — converts DynamoDB format to plain JSON
// DynamoDB returns { id: { S: "abc" } }
// This converts it to  { id: "abc" }
// ─────────────────────────────────────────────
function flatten(item) {
  return Object.fromEntries(
    Object.entries(item).map(([key, val]) => [key, Object.values(val)[0]])
  );
}

// ─────────────────────────────────────────────
// Helper — builds a standard HTTP response
// ─────────────────────────────────────────────
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
