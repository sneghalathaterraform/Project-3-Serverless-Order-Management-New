# ─────────────────────────────────────────────
# CloudFront Distribution
# Delivers your React website from S3
# globally, fast, with HTTPS
# ─────────────────────────────────────────────
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"       # Load this file when visiting cloudgrip.art
  aliases             = [var.domain_name]  # Your custom domain

  # ── Where CloudFront gets the files from ──
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # ── How CloudFront handles requests ──
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"  # Force HTTPS
    compress               = true                  # Compress files for speed

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600   # Cache files for 1 hour
    max_ttl     = 86400  # Maximum cache = 24 hours
  }

  # ── SPA Fix ──
  # React apps use client-side routing
  # If CloudFront gets a 403 or 404, return index.html
  # so React Router can handle the URL
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # ── No geographic restrictions ──
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ── Use your SSL certificate ──
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.common_tags
}
