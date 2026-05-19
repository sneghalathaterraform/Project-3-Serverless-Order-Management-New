# ─────────────────────────────────────────────
# Package the api_handler code into a ZIP file
# Terraform reads the folder and zips it
# ─────────────────────────────────────────────
data "archive_file" "api_handler" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src/api_handler"
  output_path = "${path.module}/.build/api_handler.zip"
}

# ─────────────────────────────────────────────
# Package the sqs_worker code into a ZIP file
# ─────────────────────────────────────────────
data "archive_file" "sqs_worker" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src/sqs_worker"
  output_path = "${path.module}/.build/sqs_worker.zip"
}

# ═══════════════════════════════════════════════
# LAMBDA 1 — API Handler
# Runs when API Gateway receives a request
# ═══════════════════════════════════════════════
resource "aws_lambda_function" "api_handler" {
  filename         = data.archive_file.api_handler.output_path
  source_code_hash = data.archive_file.api_handler.output_base64sha256
  function_name    = "${var.project_name}-api-handler"
  role             = aws_iam_role.api_handler.arn
  handler          = "index.handler"   # Run handler() inside index.js
  runtime          = "nodejs20.x"
  timeout          = 30                # Stop if takes longer than 30 seconds
  memory_size      = 256               # 256 MB of memory

  # Environment variables — available inside the Lambda code
  environment {
    variables = {
      IMAGES_BUCKET  = aws_s3_bucket.images.bucket
      DYNAMODB_TABLE = "inspections"
    }
  }

  # Place Lambda inside your private VPC
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = local.common_tags
}

# ═══════════════════════════════════════════════
# LAMBDA 2 — SQS Worker
# Runs when a message arrives in SQS queue
# ═══════════════════════════════════════════════
resource "aws_lambda_function" "sqs_worker" {
  filename         = data.archive_file.sqs_worker.output_path
  source_code_hash = data.archive_file.sqs_worker.output_base64sha256
  function_name    = "${var.project_name}-sqs-worker"
  role             = aws_iam_role.sqs_worker.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300     # 5 minutes — image processing takes longer
  memory_size      = 512     # More memory for image processing

  environment {
    variables = {
      IMAGES_BUCKET  = aws_s3_bucket.images.bucket
      DYNAMODB_TABLE = "inspections"
    }
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Connect SQS queue to sqs_worker Lambda
# AWS automatically triggers Lambda when
# messages arrive in the queue
# ─────────────────────────────────────────────
resource "aws_lambda_event_source_mapping" "sqs_worker" {
  event_source_arn = aws_sqs_queue.inspection_processing.arn
  function_name    = aws_lambda_function.sqs_worker.arn
  batch_size       = 10      # Process up to 10 messages at once
  enabled          = true
}

# ─────────────────────────────────────────────
# Give API Gateway permission to invoke
# the api_handler Lambda
# ─────────────────────────────────────────────
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
