import QRCode from 'qrcode';

export interface QRDrawingOptions {
  width: number;
  margin: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  foreground: string; // Hex (e.g., #ff00ff) or Gradient spec (e.g., gradient:linear:#8a2be2:#00ffff)
  background: string; // Hex color
  dotStyle: 'square' | 'dot' | 'rounded';
  eyeStyle: 'square' | 'dot' | 'rounded';
  logoDataUrl?: string;
  logoSizeRatio?: number; // e.g., 0.2 (20% of QR size)
}

// Check if a coordinate is inside any of the 3 positioning anchors
export function isPositioningEye(r: number, c: number, size: number): boolean {
  // Top-Left (0,0) to (6,6)
  if (r < 7 && c < 7) return true;
  // Top-Right (0, size-7) to (6, size-1)
  if (r < 7 && c >= size - 7) return true;
  // Bottom-Left (size-7, 0) to (size-1, 6)
  if (r >= size - 7 && c < 7) return true;
  return false;
}

/**
 * Draws the QR code matrix onto a Canvas element with advanced custom styling.
 */
export async function drawQRCanvas(
  canvas: HTMLCanvasElement,
  content: string,
  options: QRDrawingOptions
): Promise<void> {
  const qr = QRCode.create(content, { errorCorrectionLevel: options.errorCorrectionLevel });
  const { size } = qr.modules;
  const canvasWidth = options.width;
  
  // Calculate sizing
  const rawQrWidth = canvasWidth - options.margin * 2;
  const cellSize = rawQrWidth / size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Setup Canvas DPI
  canvas.width = canvasWidth;
  canvas.height = canvasWidth;

  // 1. Fill Background
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, canvasWidth, canvasWidth);

  // 2. Setup Foreground Brush
  let fillStyle: string | CanvasGradient = options.foreground;
  if (options.foreground.startsWith('gradient:')) {
    const parts = options.foreground.split(':');
    const type = parts[1]; // linear or radial
    const color1 = parts[2] || '#8a2be2';
    const color2 = parts[3] || '#00ffff';

    if (type === 'linear') {
      const gradient = ctx.createLinearGradient(
        options.margin,
        options.margin,
        canvasWidth - options.margin,
        canvasWidth - options.margin
      );
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      fillStyle = gradient;
    } else {
      // radial
      const cx = canvasWidth / 2;
      const cy = canvasWidth / 2;
      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, canvasWidth / 2);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      fillStyle = gradient;
    }
  }

  ctx.fillStyle = fillStyle;

  // 3. Identify Logo bounds to avoid drawing pixels inside the logo area
  const logoRatio = options.logoSizeRatio || 0.2;
  const logoSize = rawQrWidth * logoRatio;
  const logoX = (canvasWidth - logoSize) / 2;
  const logoY = (canvasWidth - logoSize) / 2;

  const hasLogo = !!options.logoDataUrl;

  const isInsideLogoArea = (r: number, c: number): boolean => {
    if (!hasLogo) return false;
    const px = options.margin + c * cellSize;
    const py = options.margin + r * cellSize;
    // We add a tiny buffer margin around the logo (about 0.5 cell size)
    const buffer = cellSize * 0.5;
    return (
      px + cellSize > logoX - buffer &&
      px < logoX + logoSize + buffer &&
      py + cellSize > logoY - buffer &&
      py < logoY + logoSize + buffer
    );
  };

  // Helper: Draws a rounded rectangle path
  const roundRect = (
    cCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    cCtx.beginPath();
    cCtx.moveTo(x + r, y);
    cCtx.arcTo(x + w, y, x + w, y + h, r);
    cCtx.arcTo(x + w, y + h, x, y + h, r);
    cCtx.arcTo(x, y + h, x, y, r);
    cCtx.arcTo(x, y, x + w, y, r);
    cCtx.closePath();
  };

  // 4. Draw Eyes
  const drawEye = (ox: number, oy: number) => {
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = fillStyle;
    ctx.lineWidth = cellSize;

    const eyeSize = cellSize * 7;
    const innerDotSize = cellSize * 3;
    const innerDotOffset = cellSize * 2;

    if (options.eyeStyle === 'square') {
      // Outer border frame
      ctx.strokeRect(ox + cellSize / 2, oy + cellSize / 2, eyeSize - cellSize, eyeSize - cellSize);
      // Inner dot
      ctx.fillRect(ox + innerDotOffset, oy + innerDotOffset, innerDotSize, innerDotSize);
    } else if (options.eyeStyle === 'dot') {
      // Circle outer border frame
      ctx.beginPath();
      ctx.arc(ox + eyeSize / 2, oy + eyeSize / 2, eyeSize / 2 - cellSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      // Circle inner dot
      ctx.beginPath();
      ctx.arc(ox + eyeSize / 2, oy + eyeSize / 2, innerDotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // rounded eyes
      const radius = cellSize * 2;
      roundRect(ctx, ox + cellSize / 2, oy + cellSize / 2, eyeSize - cellSize, eyeSize - cellSize, radius);
      ctx.stroke();
      // Inner dot rounded
      const innerRadius = cellSize * 0.8;
      roundRect(ctx, ox + innerDotOffset, oy + innerDotOffset, innerDotSize, innerDotSize, innerRadius);
      ctx.fill();
    }
    ctx.restore();
  };

  // Draw the three positioning eyes
  drawEye(options.margin, options.margin); // Top-Left
  drawEye(options.margin + (size - 7) * cellSize, options.margin); // Top-Right
  drawEye(options.margin, options.margin + (size - 7) * cellSize); // Bottom-Left

  // 5. Draw Data Blocks
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip if it belongs to positioning eyes
      if (isPositioningEye(r, c, size)) continue;

      // Skip if it falls within the central logo bounds
      if (isInsideLogoArea(r, c)) continue;

      const isFilled = qr.modules.get(r, c);
      if (!isFilled) continue;

      const x = options.margin + c * cellSize;
      const y = options.margin + r * cellSize;

      ctx.save();
      ctx.fillStyle = fillStyle;

      if (options.dotStyle === 'square') {
        ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5); // Add 0.5 pixel overlap to avoid grid gaps
      } else if (options.dotStyle === 'dot') {
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, (cellSize / 2) * 0.95, 0, Math.PI * 2);
        ctx.fill();
      } else if (options.dotStyle === 'rounded') {
        // Subtle rounded blocks
        const radius = cellSize * 0.35;
        roundRect(ctx, x + 0.5, y + 0.5, cellSize, cellSize, radius);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 6. Draw Logo image Overlay (if provided)
  if (hasLogo && options.logoDataUrl) {
    try {
      const logoImg = new Image();
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = (e) => reject(e);
        logoImg.src = options.logoDataUrl!;
      });

      ctx.save();
      // Draw background shield to isolate the logo from the QR patterns
      ctx.fillStyle = options.background;
      const logoBgBuffer = cellSize * 0.4;
      roundRect(
        ctx,
        logoX - logoBgBuffer,
        logoY - logoBgBuffer,
        logoSize + logoBgBuffer * 2,
        logoSize + logoBgBuffer * 2,
        cellSize * 0.8
      );
      ctx.fill();

      // Clip logo to a nice rounded rectangle shape
      roundRect(ctx, logoX, logoY, logoSize, logoSize, cellSize * 0.6);
      ctx.clip();
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    } catch (e) {
      console.error('Failed to load logo in drawQRCanvas:', e);
    }
  }
}

