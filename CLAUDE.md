# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Midjourney Style Reference (sref) Gallery - a static site built with Astro that organizes and displays Midjourney style references. The entire system is filesystem-based for easy git management, with no external database required.

## Commands

```bash
# Site commands
npm run dev           # Start dev server at localhost:4321
npm run build         # Full build: sync sources to S3, download from S3, build site, upload processed files
npm run build:local   # Build site using only local files (no S3 sync)
npm run preview       # Preview production build locally
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage report

# E2E testing commands
npm run test:e2e      # Run Playwright E2E tests
npm run test:e2e:ui   # Run Playwright E2E tests with UI

# Discord bot commands
npm run bot:dev       # Start bot in development mode (with file watching)
npm run bot:start     # Start bot in production mode

# Utility commands
npx tsx scripts/analyze-tags.ts  # Analyze tag usage statistics

# S3 sync commands
npm run sync:sources-to-s3        # Upload local source files to S3 (srefs/ and public/ prefixes)
npm run sync:from-s3              # Download source files from S3 to local
npm run sync:to-s3                # Upload processed files to S3 (cdn/ prefix)
npm run transform:manifest        # Transform PWA manifest to use CDN URLs
```

## Architecture

### Data Storage System
All sref data lives in `src/data/srefs/` with this structure:
```
src/data/srefs/
└── sref-[id]/
    ├── meta.yaml    # Metadata file (required)
    └── images/      # Image files (jpg, png, webp, gif)
```

The `meta.yaml` format:
```yaml
id: "12345678"
title: "Style Name"
description: "Optional description"
tags: [tag1, tag2]
cover_image: "filename.jpg"  # Which image to use as cover
created: "2024-01-15"         # Optional
images:                       # Optional, auto-discovered if omitted
  - filename: "img.jpg"
    prompt: "example prompt"  # Optional
```

### Build-Time Processing
- `src/lib/srefs.ts`: Astro-specific data loader that processes YAML files and creates optimized images with Sharp
- `src/lib/sref-data.ts`: Common data loading library (no Astro dependencies) for scripts and utilities
- **S3 Sync Pipeline**: 
  1. Upload any new/changed source files to S3 (`sync:sources-to-s3`)
  2. Download all source files from S3 (`sync:from-s3`) 
  3. Process images with Astro (`astro build`)
  4. Transform PWA manifest for CDN (`transform:manifest`)
  5. Upload optimized images to S3 CDN (`sync:to-s3`)
- **Image Processing**: Creates AVIF/WebP thumbnails (400×400) and gallery images (800×800)
- **CDN Delivery**: Processed images served via CloudFront for fast global delivery
- Search index is generated at build time from all srefs

### Key Components
- `src/pages/index.astro`: Homepage with SearchClient React component
- `src/pages/sref/[id].astro`: Dynamic route for sref detail pages (static generation)
- `src/components/SearchClient.tsx`: React component with Fuse.js for client-side search and filtering
- `src/lib/types.ts`: TypeScript interfaces for all data structures

### Search Implementation
Client-side search using Fuse.js with:
- Fuzzy matching on title, description, tags, and ID
- Tag filtering (click tags to filter)
- Search index built at compile time, loaded once on page load

## Adding New Srefs

1. Create directory: `src/data/srefs/sref-[your-id]/`
2. Add `meta.yaml` with at minimum:
   ```yaml
   id: "your-id"
   title: "Your Title"
   tags: [tag1, tag2]
   cover_image: "cover.jpg"
   ```
3. Add images to `src/data/srefs/sref-[your-id]/images/`
4. Run `npm run build` to upload source files to S3 and regenerate the site

**Note**: The build process now automatically uploads your new local source files to S3 before processing, ensuring they're available for future builds on other machines.

## Tag Management

### Tag Analysis Utility
The project includes a tag analysis utility to help manage and understand tag usage:

```bash
npx tsx scripts/analyze-tags.ts
```

This utility provides:
- **Complete tag statistics** sorted by usage frequency
- **Low-usage tags** (≤3 uses) highlighted for potential cleanup
- **Usage distribution** showing how many tags fall into each usage bucket
- **Sref mapping** showing which srefs use each tag

Example output:
```
=== TAG USAGE ANALYSIS ===

📊 Total unique tags: 57
📈 Most used tag: "illustration" (18 times)
📉 Least used tags: 25 tags used only once

🔍 LOW USAGE TAGS (≤3 uses):
• "cute" (1 use): 1147125222
• "cyberpunk" (1 use): 2067381016
• "vintage" (2 uses): 2799482521, 62
```

Use this data to:
- Identify tags that could be merged or standardized
- Find underutilized tags that might be worth promoting
- Understand your collection's tag distribution
- Clean up inconsistent tagging patterns

### Spelling Validation
Automated spelling validation for tags and titles using cspell. Custom art/design terms are configured in `tests/integration/spelling.test.ts` - add domain-specific words to the `customWords` array to prevent false positives.

## S3 Image Storage & CDN

The project uses AWS S3 for image storage and CloudFront for fast global delivery.

### Architecture
- **Sref Images**: Stored in S3 under `srefs/sref-{id}/images/` and `srefs/sref-{id}/meta.yaml`
- **Public Assets**: Stored in S3 under `public/` (favicons, logos, og.png)
- **Processed Images**: Generated by Astro and stored in S3 under `cdn/processed/`
- **Public CDN Assets**: Stored in S3 under `cdn/public/` for CloudFront delivery
- **CDN Delivery**: CloudFront serves all processed images and public assets with proper caching headers
- **Build Pipeline**: 
  1. `sync:sources-to-s3` - Upload any new local source files (srefs and public assets) to S3
  2. `sync:from-s3` - Download all source files from S3 to local
  3. `astro build` - Process images and generate static site
  4. `transform:manifest` - Transform PWA manifest icon URLs to use CDN
  5. `sync:to-s3` - Upload optimized images and public assets to S3 CDN

