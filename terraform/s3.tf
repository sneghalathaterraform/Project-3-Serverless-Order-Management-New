# ─────────────────────────────────────────────
# BUCKET 1: Frontend — hosts the React website
# Only CloudFront can read from this bucket
# (not open to the public directly)
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${random_id.suffix.hex}"

  tags = local.common_tags
}

# Block all public access — CloudFront handles delivery
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────
# CloudFront Origin Access Control (OAC)
# This is like a key — only CloudFront with
# this key can read files from the S3 bucket
# ─────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─────────────────────────────────────────────
# Bucket Policy — gives CloudFront permission
# to read files from the frontend bucket
# ─────────────────────────────────────────────
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────
# BUCKET 2: Images — stores inspection photos
# Users upload directly here using a
# presigned URL (a temporary upload link)
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "images" {
  bucket = "${var.project_name}-images-${random_id.suffix.hex}"

  tags = local.common_tags
}

# Block public access — users upload via presigned URL only
resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────
# CORS — allows the browser on cloudgrip.art
# to upload files directly to this bucket
# ─────────────────────────────────────────────
resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://${var.domain_name}"]
    max_age_seconds = 3000
  }
}

# ─────────────────────────────────────────────
# S3 Event Notification
# When a photo is uploaded → notify SNS topic
# This triggers the async processing pipeline
# ─────────────────────────────────────────────
resource "aws_s3_bucket_notification" "images" {
  bucket = aws_s3_bucket.images.id

  topic {
    topic_arn     = aws_sns_topic.inspection_uploads.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "inspections/"   # Only trigger for files in the inspections/ folder
  }

  depends_on = [aws_sns_topic_policy.s3_publish]
}
