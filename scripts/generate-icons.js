const fs = require('fs');
const path = require('path');

// Simple SVG to use as base
const svgTemplate = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="80" fill="#1f2937"/>
  
  <!-- Outer glow circle -->
  <circle cx="256" cy="256" r="140" fill="#10b981" opacity="0.2"/>
  
  <!-- Main green circle -->
  <circle cx="256" cy="256" r="120" fill="#10b981"/>
  
  <!-- Inner white circle -->
  <circle cx="256" cy="256" r="100" fill="#ffffff"/>
  
  <!-- Baht symbol -->
  <text x="256" y="256" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="#10b981" text-anchor="middle" dominant-baseline="central">฿</text>
  
  <!-- Chart line (upward trend) -->
  <g transform="translate(176, 296)">
    <path d="M 0 40 L 20 20 L 40 30 L 60 10 L 80 25 L 100 5 L 120 15 L 140 0 L 160 10" 
          stroke="#10b981" 
          stroke-width="8" 
          fill="none" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>
    <circle cx="0" cy="40" r="6" fill="#10b981"/>
    <circle cx="40" cy="30" r="6" fill="#10b981"/>
    <circle cx="80" cy="25" r="6" fill="#10b981"/>
    <circle cx="120" cy="15" r="6" fill="#10b981"/>
    <circle cx="160" cy="10" r="6" fill="#10b981"/>
  </g>
</svg>
`;

// Generate icons
const sizes = [192, 512];
const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating icons...');

sizes.forEach(size => {
  const svg = svgTemplate(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(publicDir, filename);
  
  fs.writeFileSync(filepath, svg);
  console.log(`✓ Created ${filename}`);
});

console.log('\n⚠️  Note: SVG files created. To convert to PNG:');
console.log('1. Open generate-icons.html in browser');
console.log('2. Click buttons to generate PNG files');
console.log('3. Or use online converter: https://cloudconvert.com/svg-to-png');
console.log('\nAlternatively, install sharp and run: npm run generate-icons-png');
