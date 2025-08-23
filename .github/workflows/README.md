# GitHub Actions Setup for S3 Integration

After deploying the Terraform infrastructure, you need to configure GitHub Actions with the necessary variables and permissions.

## Repository Variables

Go to your repository Settings → Secrets and variables → Actions → Variables tab and add:

### Required Variables
- `AWS_ROLE_ARN`: The IAM role ARN from Terraform output
- `AWS_S3_BUCKET`: `jtatum-sref-data`
- `CLOUDFRONT_DOMAIN`: The CloudFront distribution domain from Terraform output

Example values (replace with your actual Terraform outputs):
```
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/sref-github-actions-role
AWS_S3_BUCKET=jtatum-sref-data
CLOUDFRONT_DOMAIN=d31ia6eno6f02p.cloudfront.net
```

## How it Works

The updated `deploy.yml` workflow:

1. **Checks out code** (no LFS needed anymore)
2. **Authenticates with AWS** using OIDC (no access keys needed)
3. **Runs the build** which includes:
   - `npm run sync:from-s3` - Download images from S3
   - `astro build` - Process images and build site with CDN URLs
   - `npm run sync:to-s3` - Upload processed images back to S3
4. **Deploys to GitHub Pages** with images served from CloudFront CDN

## Testing the Setup

1. **Deploy Terraform first**:
   ```bash
   cd terraform
   terraform apply
   ```

2. **Get the outputs and add to GitHub**:
   ```bash
   terraform output github_actions_role_arn
   terraform output s3_bucket_name
   ```

3. **Push to main branch** - the workflow will run automatically

4. **Check the Actions tab** for any errors

## Deployment

1. **Push to trigger deployment**

2. **Images will be served from CloudFront CDN**

The deployment will be much faster since it no longer needs to handle large image files through Git LFS!