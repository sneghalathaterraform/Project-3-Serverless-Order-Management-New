// ─────────────────────────────────────────────
// Libraries to talk to AWS services
// ─────────────────────────────────────────────
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, HeadObjectCommand }       = require("@aws-sdk/client-s3");

// ─────────────────────────────────────────────
// Connect to DynamoDB and S3
// ─────────────────────────────────────────────
const dynamo = new DynamoDBClient({});
const s3     = new S3Client({});

// Read environment variables set in lambda.tf
const TABLE  = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.IMAGES_BUCKET;

// ─────────────────────────────────────────────
// Main handler — runs when SQS sends messages
// Each message = one photo was uploaded to S3
// ─────────────────────────────────────────────
exports.handler = async (event) => {
  console.log(`Received ${event.Records.length} messages from SQS`);

  // Process all messages — collect results
  const results = await Promise.allSettled(
    event.Records.map(processRecord)
  );

  // Count how many failed
  const failed = results.filter(r => r.status === "rejected");

  if (failed.length > 0) {
    // Throwing an error tells SQS to retry these messages
    // After 3 retries they go to the Dead Letter Queue
    throw new Error(`${failed.length} message(s) failed — will retry`);
  }
};

// ─────────────────────────────────────────────
// Process one SQS message
// Message comes from SNS which came from S3
// So we unwrap two layers: SQS → SNS → S3 event
// ─────────────────────────────────────────────
async function processRecord(sqsRecord) {
  // Unwrap SNS message from SQS body
  const snsMessage = JSON.parse(sqsRecord.body);

  // Unwrap S3 event from SNS message
  const s3Event = JSON.parse(snsMessage.Message);

  for (const s3Record of s3Event.Records) {
    // Get the file key (path) of the uploaded photo
    const key = decodeURIComponent(
      s3Record.s3.object.key.replace(/\+/g, " ")
    );

    // Extract inspection ID from the path
    // Path format: inspections/{id}/photo.jpg
    const inspectionId = key.split("/")[1];

    console.log(`Processing photo for inspection: ${inspectionId}`);
    console.log(`Photo location: ${key}`);

    // ── Step 1: Verify the photo actually exists in S3 ──
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key:    key
    }));

    // ── Step 2: Update inspection status in DynamoDB ──
    // Changes status from "pending" → "processed"
    await dynamo.send(new UpdateItemCommand({
      TableName: TABLE,
      Key: { id: { S: inspectionId } },
      UpdateExpression:          "SET #s = :status, processedAt = :time",
      ExpressionAttributeNames:  { "#s": "status" },
      ExpressionAttributeValues: {
        ":status": { S: "processed" },
        ":time":   { S: new Date().toISOString() }
      }
    }));

    console.log(`Inspection ${inspectionId} marked as processed`);
  }
}
