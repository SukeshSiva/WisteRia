import sharp from 'sharp';
import fs from 'fs';

async function processIcon(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${filePath} - not found`);
        return;
    }

    console.log(`Processing ${filePath}...`);
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const size = Math.min(width, height);
    const rx = size * 0.2236; // Big Sur+ corner radius ratio

    const svgMask = `
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="white" />
    </svg>
  `;

    const maskBuffer = Buffer.from(svgMask);

    // Create squircled version
    await sharp(filePath)
        .resize(size, size)
        .composite([{ input: maskBuffer, blend: 'dest-in' }])
        .toFile(filePath + '.temp.png');

    fs.renameSync(filePath + '.temp.png', filePath);
    console.log(`Done processing ${filePath}`);
}

async function main() {
    await processIcon('./public/app-icon-dark.png');
    await processIcon('./public/app-icon-light.png');
    await processIcon('./AppIcons D/DARK Large.png');
    await processIcon('./AppIcons L/LIGHT Large.png');
}

main().catch(console.error);
