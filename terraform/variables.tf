variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Your root domain name"
  type        = string
  default     = "cloudgrip.art"
}

variable "project_name" {
  description = "Used as a prefix for all resource names"
  type        = string
  default     = "Serverless-project-3"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}
