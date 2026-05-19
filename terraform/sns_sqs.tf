# ─────────────────────────────────────────────
# SNS Topic — the announcer
# S3 publishes here when a photo is uploaded
# ─────────────────────────────────────────────
resource "aws_sns_topic" "inspection_uploads" {
  name = "${var.project_name}-inspection-uploads"

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# SNS Topic Policy
# Gives S3 permission to publish to this topic
# ─────────────────────────────────────────────
resource "aws_sns_topic_policy" "s3_publish" {
  arn = aws_sns_topic.inspection_uploads.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3Publish"
        Effect = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.inspection_uploads.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = aws_s3_bucket.images.arn
          }
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────
# SQS Dead Letter Queue
# Catches failed messages after 3 retries
# ─────────────────────────────────────────────
resource "aws_sqs_queue" "inspection_processing_dlq" {
  name                      = "${var.project_name}-inspection-processing-dlq"
  message_retention_seconds = 1209600

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# SQS Queue — the waiting room
# ─────────────────────────────────────────────
resource "aws_sqs_queue" "inspection_processing" {
  name                       = "${var.project_name}-inspection-processing"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inspection_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# SQS Queue Policy
# Gives SNS permission to send messages to SQS
# ─────────────────────────────────────────────
resource "aws_sqs_queue_policy" "inspection_processing" {
  queue_url = aws_sqs_queue.inspection_processing.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.inspection_processing.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.inspection_uploads.arn
          }
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────
# SNS → SQS Subscription
# Connects SNS topic to SQS queue
# ─────────────────────────────────────────────
resource "aws_sns_topic_subscription" "sqs" {
  topic_arn = aws_sns_topic.inspection_uploads.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.inspection_processing.arn
}
