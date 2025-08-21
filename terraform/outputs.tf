output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.sref_images.bucket
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.sref_images_cdn.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.sref_images_cdn.id
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role"
  value       = aws_iam_role.github_actions_role.arn
}

output "cdn_url" {
  description = "Full CDN URL for images"
  value       = "https://${aws_cloudfront_distribution.sref_images_cdn.domain_name}"
}