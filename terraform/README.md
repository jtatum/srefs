# Terraform Infrastructure for Sref Gallery

This Terraform configuration creates the AWS infrastructure needed for the Sref Gallery image storage and CDN.

## Resources Created

- **S3 Bucket**: `jtatum-sref-data` for storing original and processed images
- **CloudFront Distribution**: CDN for fast global image delivery
- **IAM OIDC Provider**: For GitHub Actions authentication
- **IAM Role**: Allows GitHub Actions to deploy images to S3

## Setup

1. **Install Terraform** (if not already installed):
   ```bash
   brew install terraform
   ```

2. **Configure AWS credentials** (using the `srefs` profile):
   ```bash
   export AWS_PROFILE=srefs
   # or use AWS SSO: aws sso login --profile srefs
   ```

3. **Initialize Terraform**:
   ```bash
   cd terraform
   AWS_PROFILE=srefs terraform init
   ```

4. **Plan the deployment**:
   ```bash
   AWS_PROFILE=srefs terraform plan
   ```

5. **Apply the configuration**:
   ```bash
   AWS_PROFILE=srefs terraform apply
   ```

## Outputs

After deployment, Terraform will output:
- `s3_bucket_name`: The S3 bucket name
- `cloudfront_domain_name`: The CloudFront CDN domain
- `cdn_url`: Full CDN URL for images
- `github_actions_role_arn`: IAM role ARN for GitHub Actions

## Directory Structure

The S3 bucket will use this structure:
- `srefs/` - Original images synced from local
- `cdn/processed/` - Astro-processed images (thumbnails, etc.)
- `cdn/srefs/` - Copy of originals for CDN delivery

## Next Steps

After running Terraform:

1. Update your `.env` file with the outputs:
   ```bash
   AWS_S3_BUCKET=jtatum-sref-data
   AWS_REGION=us-west-2
   CLOUDFRONT_DOMAIN=d123456789.cloudfront.net
   ```

2. Test the sync scripts:
   ```bash
   AWS_PROFILE=srefs npm run sync:from-s3
   AWS_PROFILE=srefs npm run build:local  
   AWS_PROFILE=srefs npm run sync:to-s3
   ```

3. Update GitHub Actions to use the IAM role for deployments

## Cleanup

To destroy all resources:
```bash
AWS_PROFILE=srefs terraform destroy
```

**Note**: This will delete all stored images, so make sure you have backups!