# S3 bucket for storing images
resource "aws_s3_bucket" "sref_images" {
  bucket = var.bucket_name

  tags = {
    Name    = "Sref Gallery Images"
    Project = "sref-gallery"
  }
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "sref_images_versioning" {
  bucket = aws_s3_bucket.sref_images.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "sref_images_encryption" {
  bucket = aws_s3_bucket.sref_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access (we'll allow access via CloudFront only)
resource "aws_s3_bucket_public_access_block" "sref_images_pab" {
  bucket = aws_s3_bucket.sref_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for uploads
resource "aws_s3_bucket_cors_configuration" "sref_images_cors" {
  bucket = aws_s3_bucket.sref_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# S3 bucket lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "sref_images_lifecycle" {
  bucket = aws_s3_bucket.sref_images.id

  # CDN files - delete noncurrent versions and tombstones quickly
  rule {
    id     = "cdn_cleanup"
    status = "Enabled"
    
    filter {
      prefix = "cdn/"
    }

    noncurrent_version_expiration {
      noncurrent_days = 7  # Delete old versions after 7 days
    }

    expiration {
      expired_object_delete_marker = true  # Remove tombstones immediately
    }
  }

  # Source files (srefs) - preserve for 6 months
  rule {
    id     = "srefs_cleanup"
    status = "Enabled"
    
    filter {
      prefix = "srefs/"
    }

    noncurrent_version_expiration {
      noncurrent_days = 180  # Delete old versions after 6 months
    }

    expiration {
      expired_object_delete_marker = true  # Remove tombstones after they expire
    }
  }

  # Source files (public) - preserve for 6 months
  rule {
    id     = "public_cleanup"
    status = "Enabled"
    
    filter {
      prefix = "public/"
    }

    noncurrent_version_expiration {
      noncurrent_days = 180  # Delete old versions after 6 months
    }

    expiration {
      expired_object_delete_marker = true  # Remove tombstones after they expire
    }
  }

  # Transition srefs to cheaper storage before deletion
  rule {
    id     = "srefs_transition"
    status = "Enabled"
    
    filter {
      prefix = "srefs/"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"  # Move to Infrequent Access after 30 days
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"  # Move to Glacier after 90 days
    }
  }

  # Transition public assets to cheaper storage before deletion
  rule {
    id     = "public_transition"
    status = "Enabled"
    
    filter {
      prefix = "public/"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"  # Move to Infrequent Access after 30 days
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"  # Move to Glacier after 90 days
    }
  }
}

# S3 bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "sref_images_policy" {
  bucket = aws_s3_bucket.sref_images.id
  policy = data.aws_iam_policy_document.sref_images_policy.json
}

data "aws_iam_policy_document" "sref_images_policy" {
  statement {
    sid    = "AllowCloudFrontAccess"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.sref_images.arn}/cdn/*",
      "${aws_s3_bucket.sref_images.arn}/srefs/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.sref_images_cdn.arn]
    }
  }
}