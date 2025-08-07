# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Midjourney Style Reference (sref) Gallery - a static site built with Astro that organizes and displays Midjourney style references. The entire system is filesystem-based for easy git management, with no external database required.

## Commands

```bash
# Site commands
npm run dev           # Start dev server at localhost:4321
npm run build         # Build static site to ./dist/
npm run preview       # Preview production build locally
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage report

# Discord bot commands
npm run bot:dev       # Start bot in development mode (with file watching)
npm run bot:start     # Start bot in production mode
```

## Architecture

### Data Storage System
All sref data lives in `data/srefs/` with this structure:
```
data/srefs/
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
- `src/lib/srefs.ts`: Data loader that reads YAML files and automatically extracts image dimensions using Sharp
- Images are served directly from `data/srefs/` directories (no copying/processing)
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

1. Create directory: `data/srefs/sref-[your-id]/`
2. Add `meta.yaml` with at minimum:
   ```yaml
   id: "your-id"
   title: "Your Title"
   tags: [tag1, tag2]
   cover_image: "cover.jpg"
   ```
3. Add images to `data/srefs/sref-[your-id]/images/`
4. Run `npm run build` to regenerate the site

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
4. The bot will analyze the message and log details to the console

### Bot Architecture
- `src/bot/index.ts` - Main bot entry point and command registration
- `src/bot/commands/` - Context menu command definitions
- `src/bot/handlers/` - Message processing and sref creation logic
- `src/bot/utils/` - Shared bot utilities

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

## Testing
The project has comprehensive test coverage for critical functionality:
- `src/lib/srefs.test.ts` - Data loading and processing tests
- `src/components/SearchClient.test.tsx` - Search and filtering tests (100% coverage)
- `tests/integration/build.test.ts` - Build process validation

Test fixtures are in `tests/fixtures/` with various sref configurations for testing edge cases.