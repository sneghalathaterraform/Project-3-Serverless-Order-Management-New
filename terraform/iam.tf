# ═══════════════════════════════════════════════
# ROLE 1 — API Handler Lambda
# Handles incoming API requests from users
# ═══════════════════════════════════════════════

# ─────────────────────────────────────────────
# The role itself — allows Lambda service
# to use this role (like issuing the badge)
# ─────────────────────────────────────────────
resource "aws_iam_role" "api_handler" {
  name = "${var.project_name}-api-handler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Permissions attached to the role
# What the API Handler Lambda is allowed to do
# ─────────────────────────────────────────────
resource "aws_iam_role_policy" "api_handler" {
  name = "${var.project_name}-api-handler-policy"
  role = aws_iam_role.api_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Write logs to CloudWatch so you can debug
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        # Upload and read inspection photos in S3
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.images.arn}/*"
      },
      {
        # Read and write inspection records in DynamoDB
        # Table is managed separately — we reference it by name
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/inspections"
      },
      {
        # Required for Lambda running inside a VPC
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}


# ═══════════════════════════════════════════════
# ROLE 2 — SQS Worker Lambda
# Processes photos after they are uploaded
# ═══════════════════════════════════════════════

resource "aws_iam_role" "sqs_worker" {
  name = "${var.project_name}-sqs-worker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "sqs_worker" {
  name = "${var.project_name}-sqs-worker-policy"
  role = aws_iam_role.sqs_worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Write logs to CloudWatch
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        # Read and delete messages from SQS queue
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.inspection_processing.arn
      },
      {
        # Read and update photos in S3
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.images.arn}/*"
      },
      {
        # Update inspection status in DynamoDB
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/inspections"
      },
      {
        # Required for Lambda running inside a VPC
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}
