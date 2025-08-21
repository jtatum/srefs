variable "bucket_name" {
  description = "Name of the S3 bucket for storing sref images"
  type        = string
  default     = "jtatum-sref-data"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}