import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(0, 0, size, size);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${size * 0.4}px sans-serif`;
  ctx.fillText('DT', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

// Generate icons
const sizes = [192, 512];

for (const size of sizes) {
  const buffer = generateIcon(size);
  const path = join(__dirname, '..', 'public', `icon-${size}.png`);
  writeFileSync(path, buffer);
  console.log(`Generated: icon-${size}.png`);
}

console.log('Done!');
