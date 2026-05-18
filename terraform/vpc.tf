# ─────────────────────────────────────────────
# VPC — Your private network (the building)
# ─────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"   # IP address range for this network
  enable_dns_hostnames = true             # Allow resources to have DNS names
  enable_dns_support   = true             # Enable DNS inside the VPC

  tags = merge(local.common_tags, { Name = "${var.project_name}-vpc" })
}

# ─────────────────────────────────────────────
# Find available Availability Zones in us-east-1
# (example: us-east-1a, us-east-1b)
# ─────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

# ─────────────────────────────────────────────
# Private Subnets — rooms inside the building
# We create 2 subnets in 2 different zones
# for high availability
# ─────────────────────────────────────────────
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, { Name = "${var.project_name}-private-${count.index + 1}" })
}

# ─────────────────────────────────────────────
# Route Table — the map that guides traffic
# inside the private network
# ─────────────────────────────────────────────
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, { Name = "${var.project_name}-private-rt" })
}

# Connect each private subnet to the route table
resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─────────────────────────────────────────────
# Security Group for Lambda
# Controls what traffic Lambda can send/receive
# ─────────────────────────────────────────────
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Attached to Lambda functions"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"              # Allow all outbound traffic
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Security Group for VPC Endpoints
# Only allows HTTPS (port 443) from Lambda
# ─────────────────────────────────────────────
resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.project_name}-vpc-endpoints-sg"
  description = "Attached to VPC interface endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# VPC Endpoint for S3 (Gateway type)
# Lets Lambda access S3 without internet
# ─────────────────────────────────────────────
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(local.common_tags, { Name = "${var.project_name}-s3-endpoint" })
}

# ─────────────────────────────────────────────
# VPC Endpoint for DynamoDB (Gateway type)
# Lets Lambda access DynamoDB without internet
# ─────────────────────────────────────────────
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = merge(local.common_tags, { Name = "${var.project_name}-dynamodb-endpoint" })
}

# ─────────────────────────────────────────────
# VPC Endpoint for SQS (Interface type)
# Lets Lambda access SQS queue without internet
# ─────────────────────────────────────────────
resource "aws_vpc_endpoint" "sqs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.sqs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(local.common_tags, { Name = "${var.project_name}-sqs-endpoint" })
}

# ─────────────────────────────────────────────
# VPC Endpoint for API Gateway (Interface type)
# Lets private Lambda call API Gateway internally
# ─────────────────────────────────────────────
resource "aws_vpc_endpoint" "execute_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.execute-api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(local.common_tags, { Name = "${var.project_name}-execute-api-endpoint" })
}
