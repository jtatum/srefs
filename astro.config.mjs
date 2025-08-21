// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// For production builds with CDN, set USE_CDN=true
const USE_CDN = process.env.USE_CDN === 'true';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

// https://astro.build/config
export default defineConfig({
  site: 'https://srefdb.com',
  base: '/',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
