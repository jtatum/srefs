# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "sref_images_oac" {
  name                              = "sref-images-oac"
  description                       = "OAC for Sref Gallery Images"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "sref_images_cdn" {
  origin {
    domain_name              = aws_s3_bucket.sref_images.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.sref_images_oac.id
    origin_id                = "S3-${aws_s3_bucket.sref_images.bucket}"
    origin_path              = "/cdn"
  }

  enabled         = true
  is_ipv6_enabled = true
  comment         = "Sref Gallery Image CDN"

  # Cache behavior for processed images (default)
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.sref_images.bucket}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400   # 1 day
    max_ttl                = 31536000 # 1 year
    compress               = true
  }

  # Cache behavior for original images (longer cache)
  ordered_cache_behavior {
    path_pattern     = "/srefs/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.sref_images.bucket}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400    # 1 day
    default_ttl            = 2592000  # 30 days
    max_ttl                = 31536000 # 1 year
    compress               = true
  }

  price_class = "PriceClass_100" # US, Canada, Europe

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name    = "Sref Gallery CDN"
    Project = "sref-gallery"
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}