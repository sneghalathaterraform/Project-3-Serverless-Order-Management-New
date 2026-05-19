# ─────────────────────────────────────────────
# The REST API — the main API container
# ─────────────────────────────────────────────
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-api"
  description = "Inspection System API"

  endpoint_configuration {
    types = ["REGIONAL"]   # Deployed in one region (us-east-1)
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# /inspections resource
# This creates the URL path /inspections
# ─────────────────────────────────────────────
resource "aws_api_gateway_resource" "inspections" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "inspections"
}

# ─────────────────────────────────────────────
# POST /inspections
# Used to submit a new inspection form
# ─────────────────────────────────────────────
resource "aws_api_gateway_method" "post_inspections" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.inspections.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_inspections" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.inspections.id
  http_method             = aws_api_gateway_method.post_inspections.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"   # Pass full request to Lambda
  uri                     = aws_lambda_function.api_handler.invoke_arn
}

# ─────────────────────────────────────────────
# GET /inspections
# Used to list all inspections
# ─────────────────────────────────────────────
resource "aws_api_gateway_method" "get_inspections" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.inspections.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_inspections" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.inspections.id
  http_method             = aws_api_gateway_method.get_inspections.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api_handler.invoke_arn
}

# ─────────────────────────────────────────────
# /inspections/{id} resource
# This creates the URL path /inspections/abc123
# {id} is a variable — any inspection ID
# ─────────────────────────────────────────────
resource "aws_api_gateway_resource" "inspection_by_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.inspections.id
  path_part   = "{id}"
}

# ─────────────────────────────────────────────
# GET /inspections/{id}
# Used to fetch one specific inspection by ID
# ─────────────────────────────────────────────
resource "aws_api_gateway_method" "get_inspection_by_id" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.inspection_by_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_inspection_by_id" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.inspection_by_id.id
  http_method             = aws_api_gateway_method.get_inspection_by_id.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api_handler.invoke_arn
}

# ─────────────────────────────────────────────
# Deployment — publishes the API
# Must run after all methods are defined
# ─────────────────────────────────────────────
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  depends_on = [
    aws_api_gateway_integration.post_inspections,
    aws_api_gateway_integration.get_inspections,
    aws_api_gateway_integration.get_inspection_by_id
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────
# Stage — the live version of your API
# This is what gets the URL
# ─────────────────────────────────────────────
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment   # "prod"

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Custom Domain for API Gateway
# Maps api.cloudgrip.art to this API
# ─────────────────────────────────────────────
resource "aws_api_gateway_domain_name" "main" {
  domain_name              = "api.${var.domain_name}"
  regional_certificate_arn = aws_acm_certificate_validation.main.certificate_arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Base Path Mapping
# Connects the custom domain to the API stage
# api.cloudgrip.art/v1 → prod stage
# ─────────────────────────────────────────────
resource "aws_api_gateway_base_path_mapping" "main" {
  api_id      = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  domain_name = aws_api_gateway_domain_name.main.domain_name
  base_path   = "v1"
}
