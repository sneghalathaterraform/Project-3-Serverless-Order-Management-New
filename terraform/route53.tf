# ─────────────────────────────────────────────
# Hosted Zone — the DNS control panel
# for your domain cloudgrip.art
# ─────────────────────────────────────────────
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# A Record for cloudgrip.art
# Points your root domain → CloudFront
# So visitors reach your React website
# ─────────────────────────────────────────────
resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# ─────────────────────────────────────────────
# A Record for api.cloudgrip.art
# Points your API subdomain → API Gateway
# So the React app can call your backend
# ─────────────────────────────────────────────
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_api_gateway_domain_name.main.regional_domain_name
    zone_id                = aws_api_gateway_domain_name.main.regional_zone_id
    evaluate_target_health = false
  }
}
