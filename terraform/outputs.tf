# ─────────────────────────────────────────────
# CloudFront
# ─────────────────────────────────────────────
output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "Use this ID to invalidate cache after deploying new frontend"
  value       = aws_cloudfront_distribution.main.id
}

# ─────────────────────────────────────────────
# S3 Buckets
# ─────────────────────────────────────────────
output "frontend_bucket_name" {
  description = "Upload your React build files to this bucket"
  value       = aws_s3_bucket.frontend.bucket
}

output "images_bucket_name" {
  description = "Inspection photos are stored in this bucket"
  value       = aws_s3_bucket.images.bucket
}

# ─────────────────────────────────────────────
# API
# ─────────────────────────────────────────────
output "api_endpoint" {
  description = "Your live API URL — use this in your React app"
  value       = "https://api.${var.domain_name}/v1"
}

# ─────────────────────────────────────────────
# Route 53 Nameservers
# IMPORTANT: Copy these 4 values and paste them
# into your domain registrar (where you bought
# cloudgrip.art) to connect your domain to AWS
# ─────────────────────────────────────────────
output "route53_nameservers" {
  description = "Update your domain registrar with these nameservers"
  value       = aws_route53_zone.main.name_servers
}

# ─────────────────────────────────────────────
# SNS / SQS
# ─────────────────────────────────────────────
output "sns_topic_arn" {
  description = "SNS topic that receives S3 upload events"
  value       = aws_sns_topic.inspection_uploads.arn
}

output "sqs_queue_url" {
  description = "SQS queue URL that feeds the worker Lambda"
  value       = aws_sqs_queue.inspection_processing.url
}

output "sqs_dlq_url" {
  description = "Dead letter queue — check here if messages fail"
  value       = aws_sqs_queue.inspection_processing_dlq.url
}
