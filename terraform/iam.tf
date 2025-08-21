# OIDC provider for GitHub Actions
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
  ]

  tags = {
    Name    = "GitHub Actions OIDC"
    Project = "sref-gallery"
  }
}

# IAM role for GitHub Actions
resource "aws_iam_role" "github_actions_role" {
  name = "sref-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:jtatum/srefs:*"
          }
        }
      }
    ]
  })

  tags = {
    Name    = "GitHub Actions Role"
    Project = "sref-gallery"
  }
}

# IAM policy for S3 access
resource "aws_iam_role_policy" "github_actions_s3_policy" {
  name = "sref-s3-access"
  role = aws_iam_role.github_actions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.sref_images.arn,
          "${aws_s3_bucket.sref_images.arn}/*"
        ]
      }
    ]
  })
}