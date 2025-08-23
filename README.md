# Midjourney Style Reference Gallery

A static site for organizing and browsing Midjourney style references (srefs). Built with Astro, featuring filesystem-based storage for easy Git management and instant client-side search.

## 🚀 **[→ Browse the Live Gallery ←](https://srefdb.com)**

**🤖 Now with Discord Bot Integration!** Add Midjourney images directly from Discord via context menu commands.

## Features

- 📁 **Filesystem-based** - All data stored as YAML and images, no database needed
- 🔍 **Instant Search** - Client-side fuzzy search with Fuse.js
- 🏷️ **Tag Filtering** - Filter by multiple tags
- 🖼️ **Automatic Image Processing** - Dimensions extracted at build time
- 📱 **Responsive Design** - Works on all devices
- 🚀 **Static Site** - Deploy anywhere that serves HTML
- 🤖 **Discord Bot** - Add srefs directly from Midjourney messages
- 📊 **Tag Analytics** - Built-in utility to analyze tag usage and cleanup
- 🔗 **GitHub Integration** - Edit on GitHub link for easy contribution

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Adding Style References

### Option 1: Discord Bot (Recommended)

1. Set up the Discord bot (see [Discord Bot Setup](#discord-bot-setup))
2. In Discord, right-click any Midjourney Bot message
3. Select "Apps" → "Add to Sref Database"
4. Fill out the modal with title and tags
5. Bot automatically downloads image and creates sref structure
6. Rebuild site: `npm run build`

### Option 2: Manual

1. Create a new directory in `src/data/srefs/` named `sref-[id]`
2. Add a `meta.yaml` file:

```yaml
id: "12345678"
title: "Your Style Name"
description: "Description of the style"
tags:
  - tag1
  - tag2
cover_image: "cover.jpg"
images:
  - filename: "example1.jpg"
    prompt: "example prompt --sref 12345678"
```

3. Add images to `src/data/srefs/sref-[id]/images/`
4. Build the site: `npm run build` (includes S3 sync and image processing)

## S3 Image Storage & CDN

This project uses AWS S3 for scalable image storage and CloudFront for fast global delivery, replacing Git LFS.

### Setup (One-time)
```bash
# 1. Deploy AWS infrastructure
cd terraform && AWS_PROFILE=srefs terraform apply

# 2. Update GitHub repository variables with Terraform outputs
```

### How it Works
- **Build Pipeline**: `npm run build` syncs from S3 → processes images → uploads to S3
- **Image Processing**: Creates optimized AVIF/WebP thumbnails and gallery images
- **CDN Delivery**: CloudFront serves processed images with global caching
- **No Git LFS**: All images stored in S3, dramatically reducing repository size

## Tag Management

Use the built-in tag analysis utility to understand and manage your collection's tags:

```bash
npx tsx scripts/analyze-tags.ts
```

This shows:
- Complete tag usage statistics
- Tags with low usage (candidates for cleanup)
- Which srefs use each tag
- Usage distribution across your collection

Perfect for identifying inconsistent tags or finding underutilized categories.

## Discord Bot Setup

1. **Create Discord Application:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application and bot
   - Copy bot token and application ID

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your DISCORD_TOKEN and DISCORD_CLIENT_ID
   ```

3. **Invite Bot to Server:**
   - In Discord Developer Portal → OAuth2 → URL Generator
   - Select scopes: `bot` and `applications.commands`
   - Select permissions: `Read Messages` and `Use Application Commands`
   - Use generated URL to invite bot to your server

4. **Start Bot:**
   ```bash
   npm run bot:dev  # Development mode with file watching
   npm run bot:start # Production mode
   ```

## Project Structure

```
/
├── public/
│   └── data/
│       └── srefs/          # Style reference data
│           └── sref-[id]/
│               ├── meta.yaml   # Metadata
│               └── images/     # Image files
├── src/
│   ├── bot/               # Discord bot integration
│   │   ├── commands/      # Context menu commands
│   │   ├── handlers/      # Message processing
│   │   └── utils/         # Bot utilities
│   ├── pages/             # Astro pages
│   ├── components/        # React and Astro components
│   ├── layouts/           # Page layouts
│   └── lib/               # Utilities and data loading
├── scripts/               # Utility scripts (tag analysis, etc.)
├── tests/                 # Test files and fixtures
└── dist/                  # Built static site
```

## Commands

### Site Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server at localhost:4321 |
| `npm run build` | Build static site to `./dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run test:coverage` | Run tests with coverage report |

### Bot Commands
| Command | Description |
|---------|-------------|
| `npm run bot:dev` | Start bot in development mode (with file watching) |
| `npm run bot:start` | Start bot in production mode |

### Utility Commands
| Command | Description |
|---------|-------------|
| `npx tsx scripts/analyze-tags.ts` | Analyze tag usage statistics and find low-usage tags |

## Testing

The project includes comprehensive tests for data loading, search functionality, build process, and Discord bot integration:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
npm test src/bot      # Run only bot tests
```

**Test Coverage:**
- Site functionality: 100% coverage on SearchClient component
- Bot functionality: 98.41% coverage on utilities and handlers
- Integration tests for complete workflows

## Deployment

### Automated GitHub Pages Deployment (Recommended)

The repository includes automated CI/CD via GitHub Actions:

1. **Automatic Testing**: Every push/PR runs full test suite
2. **Automatic Building**: Successful tests trigger Astro build
3. **Automatic Deployment**: Built site deploys to GitHub Pages

**Setup GitHub Pages:**
1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to `main` branch to trigger deployment

**Live Site:** `https://jtatum.github.io/srefs`

### Manual Deployment

The built site in `dist/` can also be manually deployed to:
- Netlify (drag & drop the dist folder)
- Vercel
- Any static hosting service

## Tech Stack

**Site:**
- [Astro](https://astro.build) - Static site generator
- [React](https://react.dev) - Search component
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Fuse.js](https://fusejs.io) - Fuzzy search
- [Sharp](https://sharp.pixelplumbing.com) - Image processing

**Discord Bot:**
- [Discord.js](https://discord.js.org) - Discord API integration
- [tsx](https://tsx.is) - TypeScript execution for development

**Development:**
- [Vitest](https://vitest.dev) - Testing framework
- [TypeScript](https://typescriptlang.org) - Type safety

## License

MIT
