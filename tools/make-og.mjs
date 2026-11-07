import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="18%" cy="8%" r="70%">
      <stop offset="0" stop-color="#F59E0B" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#0B0A09" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="92%" cy="10%" r="60%">
      <stop offset="0" stop-color="#FB923C" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#0B0A09" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDE68A"/>
      <stop offset="1" stop-color="#F97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0B0A09"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <g transform="translate(90 92)">
    <rect width="132" height="132" rx="34" fill="#1D1A17" stroke="#3A332B"/>
    <g transform="translate(30 22) scale(1.15)">
      <path d="M32 4 C37 18 49 25 49 40 C49 51 41 59 32 59 C23 59 15 51 15 40 C15 32 20 26 25 19 C26 27 29 31 32 34 C32 26 32 15 32 4 Z" fill="url(#flame)"/>
    </g>
  </g>
  <text x="250" y="180" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="#F5F1EA">Lume AI</text>
  <text x="90" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="78" font-weight="800" fill="#F5F1EA" letter-spacing="-3">Pense, crie e resolva</text>
  <text x="90" y="418" font-family="Segoe UI, Arial, sans-serif" font-size="78" font-weight="800" fill="#F5F1EA" letter-spacing="-3">tudo com o Lume AI.</text>
  <text x="90" y="488" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#A8A099">Conversa, pesquisa na web, imagens e logos em português.</text>
  <rect x="90" y="530" width="210" height="52" rx="26" fill="#F59E0B"/>
  <text x="195" y="563" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" fill="#1A1208">Começar agora</text>
  <text x="1110" y="575" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#6B635B">assistente pessoal com IA</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(ROOT, 'public', 'og-image.png'));
console.log('og-image.png criado');
