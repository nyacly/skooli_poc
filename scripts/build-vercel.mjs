#!/usr/bin/env node

import { copyFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('🔨 Building for Vercel...');

// Create dist directory if it doesn't exist
const distDir = join(rootDir, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Copy public files to dist (Vercel will serve these as static files)
const publicDir = join(rootDir, 'public');
if (existsSync(publicDir)) {
  console.log('📁 Copying public files to dist...');
  cpSync(publicDir, distDir, { recursive: true });
  console.log('✅ Public files copied');
}

// The API files are handled by Vercel Functions directly from the api/ directory
console.log('✅ Build complete! API routes will be served from /api directory');
console.log('📦 Static files will be served from /dist directory');