/**
 * Generates an SVG string representation of the styled QR code.
 */
export async function generateQRSvg(
  content: string,
  options: QRDrawingOptions
): Promise<string> {
  const qr = QRCode.create(content, { errorCorrectionLevel: options.errorCorrectionLevel });
  const { size } = qr.modules;
  const canvasWidth = options.width;
  const rawQrWidth = canvasWidth - options.margin * 2;
  const cellSize = rawQrWidth / size;

  // Gradient definitions (if configured)
  let fillDef = '';
  let fillFill = options.foreground;

  if (options.foreground.startsWith('gradient:')) {
    const parts = options.foreground.split(':');
    const type = parts[1]; // linear or radial
    const color1 = parts[2] || '#8a2be2';
    const color2 = parts[3] || '#00ffff';
    fillFill = 'url(#qr-fg-gradient)';

    if (type === 'linear') {
      fillDef = `<linearGradient id="qr-fg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </linearGradient>`;
    } else {
      fillDef = `<radialGradient id="qr-fg-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </radialGradient>`;
    }
  }

  // Define styles
  let paths = '';

  const logoRatio = options.logoSizeRatio || 0.2;
  const logoSize = rawQrWidth * logoRatio;
  const logoX = (canvasWidth - logoSize) / 2;
  const logoY = (canvasWidth - logoSize) / 2;
  const hasLogo = !!options.logoDataUrl;

  const isInsideLogoArea = (r: number, c: number): boolean => {
    if (!hasLogo) return false;
    const px = options.margin + c * cellSize;
    const py = options.margin + r * cellSize;
    const buffer = cellSize * 0.5;
    return (
      px + cellSize > logoX - buffer &&
      px < logoX + logoSize + buffer &&
      py + cellSize > logoY - buffer &&
      py < logoY + logoSize + buffer
    );
  };

  // Helper for generating rounded path strings
  const getRoundRectPath = (x: number, y: number, w: number, h: number, r: number): string => {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    return `M ${x + r} ${y} ` +
      `L ${x + w - r} ${y} ` +
      `A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
      `L ${x + w} ${y + h - r} ` +
      `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
      `L ${x + r} ${y + h} ` +
      `A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
      `L ${x} ${y + r} ` +
      `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  };

  // 1. Draw Eyes SVG elements
  const drawEyeSvg = (ox: number, oy: number): string => {
    const eyeSize = cellSize * 7;
    const innerDotSize = cellSize * 3;
    const innerDotOffset = cellSize * 2;
    const borderOffset = cellSize / 2;

    if (options.eyeStyle === 'square') {
      return `
        <!-- Outer Frame -->
        <rect x="${ox + borderOffset}" y="${oy + borderOffset}" width="${eyeSize - cellSize}" height="${eyeSize - cellSize}" fill="none" stroke="${fillFill}" stroke-width="${cellSize}" />
        <!-- Inner Dot -->
        <rect x="${ox + innerDotOffset}" y="${oy + innerDotOffset}" width="${innerDotSize}" height="${innerDotSize}" fill="${fillFill}" />
      `;
    } else if (options.eyeStyle === 'dot') {
      const cx = ox + eyeSize / 2;
      const cy = oy + eyeSize / 2;
      const rOuter = eyeSize / 2 - cellSize / 2;
      return `
        <!-- Outer Circle Frame -->
        <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="${fillFill}" stroke-width="${cellSize}" />
        <!-- Inner Circle Dot -->
        <circle cx="${cx}" cy="${cy}" r="${innerDotSize / 2}" fill="${fillFill}" />
      `;
    } else {
      // Rounded eye
      const outerPath = getRoundRectPath(
        ox + borderOffset,
        oy + borderOffset,
        eyeSize - cellSize,
        eyeSize - cellSize,
        cellSize * 2
      );
      const innerPath = getRoundRectPath(
        ox + innerDotOffset,
        oy + innerDotOffset,
        innerDotSize,
        innerDotSize,
        cellSize * 0.8
      );
      return `
        <!-- Outer Frame Rounded -->
        <path d="${outerPath}" fill="none" stroke="${fillFill}" stroke-width="${cellSize}" />
        <!-- Inner Dot Rounded -->
        <path d="${innerPath}" fill="${fillFill}" />
      `;
    }
  };

  paths += drawEyeSvg(options.margin, options.margin);
  paths += drawEyeSvg(options.margin + (size - 7) * cellSize, options.margin);
  paths += drawEyeSvg(options.margin, options.margin + (size - 7) * cellSize);

  // 2. Draw Data Blocks SVG elements
  let dataPaths = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isPositioningEye(r, c, size)) continue;
      if (isInsideLogoArea(r, c)) continue;

      if (qr.modules.get(r, c)) {
        const x = options.margin + c * cellSize;
        const y = options.margin + r * cellSize;

        if (options.dotStyle === 'square') {
          // Add small overlap (0.3px) to resolve visual spacing gaps
          dataPaths += ` M ${x} ${y} h ${cellSize + 0.3} v ${cellSize + 0.3} h -${cellSize + 0.3} Z`;
        } else if (options.dotStyle === 'dot') {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const rRadius = (cellSize / 2) * 0.95;
          dataPaths += ` M ${cx - rRadius} ${cy} A ${rRadius} ${rRadius} 0 1 1 ${cx + rRadius} ${cy} A ${rRadius} ${rRadius} 0 1 1 ${cx - rRadius} ${cy} Z`;
        } else {
          // Rounded rect path
          const path = getRoundRectPath(x, y, cellSize, cellSize, cellSize * 0.35);
          dataPaths += ` ${path}`;
        }
      }
    }
  }

  paths += `<path d="${dataPaths}" fill="${fillFill}" />`;

  // 3. Draw Logo mask and logo image overlay
  let logoSvg = '';
  if (hasLogo && options.logoDataUrl) {
    const logoBgBuffer = cellSize * 0.4;
    const outerLogoRect = getRoundRectPath(
      logoX - logoBgBuffer,
      logoY - logoBgBuffer,
      logoSize + logoBgBuffer * 2,
      logoSize + logoBgBuffer * 2,
      cellSize * 0.8
    );
    
    // Draw background block
    logoSvg += `<path d="${outerLogoRect}" fill="${options.background}" />`;
    
    // Embed Image inside clip path
    logoSvg += `
      <g clip-path="url(#logo-clip)">
        <image href="${options.logoDataUrl}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" />
      </g>
      <clipPath id="logo-clip">
        <rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="${cellSize * 0.6}" ry="${cellSize * 0.6}" />
      </clipPath>
    `;
  }

  // Assemble full SVG
  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasWidth}" width="${canvasWidth}" height="${canvasWidth}">
  <defs>
    ${fillDef}
  </defs>
  <!-- Background -->
  <rect width="100%" height="100%" fill="${options.background}" />
  <!-- QR Shapes -->
  ${paths}
  <!-- Logo Section -->
  ${logoSvg}
</svg>`;
}
