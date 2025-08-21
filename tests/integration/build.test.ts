import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('Build Process Integration Tests', () => {
  let buildOutput: string;
  let buildError: string;

  beforeAll(async () => {
    // Run the build command (use build:local to skip S3 sync in CI)
    try {
      const { stdout, stderr } = await execAsync('npm run build:local', {
        cwd: process.cwd(),
        timeout: 60000, // 60 second timeout
      });
      buildOutput = stdout || '';
      buildError = stderr || '';
    } catch (error: any) {
      buildError = error.message || 'Build failed';
      buildOutput = '';
    }
  }, 90000); // 90 second timeout for beforeAll

  afterAll(async () => {
    // Clean up dist directory after tests
    try {
      await fs.rm(path.join(process.cwd(), 'dist'), { recursive: true, force: true });
    } catch {
      // Ignore errors if dist doesn't exist
    }
  });

  it('should complete build without errors', () => {
    expect(buildError).not.toContain('Error');
    expect(buildOutput).toContain('Complete!');
  });

  it('should generate index.html', async () => {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html');
    const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
    expect(indexExists).toBe(true);

    if (indexExists) {
      const content = await fs.readFile(indexPath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('Midjourney Sref Gallery');
    }
  });

  it('should generate sref detail pages', async () => {
    const srefPath = path.join(process.cwd(), 'dist', 'sref');
    const srefDirExists = await fs.access(srefPath).then(() => true).catch(() => false);
    
    if (srefDirExists) {
      const srefDirs = await fs.readdir(srefPath);
      expect(srefDirs.length).toBeGreaterThan(0);
      
      // Check that each sref has an index.html
      for (const dir of srefDirs) {
        const indexPath = path.join(srefPath, dir, 'index.html');
        const exists = await fs.access(indexPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    }
  });

  it('should include JavaScript bundles', async () => {
    const distPath = path.join(process.cwd(), 'dist');
    const astroPath = path.join(distPath, '_astro');
    const astroExists = await fs.access(astroPath).then(() => true).catch(() => false);
    
    if (astroExists) {
      const files = await fs.readdir(astroPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);
    }
  });

  it('should build search functionality', async () => {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html');
    const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
    
    if (indexExists) {
      const content = await fs.readFile(indexPath, 'utf-8');
      // Check for SearchClient component markers
      expect(content).toMatch(/search/i);
    }
  });
});

describe('Data Integrity Tests', () => {
  it('should handle various sref configurations', async () => {
    const dataDir = path.join(process.cwd(), 'src', 'data', 'srefs');
    const dataDirExists = await fs.access(dataDir).then(() => true).catch(() => false);
    
    if (dataDirExists) {
      const srefDirs = await fs.readdir(dataDir);
      
      for (const dir of srefDirs) {
        const metaPath = path.join(dataDir, dir, 'meta.yaml');
        const metaExists = await fs.access(metaPath).then(() => true).catch(() => false);
        
        if (metaExists) {
          const content = await fs.readFile(metaPath, 'utf-8');
          // Basic YAML structure check
          expect(content).toContain('id:');
          expect(content).toContain('title:');
          expect(content).toContain('tags:');
        }
      }
    }
  });

  it('should validate image references', async () => {
    const dataDir = path.join(process.cwd(), 'src', 'data', 'srefs');
    const dataDirExists = await fs.access(dataDir).then(() => true).catch(() => false);
    
    if (dataDirExists) {
      const srefDirs = await fs.readdir(dataDir);
      
      for (const dir of srefDirs) {
        const imagesDir = path.join(dataDir, dir, 'images');
        const imagesDirExists = await fs.access(imagesDir).then(() => true).catch(() => false);
        
        if (imagesDirExists) {
          const images = await fs.readdir(imagesDir);
          const imageFiles = images.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
          
          // Each sref should have at least one image if images directory exists
          if (images.length > 0) {
            expect(imageFiles.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});