### Initial Setup
```bash
# Deploy AWS infrastructure first
cd terraform && AWS_PROFILE=srefs terraform apply

# Test the build pipeline
AWS_PROFILE=srefs npm run build
```

### Environment Variables
```bash
AWS_S3_BUCKET=jtatum-sref-data
AWS_REGION=us-west-2
CLOUDFRONT_DOMAIN=d123456789.cloudfront.net  # From Terraform output
PUBLIC_USE_CDN=true                          # Enable CDN for public assets
PUBLIC_CLOUDFRONT_DOMAIN=d123456789.cloudfront.net  # For Astro client-side
```

## Public Assets & CDN

The project stores all public static assets (favicons, logos, social media images) in S3 and serves them via CloudFront CDN.

### Asset Types
- **Browser Icons**: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`
- **Mobile Icons**: `apple-touch-icon.png` (iOS), `android-chrome-*.png` (Android/PWA)
- **Social Media**: `og.png` for OpenGraph and Twitter cards

### CDN Utilities
- **`toPublicCdnUrl(path)`**: Converts local paths to CDN URLs for general use
  ```astro
  <link rel="icon" href={toPublicCdnUrl('/favicon.ico')} />
  ```
- **`toAbsoluteCdnUrl(path, siteUrl)`**: Creates absolute URLs for social media meta tags
  ```astro
  <meta property="og:image" content={toAbsoluteCdnUrl('/og.png', site)} />
  ```

### Build Process
1. **Development**: Assets served locally from `public/` directory
2. **Production with CDN**: 
   - Assets uploaded to S3 under `public/` prefix (source storage)
   - Processed and uploaded to `cdn/public/` prefix (CDN delivery) 
   - PWA manifest transformed to use absolute CDN URLs
   - All HTML references use CDN URLs automatically

### Git LFS Migration
Public assets were migrated from Git LFS to S3 storage:
- Assets are now ignored in `.gitignore` (except text files like `robots.txt`)
- Source files sync to/from S3 alongside sref images
- No more LFS checkout required for binary assets

## Discord Bot Integration

A Discord bot is included that allows adding Midjourney messages directly to the sref database via context menu commands.

### Bot Setup
1. Copy `.env.example` to `.env` and fill in your Discord bot credentials:
   ```bash
   cp .env.example .env
   ```
2. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
3. Create a bot user and copy the token to `DISCORD_TOKEN`
4. Copy the application ID to `DISCORD_CLIENT_ID`
5. Invite the bot to your Discord server with these permissions:
   - `applications.commands` (for context menu commands)
   - `bot` (basic bot permissions)

### Usage
1. Start the bot: `npm run bot:dev`
2. In Discord, right-click on any Midjourney Bot message
3. Select "Apps" > "Add to Sref Database"
4. Fill out the modal with title, tags, and description
5. Bot downloads the image and creates the sref structure automatically
6. A ✅ reaction is added to the original message to mark it as processed

### Supported Message Types
- **Initial generations** (4-image grids, 2048x2048)
- **Variations** (Strong/Subtle, 2048x2048)
- **Upscales** (Individual images, 1024x1024)
- **Individual selections** (Image #1, #2, etc.)
- **Messages with --sref parameters** (automatically extracted)

### Bot Architecture
- `src/bot/index.ts` - Main bot entry point and command registration
- `src/bot/commands/addToSref.ts` - Context menu command definition
- `src/bot/handlers/midjourneyHandler.ts` - Modal interaction and sref creation
- `src/bot/utils/midjourneyParser.ts` - Message parsing and data extraction
- `src/bot/utils/imageDownloader.ts` - Image downloading from Discord CDN
- `src/bot/utils/srefCreator.ts` - Sref directory and YAML generation

### Error Handling
- Network failures during image download
- Invalid Midjourney message formats
- Missing Discord permissions
- File system errors during sref creation
- Modal timeout handling

## Tech Stack
- **Astro** - Static site generator with excellent image handling
- **React** - For interactive search component only
- **Tailwind CSS** - Styling via @tailwindcss/vite
- **Sharp** - Image dimension extraction at build time
- **Fuse.js** - Client-side fuzzy search
- **js-yaml** - YAML parsing for metadata files
- **Discord.js** - Discord API integration for bot functionality
- **tsx** - TypeScript execution for bot development
- **Vitest** - Testing framework configured with Astro
- **Testing Library** - React component testing
- **Playwright** - E2E testing framework for browser automation

## Testing
The project has comprehensive test coverage for critical functionality:

### Unit Tests (Vitest)
- `src/lib/srefs.test.ts` - Astro-specific data loading and processing tests
- `src/lib/sref-data.test.ts` - Common data library tests (filesystem and YAML parsing)
- `src/components/SearchClient.test.tsx` - Search and filtering tests (100% coverage)
- `tests/integration/build.test.ts` - Build process validation

### Bot Tests (98.41% coverage)
- `src/bot/utils/midjourneyParser.test.ts` - Message parsing and validation
- `src/bot/utils/imageDownloader.test.ts` - Image download and file operations
- `src/bot/utils/srefCreator.test.ts` - Sref creation and YAML generation
- `src/bot/handlers/midjourneyHandler.test.ts` - Complete workflow integration

### E2E Tests (Playwright)
- `e2e/explore-before.spec.ts` - Gallery exploration behavior tests
- `e2e/explore-hover.spec.ts` - Hover interaction tests

Test fixtures are in `tests/fixtures/` with various sref configurations for testing edge cases.