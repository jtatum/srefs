# Midjourney Style Reference Gallery

A static site for organizing and browsing Midjourney style references (srefs). Built with Astro, featuring filesystem-based storage for easy Git management and instant client-side search.

## Features

- 📁 **Filesystem-based** - All data stored as YAML and images, no database needed
- 🔍 **Instant Search** - Client-side fuzzy search with Fuse.js
- 🏷️ **Tag Filtering** - Filter by multiple tags
- 🖼️ **Automatic Image Processing** - Dimensions extracted at build time
- 📱 **Responsive Design** - Works on all devices
- 🚀 **Static Site** - Deploy anywhere that serves HTML

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

1. Create a new directory in `data/srefs/` named `sref-[id]`
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

3. Add images to `data/srefs/sref-[id]/images/`
4. Build the site: `npm run build`

## Project Structure

```
/
├── data/
│   └── srefs/              # Style reference data
│       └── sref-[id]/
│           ├── meta.yaml   # Metadata
│           └── images/     # Image files
├── src/
│   ├── pages/             # Astro pages
│   ├── components/        # React and Astro components
│   ├── layouts/           # Page layouts
│   └── lib/               # Utilities and data loading
└── dist/                  # Built static site
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server at localhost:4321 |
| `npm run build` | Build static site to `./dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run test:coverage` | Run tests with coverage report |

## Testing

The project includes comprehensive tests for data loading, search functionality, and build process:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
```

## Deployment

The built site in `dist/` is completely static and can be deployed to:
- Netlify (drag & drop the dist folder)
- Vercel
- GitHub Pages
- Any static hosting service

## Tech Stack

- [Astro](https://astro.build) - Static site generator
- [React](https://react.dev) - Search component
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Fuse.js](https://fusejs.io) - Fuzzy search
- [Sharp](https://sharp.pixelplumbing.com) - Image processing
- [Vitest](https://vitest.dev) - Testing

## License

MIT