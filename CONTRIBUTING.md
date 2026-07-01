# Contributing to Srefs

Thanks for your interest in contributing to the Midjourney Style Reference
Gallery! There are two main ways to contribute:

1. **Add or edit style references (srefs)** — the most common contribution.
2. **Improve the site or Discord bot** — code changes.

## Adding a Style Reference

### Option 1: Discord Bot (recommended)

If the Discord bot is running, right-click any Midjourney Bot message →
**Apps → Add to Sref Database**, fill in the title and tags, and the bot creates
the sref structure for you. See **Discord Bot Setup** in the
[README](./README.md#discord-bot-setup).

### Option 2: Manual

1. Create a directory in `src/data/srefs/` named `sref-[id]`.
2. Add a `meta.yaml`:

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

3. Add the referenced images under `src/data/srefs/sref-[id]/images/`.
4. Verify locally with `npm run build:local` (a full `npm run build` also syncs
   images to/from S3 and is not needed for a content PR).

**Tag tips:** keep tags lowercase and reuse existing ones where possible. You can
audit tag usage with:

```bash
npx tsx scripts/analyze-tags.ts
```

## Development Setup

```bash
npm install
npm run dev      # dev server at http://localhost:4321
```

Requires Node.js 20+ (matching CI).

### Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Astro dev server |
| `npm run build:local` | Build the static site without S3 sync |
| `npm test` | Run the Vitest suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run bot:dev` | Run the Discord bot with file watching |

## Code Contributions

- Source lives under `src/` (`components/`, `pages/`, `layouts/`, `lib/`, and the
  Discord bot under `src/bot/`).
- Unit and integration tests live under `tests/`; end-to-end specs under `e2e/`.
- New behavior should come with tests. Please keep the suite green:

  ```bash
  npm test
  ```

- The Discord bot requires environment configuration; copy `.env.example` to
  `.env` and fill in `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` before running it.

## Pull Requests

1. Branch off `main`.
2. Keep each pull request focused on a single change (one feature/fix, or one
   batch of related srefs).
3. Ensure `npm test` passes.
4. Describe what changed and why, and link any related issue.

## Reporting Issues

Please open an issue with clear reproduction steps for bugs, or a description of
the use case for feature requests.

Thanks for helping grow the gallery!
