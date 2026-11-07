// Geração de logos do Lume AI.
//
// A IA de imagens é usada quando o pedido aceita um fundo sólido. Para fundos
// transparentes (PNG/SVG) usamos um gerador vetorial local, porque JPEG não
// possui canal alfa e a IA gratuita devolve JPEG. O gerador local também é o
// fallback quando o serviço de imagens está indisponível ou limitado.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DISPLAY_FONT_PATH = path.join(ROOT, 'assets', 'fonts', 'Pacifico-Regular.ttf');
let displayFontPromise = null;

function loadDisplayFont() {
  if (!displayFontPromise) {
    displayFontPromise = fs.readFile(DISPLAY_FONT_PATH)
      .then((buffer) => opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)))
      .catch((err) => {
        console.warn('[logo] fonte de destaque indisponível, usando fonte do sistema:', err.message);
        return null;
      });
  }
  return displayFontPromise;
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const REQUEST_TIMEOUT_MS = 75_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const COLOR_MAP = {
  azul: { name: 'azul', colors: ['#1E3A8A', '#3B82F6', '#BFDBFE'] },
  verde: { name: 'verde', colors: ['#065F46', '#10B981', '#A7F3D0'] },
  roxo: { name: 'roxo', colors: ['#4C1D95', '#8B5CF6', '#DDD6FE'] },
  violeta: { name: 'violeta', colors: ['#4C1D95', '#8B5CF6', '#DDD6FE'] },
  lilas: { name: 'lilás', colors: ['#5B21B6', '#A78BFA', '#EDE9FE'] },
  laranja: { name: 'laranja', colors: ['#7C2D12', '#F97316', '#FED7AA'] },
  amarelo: { name: 'amarelo', colors: ['#713F12', '#EAB308', '#FEF08A'] },
  dourado: { name: 'dourado', colors: ['#713F12', '#D4AF37', '#FDE68A'] },
  ouro: { name: 'ouro', colors: ['#713F12', '#D4AF37', '#FDE68A'] },
  vermelho: { name: 'vermelho', colors: ['#7F1D1D', '#EF4444', '#FECACA'] },
  rosa: { name: 'rosa', colors: ['#831843', '#EC4899', '#FBCFE8'] },
  preto: { name: 'preto', colors: ['#030712', '#1F2937', '#9CA3AF'] },
  cinza: { name: 'cinza', colors: ['#111827', '#6B7280', '#E5E7EB'] },
  prata: { name: 'prata', colors: ['#334155', '#94A3B8', '#F1F5F9'] },
  branco: { name: 'branco', colors: ['#334155', '#F8FAFC', '#FFFFFF'] },
  bege: { name: 'bege', colors: ['#78350F', '#D6C7A1', '#FEF3C7'] },
  marrom: { name: 'marrom', colors: ['#451A03', '#92400E', '#FDE68A'] },
  turquesa: { name: 'turquesa', colors: ['#134E4A', '#14B8A6', '#CCFBF1'] },
  ciano: { name: 'ciano', colors: ['#164E63', '#06B6D4', '#CFFAFE'] },
  esmeralda: { name: 'esmeralda', colors: ['#064E3B', '#10B981', '#D1FAE5'] },
};

const STYLE_COLORS = {
  minimalista: ['#111827', '#374151', '#9CA3AF'],
  elegante: ['#1C1917', '#D4AF37', '#FDE68A'],
  vintage: ['#4A2C1A', '#B45309', '#FDE68A'],
  tech: ['#0C4A6E', '#06B6D4', '#CFFAFE'],
  fofo: ['#831843', '#F472B6', '#FCE7F3'],
  natural: ['#065F46', '#10B981', '#D1FAE5'],
  moderno: ['#7C2D12', '#F59E0B', '#FDE68A'],
  '3d': ['#0F172A', '#38BDF8', '#E0F2FE'],
  cartoon: ['#831843', '#F472B6', '#FCE7F3'],
  realista: ['#1C1917', '#D4AF37', '#FDE68A'],
};

const ASPECTS = {
  '1:1': { key: '1:1', ratio: '1:1', width: 768, height: 768 },
  '16:9': { key: '16:9', ratio: '16:9', width: 768, height: 432 },
  '9:16': { key: '9:16', ratio: '9:16', width: 432, height: 768 },
  '4:3': { key: '4:3', ratio: '4:3', width: 768, height: 576 },
  '3:4': { key: '3:4', ratio: '3:4', width: 576, height: 768 },
  '2:1': { key: '2:1', ratio: '2:1', width: 768, height: 384 },
};

const SVG_DIMENSIONS = {
  '1:1': [1024, 1024],
  '16:9': [1600, 900],
  '9:16': [900, 1600],
  '4:3': [1200, 900],
  '3:4': [900, 1200],
  '2:1': [1600, 800],
};

// Saída final em resolução maior (a API gratuita entrega até 768px).
const OUTPUT_DIMENSIONS = {
  '1:1': [1024, 1024],
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '2:1': [1280, 640],
};

const IMAGE_STYLE_GUIDE = {
  fotorrealista: {
    label: 'fotorrealista',
    prompt: 'photorealistic, professional photography, 50mm lens, natural lighting, shallow depth of field, ultra detailed, sharp focus, realistic textures, cinematic composition',
    negative: 'cartoon, anime, illustration, painting, drawing, 3d render, low quality, blurry, distorted, deformed, extra limbs, bad anatomy, watermark, signature, text, logo',
    format: 'jpg',
  },
  cinematografico: {
    label: 'cinematográfico',
    prompt: 'cinematic still, dramatic lighting, volumetric light, rich colors, film grain, wide angle, ultra detailed, professional color grading',
    negative: 'low quality, blurry, flat lighting, watermark, signature, text, logo',
    format: 'jpg',
  },
  anime: {
    label: 'anime',
    prompt: 'anime key visual, clean line art, vibrant colors, detailed background, expressive characters, studio quality, high detail',
    negative: 'photo, photorealistic, 3d render, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  cartoon: {
    label: 'cartoon',
    prompt: 'modern cartoon illustration, bold outlines, expressive shapes, vibrant colors, clean composition, high detail',
    negative: 'photo, photorealistic, 3d render, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  '3d': {
    label: '3D',
    prompt: 'high quality 3D render, octane render, soft studio lighting, detailed materials, subsurface scattering, global illumination, ultra detailed',
    negative: '2d, flat, photo, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  aquarela: {
    label: 'aquarela',
    prompt: 'watercolor painting, soft washes, textured paper, delicate brush strokes, artistic, high detail',
    negative: 'photo, 3d, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  pintura: {
    label: 'pintura a óleo',
    prompt: 'oil painting, expressive brush strokes, rich textures, classical composition, dramatic lighting, high detail',
    negative: 'photo, 3d, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  cyberpunk: {
    label: 'cyberpunk',
    prompt: 'cyberpunk aesthetic, neon lights, futuristic city, dramatic atmosphere, highly detailed, cinematic composition',
    negative: 'low quality, blurry, watermark, signature, text, logo',
    format: 'jpg',
  },
  minimalista: {
    label: 'minimalista',
    prompt: 'minimalist composition, clean lines, simple shapes, negative space, elegant, high quality',
    negative: 'cluttered, busy, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  'pixel art': {
    label: 'pixel art',
    prompt: 'pixel art, 16-bit style, crisp pixels, limited palette, detailed sprite, retro game aesthetic',
    negative: 'photo, 3d, smooth, blurry, watermark, signature, text, logo',
    format: 'png',
  },
  ilustracao: {
    label: 'ilustração digital',
    prompt: 'digital illustration, detailed, vibrant colors, clean composition, artstation trending, high quality',
    negative: 'photo, low quality, blurry, watermark, signature, text, logo',
    format: 'png',
  },
};

// Estilos pensados para logos. O pedido do usuário sempre tem prioridade; estes
// guias só completam o que ele não especificou. O estilo "fofo" é o que mais se
// aproxima das logos 3D de confeitaria/padaria (brilho, volume e cores vivas).
const LOGO_STYLE_GUIDE = {
  fofo: {
    label: '3D fofo e vibrante',
    prompt: 'cute 3D cartoon logo, high-quality 3D render, glossy finish, vibrant saturated colors, soft studio lighting, rounded shapes, subtle shadows, depth, playful, adorable, appetizing, polished commercial branding, ultra detailed, crisp edges',
    negative: 'flat, dull, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo, cluttered, noisy',
    format: 'png',
  },
  '3d': {
    label: '3D realista e polido',
    prompt: 'professional 3D logo render, volumetric shapes, glossy materials, soft studio lighting, reflections, depth of field, high-quality octane render, polished commercial branding, ultra detailed',
    negative: '2d, flat, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, cluttered',
    format: 'png',
  },
  cartoon: {
    label: 'cartoon ilustrado',
    prompt: 'cartoon logo, bold clean outlines, vibrant colors, playful illustrated mascot, sticker style, polished vector-like finish, commercial branding, high detail',
    negative: 'photo, realistic, flat dull, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, cluttered',
    format: 'png',
  },
  moderno: {
    label: 'moderno e profissional',
    prompt: 'modern professional logo, clean vector shapes with subtle 3D depth, balanced composition, high contrast, premium commercial branding, crisp edges, memorable, ultra detailed',
    negative: 'dated, cluttered, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo',
    format: 'png',
  },
  elegante: {
    label: 'elegante e sofisticado',
    prompt: 'luxury emblem logo, elegant typography, refined details, gold accents, premium materials, sophisticated, high-end branding, subtle 3D depth, polished, ultra detailed',
    negative: 'cheap, cartoonish, cluttered, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo',
    format: 'png',
  },
  tech: {
    label: 'tecnológico e futurista',
    prompt: 'modern tech logo, sleek geometric shapes, gradient accents, subtle glow, futuristic, digital, glossy 3D depth, premium branding, crisp edges, ultra detailed',
    negative: 'dated, flat dull, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo, cluttered',
    format: 'png',
  },
  minimalista: {
    label: 'minimalista',
    prompt: 'minimalist flat vector logo, clean lines, simple geometric shapes, negative space, elegant, high contrast, professional branding, crisp edges',
    negative: '3d, glossy, cluttered, busy, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo',
    format: 'png',
  },
  vintage: {
    label: 'vintage',
    prompt: 'vintage badge logo, retro typography, classic emblem, textured, hand-crafted feel, warm colors, stamp style, professional branding, high detail',
    negative: 'modern, futuristic, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo, cluttered',
    format: 'png',
  },
  natural: {
    label: 'natural e orgânico',
    prompt: 'organic natural logo, botanical elements, leaf motifs, earthy colors, hand-drawn feel, sustainable, artisanal, professional branding, high detail',
    negative: 'synthetic, neon, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, photo, cluttered',
    format: 'png',
  },
  realista: {
    label: 'realista e premium',
    prompt: 'photorealistic 3D logo render, realistic materials, glossy finish, studio lighting, reflections, premium commercial branding, ultra detailed, crisp edges',
    negative: 'cartoon, flat, generic abstract emblem, blurry, low quality, distorted text, misspelled letters, extra text, watermark, signature, mockup, cluttered',
    format: 'png',
  },
};

// Temas de negócio. Eles ajudam a IA a escolher elementos reconhecíveis (um
// cupcake para doces, uma folha para natural etc.) em vez de um símbolo genérico.
const THEME_GUIDE = {
  doces: {
    label: 'doces e confeitaria',
    keywords: /\b(doces?|confeitaria|bolo|bolos|cupcake|brigadeiro|chocolate|candy|sorvete|sobremesa|bakery|doce)\b/i,
    elements: 'a delicious cupcake with pink frosting and a cherry on top, a chocolate brigadeiro, a mini cupcake, candy sprinkles, small hearts, chocolate drizzle, appetizing sweets',
    colors: ['#D6336C', '#7B3F00', '#FFF1E6', '#F7C948'],
    style: 'fofo',
    round: true,
    background: { hex: '#FFF1F5', name: 'rosa claro' },
  },
  padaria: {
    label: 'padaria e café',
    keywords: /\b(padaria|caf[eé]|cafeteria|panificadora|croissant|p[aã]o|bakery|confeitaria)\b/i,
    elements: 'a warm bread loaf, a golden croissant, a coffee cup, wheat stalks, artisanal bakery details',
    colors: ['#8B5E34', '#F4A261', '#FFF8E7'],
    style: 'fofo',
    round: true,
    background: { hex: '#FFF8E7', name: 'creme' },
  },
  restaurante: {
    label: 'restaurante e comida',
    keywords: /\b(restaurante|lanchonete|hamburgueria|pizzaria|food|comida|chef|cozinha|gastronomia|bistr[oô])\b/i,
    elements: 'a chef hat, fork and knife, a plate, fresh ingredients, a subtle flame, appetizing food',
    colors: ['#7C2D12', '#F59E0B', '#FFF7ED'],
    style: 'moderno',
    round: true,
    background: { hex: '#FFF7ED', name: 'creme' },
  },
  beleza: {
    label: 'beleza e estética',
    keywords: /\b(beleza|est[eé]tica|cosm[eé]tico|maquiagem|sal[aã]o|spa|skincare|perfume|makeup|beauty)\b/i,
    elements: 'a delicate flower, a leaf, sparkles, a feminine silhouette, soft elegant details',
    colors: ['#831843', '#F472B6', '#FCE7F3'],
    style: 'elegante',
    round: true,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
  moda: {
    label: 'moda',
    keywords: /\b(moda|roupa|boutique|fashion|estilista|costura|loja de roupas)\b/i,
    elements: 'a hanger, a needle and thread, elegant geometric shapes, a fashion monogram',
    colors: ['#111827', '#D4AF37', '#F8FAFC'],
    style: 'elegante',
    round: false,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
  tecnologia: {
    label: 'tecnologia',
    keywords: /\b(tecnologia|tech|software|app|digital|startup|programa[çc][ãa]o|c[oó]digo|intelig[eê]ncia artificial)\b/i,
    elements: 'a circuit motif, a hexagon, a subtle glow, a futuristic geometric symbol',
    colors: ['#0C4A6E', '#06B6D4', '#CFFAFE'],
    style: 'tech',
    round: false,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
  pets: {
    label: 'pet',
    keywords: /\b(pet|petshop|pet shop|cachorro|gato|animal|veterin[aá]ri[oa])\b/i,
    elements: 'a cute paw print, a dog and cat silhouette, a heart, playful details',
    colors: ['#065F46', '#10B981', '#D1FAE5'],
    style: 'fofo',
    round: true,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
  fitness: {
    label: 'fitness',
    keywords: /\b(academia|fitness|treino|personal|esporte|crossfit|gin[aá]stica|muscula[çc][ãa]o)\b/i,
    elements: 'a dumbbell, a lightning bolt, dynamic geometric shapes, strong energy',
    colors: ['#111827', '#F59E0B', '#FEF3C7'],
    style: 'tech',
    round: false,
    background: { hex: '#0B0F17', name: 'preto' },
  },
  saude: {
    label: 'saúde',
    keywords: /\b(sa[uú]de|cl[ií]nica|m[eé]dic[oa]|farm[aá]cia|hospital|odontologia|dentista|psic[oó]log[oa])\b/i,
    elements: 'a heart, a leaf, a subtle cross, a caring symbol',
    colors: ['#065F46', '#10B981', '#ECFDF5'],
    style: 'moderno',
    round: true,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
  advocacia: {
    label: 'advocacia e consultoria',
    keywords: /\b(advocacia|advogad[oa]|direito|jur[ií]dico|consultoria|contabilidade|empresa|neg[oó]cio)\b/i,
    elements: 'scales of justice, a shield, classic columns, a refined monogram',
    colors: ['#1C1917', '#D4AF37', '#F8FAFC'],
    style: 'elegante',
    round: false,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
  infantil: {
    label: 'infantil',
    keywords: /\b(infantil|crian[çc]a|kids|brinquedo|escola|educa[çc][ãa]o|jogo|game)\b/i,
    elements: 'a playful star, a rainbow, a cute mascot, confetti, soft rounded shapes',
    colors: ['#7C3AED', '#F472B6', '#FEF3C7'],
    style: 'fofo',
    round: true,
    background: { hex: '#FFFFFF', name: 'branco' },
  },
};

// Objeto principal de cada tema. Ele vira o "herói" 3D no topo da logo.
// Mantemos o pedido curto de propósito: a IA gratuita segue melhor um único
// objeto bem descrito do que uma cena cheia de elementos.
const THEME_HERO = {
  doces: 'a cute 3D cartoon cupcake with pink frosting, a glossy cherry on top, chocolate drizzle and colorful sprinkles',
  padaria: 'a cute 3D cartoon golden croissant next to a small coffee cup, warm glossy finish',
  restaurante: 'a cute 3D cartoon chef hat with a fork and knife, glossy finish',
  beleza: 'a cute 3D cartoon pink flower with a small cosmetic bottle, glossy finish',
  moda: 'a cute 3D cartoon elegant clothes hanger with a golden fashion monogram, glossy finish',
  tecnologia: 'a cute 3D cartoon glowing hexagon with circuit lines, glossy finish',
  pets: 'a cute 3D cartoon paw print with a small dog and cat silhouette, glossy finish',
  fitness: 'a cute 3D cartoon dumbbell with a lightning bolt, glossy finish',
  saude: 'a cute 3D cartoon heart with a green leaf, glossy finish',
  advocacia: 'a cute 3D cartoon golden scales of justice, glossy finish',
  infantil: 'a cute 3D cartoon star with a small rainbow, glossy finish',
  default: 'a cute 3D cartoon brand symbol, glossy finish',
};

function detectTheme(text, brand = '') {
  const haystack = `${text || ''} ${brand || ''}`;
  for (const [key, theme] of Object.entries(THEME_GUIDE)) {
    if (theme.keywords.test(haystack)) return { key, ...theme };
  }
  return null;
}

function extractTagline(text) {
  const raw = String(text || '');
  const patterns = [
    /\b(?:com|como)\s+(?:o\s+)?(?:texto|frase|slogan|lema)\s*["“'‘]([^"”'’]{2,60})["”'’]/i,
    /\b(?:texto|frase|slogan|lema)\s*[:\-]\s*["“'‘]?([^"”'’\n]{2,60})/i,
    /\b(?:escrito|dizendo)\s+["“'‘]([^"”'’]{2,60})["”'’]/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (match) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (value.length >= 2) return value;
    }
  }
  return '';
}


// A API gratuita libera ~1 imagem a cada 45 s por IP. Em vez de travar todas as
// gerações por 46 s, disparamos na hora e só esperamos quando o serviço avisa
// que o limite foi atingido. Assim a primeira imagem sai rápida.
const LEGACY_IMAGE_INTERVAL_MS = 45_000;
const IMAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const IMAGE_CACHE_MAX = 16;
let imageQueue = Promise.resolve();
let cooldownUntil = 0;
const imageCache = new Map();

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('abortado'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('abortado'), { name: 'AbortError' }));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function rateLimitError(retryAfter) {
  const seconds = Math.max(1, Math.round(Number(retryAfter) || 45));
  const err = new Error(`A API gratuita libera 1 imagem a cada 45 segundos. Tente novamente em ${seconds}s ou adicione uma chave de imagens nas configurações para gerar sem espera.`);
  err.code = 'IMAGE_RATE_LIMIT';
  err.retryAfter = seconds;
  return err;
}

function parseRetryAfter(res, bodyText) {
  const header = res.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }
  const match = /retry after\s+(\d+)\s*s/i.exec(String(bodyText || ''));
  if (match) return Number(match[1]);
  return 45;
}

function imageCacheKey(prompt, spec) {
  return [
    prompt,
    spec.format || '',
    spec.aspect?.key || '',
    spec.outputWidth || '',
    spec.outputHeight || '',
    spec.background?.hex || '',
  ].join('|');
}

function getCachedImage(key) {
  const entry = imageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > IMAGE_CACHE_TTL_MS) {
    imageCache.delete(key);
    return null;
  }
  imageCache.delete(key);
  imageCache.set(key, entry);
  return entry.value;
}

function setCachedImage(key, value) {
  if (!value?.buffer || value.buffer.length > 8 * 1024 * 1024) return;
  imageCache.set(key, { at: Date.now(), value });
  while (imageCache.size > IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
}

export function imageCooldownRemaining() {
  return Math.max(0, cooldownUntil - Date.now());
}

function scheduleImage(task, signal, onStatus) {
  const run = async () => {
    const delay = Math.max(0, cooldownUntil - Date.now());
    if (delay) {
      const seconds = Math.ceil(delay / 1000);
      if (onStatus) onStatus({ message: `A API gratuita libera 1 imagem a cada 45s. Aguardando ${seconds}s…`, retryAfter: seconds });
      await wait(delay, signal);
    }
    return task();
  };
  const next = imageQueue.then(run, run);
  imageQueue = next.catch(() => {});
  return next;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeHex(value) {
  const raw = String(value || '').replace('#', '').trim();
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split('').map((char) => char + char).join('')}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`;
  return '';
}

function shade(hex, percent) {
  const value = normalizeHex(hex).replace('#', '');
  if (!value) return hex;
  const num = parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const t = Math.max(-1, Math.min(1, Number(percent) / 100));
  const target = t < 0 ? 0 : 255;
  const amount = Math.abs(t);
  const mix = (channel) => Math.round(channel + (target - channel) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function luminance(hex) {
  const value = normalizeHex(hex).replace('#', '');
  if (!value) return 1;
  const num = parseInt(value, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function detectStyle(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(3d|render|renderizado)\b/.test(lower) && /\b(cartoon|fofo|fofa|kawaii|fofinho|bonitinho|divertido|divertida)\b/.test(lower)) return 'fofo';
  if (/\b(minimalista|minimal|simples|limpo|clean|flat)\b/.test(lower)) return 'minimalista';
  if (/\b(luxo|luxuoso|elegante|premium|sofisticado|sofisticada|chique)\b/.test(lower)) return 'elegante';
  if (/\b(vintage|retr[oô]|cl[aá]ssico|classico|antigo)\b/.test(lower)) return 'vintage';
  if (/\b(tech|tecnologia|futurista|digital|cyber)\b/.test(lower)) return 'tech';
  if (/\b(moderno|moderna)\b/.test(lower)) return 'moderno';
  if (/\b(fofo|fofa|kawaii|infantil|divertido|divertida|fofinho|bonitinho)\b/.test(lower)) return 'fofo';
  if (/\b(natural|org[aâ]nico|organico|eco|sustent[aá]vel|sustentavel|folha|verde)\b/.test(lower)) return 'natural';
  if (/\b(realista|fotorrealista|foto|photorealistic|hiper-realista|hiperrealista)\b/.test(lower)) return 'realista';
  if (/\b(cartoon|desenho animado|comic|ilustrado|ilustra[çc][ãa]o)\b/.test(lower)) return 'cartoon';
  if (/\b(3d|render|renderizado|volum[eé]trico)\b/.test(lower)) return '3d';
  return '';
}

function detectColors(text, style, theme = null) {
  const raw = String(text || '');
  const hexes = [...raw.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)]
    .map((match) => normalizeHex(match[1]))
    .filter(Boolean);

  if (hexes.length) {
    if (hexes.length >= 2) {
      return {
        name: 'personalizada',
        colors: [hexes[0], hexes[1], hexes[2] || shade(hexes[1], 55)],
        explicit: true,
      };
    }
    return {
      name: 'personalizada',
      colors: [shade(hexes[0], -35), hexes[0], shade(hexes[0], 60)],
      explicit: true,
    };
  }

  const lower = raw.toLowerCase();
  const names = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
      return { ...COLOR_MAP[name], colors: [...COLOR_MAP[name].colors], explicit: true };
    }
  }

  if (theme?.colors?.length) {
    return { name: 'tema', colors: [...theme.colors], explicit: false };
  }

  return {
    name: 'padrão',
    colors: [...(STYLE_COLORS[style] || STYLE_COLORS.moderno)],
    explicit: false,
  };
}

function detectBackground(text) {
  const lower = String(text || '').toLowerCase();

  if (/\b(transparente|transpar[eê]ncia|sem fundo|fundo removido|fundo vazio|canal alfa|alpha)\b/.test(lower)) {
    return { transparent: true, hex: null, name: 'transparente', explicit: true };
  }

  const match = /\bfundo\s+(?:na cor\s+|de cor\s+|em\s+)?([a-zà-ÿ]+)/i.exec(text);
  if (match) {
    const word = match[1].toLowerCase();
    if (word === 'preto' || word === 'escuro' || word === 'escura') {
      return { transparent: false, hex: '#0B0F17', name: 'preto', explicit: true };
    }
    if (word === 'branco' || word === 'branca' || word === 'claro' || word === 'clara') {
      return { transparent: false, hex: '#FFFFFF', name: 'branco', explicit: true };
    }
    if (COLOR_MAP[word]) {
      return { transparent: false, hex: COLOR_MAP[word].colors[0], name: COLOR_MAP[word].name, explicit: true };
    }
  }

  return { transparent: false, hex: '#FFFFFF', name: 'branco', explicit: false };
}

function detectAspect(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b16\s*[:x]\s*9\b|\bhorizontal\b|\bpaisagem\b|\bwide\b/.test(lower)) return ASPECTS['16:9'];
  if (/\b9\s*[:x]\s*16\b|\bvertical\b|\bretrato\b|\bstories\b/.test(lower)) return ASPECTS['9:16'];
  if (/\b4\s*[:x]\s*3\b/.test(lower)) return ASPECTS['4:3'];
  if (/\b3\s*[:x]\s*4\b/.test(lower)) return ASPECTS['3:4'];
  if (/\b2\s*[:x]\s*1\b/.test(lower)) return ASPECTS['2:1'];
  return ASPECTS['1:1'];
}

function cleanBrand(value) {
  let brand = String(value || '')
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  brand = brand.replace(/\s+(?:em|no|na|com|de|para)\s+(?:png|jpg|jpeg|webp|svg|fundo|formato|estilo|cores?|alta|qualidade|vetor|vetorial|transparente)\b.*$/i, '');
  brand = brand.replace(/\s+(?:png|jpg|jpeg|webp|svg|transparente|com fundo|sem fundo)\b.*$/i, '');
  brand = brand.replace(/[.,;:!?]+$/g, '').trim();
  brand = brand.replace(/^(?:chamad[ao]|chama-se|nome|marca|empresa|projeto|neg[oó]cio|loja|restaurante|cafeteria|padaria|academia|cl[ií]nica|studio|est[uú]dio)\s+/i, '');
  brand = brand.replace(/^(?:minha|meu|nossa|nosso|sua|seu)\s+(?:empresa|marca|projeto|neg[oó]cio|loja|marca pessoal)\s+(?:de\s+|da\s+|do\s+)?/i, '');
  brand = brand.replace(/^(?:empresa|marca|projeto|neg[oó]cio|loja|marca pessoal)\s+(?:de\s+|da\s+|do\s+)?/i, '');
  brand = brand.replace(/^(?:de\s+|da\s+|do\s+)?(?:tecnologia|design|moda|comida|bebida|estética|estetica|beleza|saúde|saude|educação|educacao|jogos|game|games|consultoria|advocacia|engenharia|arquitetura|fotografia|marketing|varejo|serviços|servicos|produtos|software|app|loja|restaurante|café|cafeteria|padaria|academia|clínica|clinica|studio|estúdio|estudio)\s+(?=[A-ZÀ-Ý])/, '');
  brand = brand.replace(/\s+/g, ' ').trim();

  if (!brand || brand.length > 48) return '';
  if (/^(minha|meu|uma|um|a|o|sua|seu|empresa|marca|projeto|negocio|negócio|loja|marca pessoal|pessoa|cliente|ideia|logo|logotipo|café|cafeteria|restaurante|tecnologia|design|moda|comida|bebida|estética|estetica|beleza|saúde|saude|educação|educacao|jogos|game|consultoria|advocacia|engenharia|arquitetura|fotografia|marketing|varejo|serviços|servicos|produtos|software|app)$/i.test(brand)) {
    return '';
  }
  if (/\b(png|jpe?g|webp|svg|transparente|fundo|formato|estilo|cor|cores|deixe|mude|altere|troque|ajuste|refaça|coloque|quero|preciso)\b/i.test(brand)) {
    return '';
  }
  return brand;
}

function extractBrandName(text) {
  const raw = String(text || '');
  const quoted = /["“'‘]([^"”'’]{2,48})["”'’]/.exec(raw);
  if (quoted) {
    const brand = cleanBrand(quoted[1]);
    if (brand) return brand;
  }

  const patterns = [
    /\bchamad[ao]\s+["“']?([A-Za-zÀ-ÿ0-9&.'’ -]{2,48})/i,
    /\b(?:nome|marca|empresa|projeto|neg[oó]cio|loja|restaurante|cafeteria|padaria|academia|cl[ií]nica|studio|est[uú]dio|marca pessoal)\s*[:\-]?\s*(?:de\s+|da\s+|do\s+)?["“']?([A-Za-zÀ-ÿ0-9&.'’ -]{2,48})/i,
    /\b(?:logo|logotipo|logomarca|ícone|icone)\s+(?:da|do|para|de)\s+(?:(?:a|o|uma|um)\s+)?["“']?([A-Za-zÀ-ÿ0-9&.'’ -]{2,48})/i,
    /\bpara\s+(?:a|o)\s+([A-Z][A-Za-zÀ-ÿ0-9&.'’ -]{1,40})/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (match) {
      const brand = cleanBrand(match[1]);
      if (brand) return brand;
    }
  }

  if (/\blume\s*ai\b/i.test(raw)) return 'Lume AI';
  return '';
}

export function parseLogoRequest(text) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const brand = extractBrandName(raw);
  const theme = detectTheme(raw, brand);
  const explicitStyle = detectStyle(lower);
  const styleKey = explicitStyle || theme?.style || 'moderno';
  const guide = LOGO_STYLE_GUIDE[styleKey] || LOGO_STYLE_GUIDE.moderno;
  const color = detectColors(raw, styleKey, theme);
  const background = detectBackground(raw);

  if (!background.explicit && !background.transparent && theme?.background) {
    background.hex = theme.background.hex;
    background.name = theme.background.name;
  }

  const aspect = detectAspect(lower);
  const storeRequest = /\b(loja|confeitaria|doceria|padaria|restaurante|bistr[ôo]|caf[ée]|sorveteria|empresa|marca|neg[óo]cio)\b/i.test(lower);
  const defaultTaglines = {
    doces: 'CONFEITARIA ARTESANAL',
    padaria: 'PADARIA ARTESANAL',
    restaurante: 'COZINHA ARTESANAL',
    beleza: 'BELEZA & ESTILO',
    moda: 'MODA & ESTILO',
    tecnologia: 'TECNOLOGIA & INOVAÇÃO',
    saude: 'SAÚDE & BEM-ESTAR',
    fitness: 'TREINO & SAÚDE',
    pets: 'PET SHOP',
    infantil: 'DIVERSÃO & APRENDIZADO',
    advocacia: 'ADVOCACIA & CONSULTORIA',
  };
  const tagline = extractTagline(raw)
    || (storeRequest && theme?.key && defaultTaglines[theme.key] ? defaultTaglines[theme.key] : '');

  const noText = /\b(sem texto|sem letras|sem nome|somente s[ií]mbolo|s[oó] o s[ií]mbolo|apenas o s[ií]mbolo|s[ií]mbolo apenas)\b/i.test(lower);
  const wantsText = !noText && Boolean(brand);

  let format = '';
  if (/\b(jpe?g)\b/i.test(lower)) format = 'jpg';
  else if (/\bpng\b/i.test(lower)) format = 'png';
  else if (/\bwebp\b/i.test(lower)) format = 'webp';
  else if (/\b(svg|vetor|vetorial)\b/i.test(lower)) format = 'svg';

  const askedJpg = format === 'jpg';
  if (background.transparent && (!format || format === 'jpg')) format = 'png';
  if (!format) format = 'png';

  const formatNote = background.transparent && askedJpg
    ? 'JPG não aceita fundo transparente, então a logo foi entregue em PNG.'
    : '';

  const explicitAspect = /\b16\s*[:x]\s*9\b|\b9\s*[:x]\s*16\b|\b4\s*[:x]\s*3\b|\b3\s*[:x]\s*4\b|\b2\s*[:x]\s*1\b|\bhorizontal\b|\bvertical\b|\bpaisagem\b|\bretrato\b|\bwide\b|\bstories\b/i.test(lower);
  const round = /\b(redond[ao]|circular|c[ií]rculo|arredondad[ao]|badge|emblema|medalha|selo)\b/i.test(lower)
    || Boolean(theme?.round && !explicitAspect);

  return {
    raw,
    lower,
    styleKey,
    style: guide.label,
    stylePrompt: guide.prompt,
    negative: guide.negative,
    explicitStyle: Boolean(explicitStyle),
    themeKey: theme?.key || '',
    themeLabel: theme?.label || '',
    themeElements: theme?.elements || '',
    colors: color.colors,
    colorName: color.name,
    colorExplicit: Boolean(color.explicit),
    background,
    transparent: background.transparent,
    aspect,
    explicitAspect,
    brand,
    tagline,
    wantsText,
    noText,
    format,
    formatNote,
    round,
    explicitRound: /\b(redond[ao]|circular|c[ií]rculo|arredondad[ao]|badge|emblema|medalha|selo)\b/i.test(lower),
    noCache: /\b(outra|outro|varia[çc][ãa]o|vers[ãa]o|novo|nova|diferente|de novo|mais uma)\b/i.test(lower),
    context: '',
  };
}

export function isLogoRequest(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();

  const subject = /\b(logo|logotipo|logomarca|icone|ícone|emblema|simbolo|símbolo)\b/i.test(lower);
  if (!subject) return false;

  const action = /\b(crie|criar|cria|faça|faca|fazer|gere|gerar|desenhe|desenhar|monte|montar|quero|queria|preciso|precisando|pode|poderia|me ajude|ajuda|produza|produzir|mude|mudar|altere|alterar|ajuste|ajustar|refaça|refazer|troque|trocar|deixe)\b/i.test(lower);
  const starts = /^\s*(logo|logotipo|logomarca|icone|ícone|emblema|simbolo|símbolo)\b/i.test(lower);
  const question = /^\s*(o que|como|qual|quando|onde|por que|porque|quem)\b/i.test(lower);

  return (action || starts) && !question;
}

export function isLogoEditRequest(text) {
  const lower = String(text || '').toLowerCase();
  const action = /\b(mude|mudar|altere|alterar|ajuste|ajustar|refaça|refazer|troque|trocar|deixe|coloque|colocar|quero|preciso|faça|faca|fazer|crie|criar|cria|gere|gerar|produza|produzir)\b/.test(lower);
  const subject = /\b(cor|cores|fundo|formato|png|jpg|jpeg|webp|svg|transparente|estilo|texto|nome|logo|logotipo|icone|ícone|redond[ao]|circular|horizontal|vertical)\b/.test(lower);
  return action && subject;
}

export function resolveLogoSpec(text, messages = []) {
  const spec = parseLogoRequest(text);
  if (spec.brand) return spec;

  let previous = null;
  let previousSource = '';

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      const att = (message.attachments || []).find((item) => item?.kind === 'logo');
      if (att?.prompt || att?.themeKey || att?.styleKey) {
        previous = att;
        previousSource = 'attachment';
        break;
      }
    }
    if (message?.role === 'user') {
      const candidate = parseLogoRequest(message.content || '');
      if (candidate.brand) {
        previous = candidate;
        previousSource = 'user';
        break;
      }
    }
  }

  if (!previous) return spec;

  if (!spec.brand) {
    spec.brand = previous.brand || '';
    spec.wantsText = !spec.noText && Boolean(spec.brand);
  }

  if (!spec.context) {
    spec.context = previousSource === 'attachment'
      ? String(previous.prompt || '').slice(0, 500)
      : String(previous.raw || '').slice(0, 500);
  }

  if (!spec.themeKey && previous.themeKey) {
    spec.themeKey = previous.themeKey;
    spec.themeLabel = previous.themeLabel || '';
    spec.themeElements = previous.themeElements || THEME_GUIDE[previous.themeKey]?.elements || '';
  }

  if (!spec.explicitStyle && previous.styleKey) {
    spec.styleKey = previous.styleKey;
    const guide = LOGO_STYLE_GUIDE[previous.styleKey] || LOGO_STYLE_GUIDE.moderno;
    spec.style = guide.label;
    spec.stylePrompt = guide.prompt;
    spec.negative = guide.negative;
  }

  if (!spec.colorExplicit && Array.isArray(previous.colors) && previous.colors.length) {
    spec.colors = [...previous.colors];
    spec.colorName = previous.colorName || 'tema';
  }

  if (!spec.background.explicit) {
    if (previousSource === 'attachment' && previous.backgroundName) {
      spec.background = {
        transparent: Boolean(previous.transparent),
        hex: previous.transparent ? null : (previous.background || '#FFFFFF'),
        name: previous.backgroundName,
        explicit: false,
      };
      spec.transparent = Boolean(spec.background.transparent);
    } else if (previous.background && !previous.background.transparent) {
      spec.background = { ...previous.background, explicit: false };
      spec.transparent = Boolean(spec.background.transparent);
    }
  }

  const previousRatio = previous.aspect?.ratio || previous.aspectRatio;
  if (!spec.explicitAspect && previousRatio && ASPECTS[previousRatio]) {
    spec.aspect = ASPECTS[previousRatio];
  }

  if (!spec.explicitRound && typeof previous.round === 'boolean') {
    spec.round = previous.round;
  }

  if (!spec.tagline && previous.tagline) spec.tagline = previous.tagline;

  return spec;
}

// ---------------------------------------------------------------------------
// Imagens gerais (fotos, ilustrações, arte, wallpapers, avatares etc.)
// ---------------------------------------------------------------------------

function detectImageStyle(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(foto|fotografia|fotorrealista|realista|realistic|retrato|photorealistic|hiper-realista|hiperrealista)\b/.test(lower)) return 'fotorrealista';
  if (/\b(anime|mang[áa]|otaku)\b/.test(lower)) return 'anime';
  if (/\b(cartoon|desenho animado|comic|quadrinhos|tirinha)\b/.test(lower)) return 'cartoon';
  if (/\b(3d|render|blender|octane|unreal)\b/.test(lower)) return '3d';
  if (/\b(aquarela|watercolor)\b/.test(lower)) return 'aquarela';
  if (/\b([óo]leo|oleo|pintura|painting)\b/.test(lower)) return 'pintura';
  if (/\b(cyberpunk|neon|futurista|sci-fi|fic[çc][ãa]o cient[íi]fica)\b/.test(lower)) return 'cyberpunk';
  if (/\b(minimalista|minimal)\b/.test(lower)) return 'minimalista';
  if (/\b(pixel art|pixelado|8-bit|16-bit)\b/.test(lower)) return 'pixel art';
  if (/\b(ilustra[çc][ãa]o|ilustracao|illustration|arte digital|digital art)\b/.test(lower)) return 'ilustracao';
  if (/\b(cinematogr[áa]fic[oa]|cinematic|filme|movie|s[ée]rie)\b/.test(lower)) return 'cinematografico';
  return 'cinematografico';
}

function cleanImagePrompt(text) {
  let prompt = String(text || '').trim();
  prompt = prompt.replace(/^\s*(por favor,?\s*)?(crie|criar|cria|gere|gerar|desenhe|desenhar|ilustre|ilustrar|fa[çc]a|fazer|produza|produzir|quero|queria|preciso de|preciso|me mostre|mostre|monte|montar|imagine|imagina|transforme)\s+/i, '');
  prompt = prompt.replace(/^\s*(uma|um|a|o)\s+(imagem|foto|fotografia|ilustra[çc][ãa]o|ilustracao|arte|desenho|render|wallpaper|papel de parede|avatar|banner|thumbnail|miniature|figura|cartaz|poster)\s*(de|do|da|com|sobre|representando|mostrando)?\s*/i, '');
  prompt = prompt.replace(/^\s*(de|do|da|com|sobre|representando|mostrando)\s+/i, '');
  // Remove instruções de formato/proporção; elas são aplicadas separadamente.
  prompt = prompt.replace(/\b(?:no\s+formato\s+|em\s+formato\s+|formato\s+)?(?:png|jpe?g|webp|svg)\b/gi, ' ');
  prompt = prompt.replace(/\b(?:em\s+)?(?:\d+\s*[:x]\s*\d+|horizontal|vertical|paisagem|retrato|wide|stories)\b/gi, ' ');
  prompt = prompt.replace(/\b(?:com\s+)?fundo\s+transparente\b/gi, ' ');
  prompt = prompt.replace(/^\s*(de|do|da|com|sobre|representando|mostrando)\s+/i, '');
  prompt = prompt.replace(/\s*,\s*(?=,|$)/g, ' ');
  prompt = prompt.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim();
  return prompt || String(text || '').trim();
}

export function parseImageRequest(text) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const styleKey = detectImageStyle(lower);
  const style = IMAGE_STYLE_GUIDE[styleKey] || IMAGE_STYLE_GUIDE.cinematografico;
  const aspect = detectAspect(lower);
  const background = detectBackground(raw);
  const hasText = /["“'‘][^"”'’]{2,90}["”'’]/.test(raw)
    && /\b(texto|frase|escrito|letreiro|t[íi]tulo|titulo|palavra|dizer|dizendo)\b/i.test(lower);

  let format = '';
  if (/\b(jpe?g)\b/i.test(lower)) format = 'jpg';
  else if (/\bpng\b/i.test(lower)) format = 'png';
  else if (/\bwebp\b/i.test(lower)) format = 'webp';
  if (!format) format = style.format || 'png';
  if (background.transparent && format === 'jpg') format = 'png';

  const formatNote = background.transparent
    ? 'Fotos e ilustrações com IA são entregues com fundo sólido. Para transparência real, peça uma logo ou ícone.'
    : '';

  const output = OUTPUT_DIMENSIONS[aspect.key] || OUTPUT_DIMENSIONS['1:1'];

  return {
    raw,
    lower,
    kind: 'image',
    prompt: cleanImagePrompt(raw),
    styleKey,
    style: style.label,
    stylePrompt: style.prompt,
    negative: style.negative,
    background,
    transparent: false,
    transparentRequested: background.transparent,
    format,
    formatNote,
    aspect,
    outputWidth: output[0],
    outputHeight: output[1],
    hasText,
    previousPrompt: '',
  };
}

export function isImageRequest(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const question = /^\s*(o que|como|qual|quando|onde|por que|porque|quem)\b/i.test(lower);
  if (question) return false;

  const subject = /\b(imagem|foto|fotografia|ilustra[çc][ãa]o|ilustracao|arte|desenho|render|wallpaper|papel de parede|avatar|banner|thumbnail|miniature|figura|paisagem|cen[áa]rio|personagem|retrato|cartaz|poster)\b/i.test(lower);
  const action = /\b(crie|criar|cria|gere|gerar|desenhe|desenhar|ilustre|ilustrar|fa[çc]a|fazer|produza|produzir|quero|queria|preciso|precisando|pode|poderia|me mostre|mostre|monte|montar|imagine|imagina|transforme)\b/i.test(lower);
  const starts = /^\s*(imagem|foto|fotografia|ilustra[çc][ãa]o|ilustracao|arte|desenho|render|wallpaper|avatar|banner|thumbnail|cartaz|poster)\b/i.test(lower);
  const drawingAction = /\b(desenhe|desenhar|ilustre|ilustrar|pinte|pintar|renderize|renderizar|gere uma imagem|gerar uma imagem|crie uma imagem|criar uma imagem|fa[çc]a uma imagem|fazer uma imagem|fa[çc]a uma arte|fazer uma arte|quero uma imagem|quero uma foto|quero um desenho|quero uma arte)\b/i.test(lower);

  return drawingAction || ((action || starts) && subject);
}

export function isImageEditRequest(text) {
  const lower = String(text || '').toLowerCase();
  const action = /\b(mude|mudar|altere|alterar|ajuste|ajustar|refa[çc]a|refazer|troque|trocar|deixe|coloque|colocar|quero|preciso|fa[çc]a|fazer|crie|criar|cria|gere|gerar|produza|produzir|melhore|melhorar|mais|menos|outra|outro|varia[çc][ãa]o|vers[ãa]o)\b/.test(lower);
  const subject = /\b(cor|cores|fundo|formato|png|jpe?g|webp|estilo|realista|anime|cartoon|3d|aquarela|pintura|cyberpunk|minimalista|pixel|horizontal|vertical|16:9|9:16|4:3|3:4|2:1|zoom|enquadramento|ilumina[çc][ãa]o|luz|detalhe|detalhes|imagem|foto|arte|desenho|ilustra[çc][ãa]o)\b/.test(lower);
  return action && subject;
}

export function resolveImageSpec(text, messages = []) {
  const spec = parseImageRequest(text);
  let previous = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'assistant') continue;
    const att = (message.attachments || []).find((item) => item?.kind === 'image' && item?.prompt);
    if (att) {
      previous = att;
      break;
    }
  }

  if (!previous) return spec;

  spec.previousPrompt = String(previous.prompt || '').slice(0, 1500);

  // Um pedido novo com assunto próprio não deve ser misturado com a imagem
  // anterior. Só tratamos como edição quando o texto é um ajuste curto.
  const isNewRequest = isImageRequest(text)
    && !/^\s*(mude|altere|ajuste|refa[çc]a|troque|deixe|coloque|mais|menos|outra|outro|gere outra|fa[çc]a mais|deixe mais|quero mais)\b/i.test(text);
  const meaningful = spec.prompt
    .replace(/\b(?:em\s+)?(?:png|jpe?g|webp|svg|\d+\s*[:x]\s*\d+)\b/gi, '')
    .replace(/\b(?:horizontal|vertical|paisagem|retrato|wide|stories)\b/gi, '')
    .trim();
  if (isNewRequest && meaningful.length > 3) return spec;

  // Preserva proporção, formato, estilo e fundo da imagem anterior, a menos
  // que o usuário peça uma mudança explícita.
  const asksAspect = /\b16\s*[:x]\s*9\b|\b9\s*[:x]\s*16\b|\b4\s*[:x]\s*3\b|\b3\s*[:x]\s*4\b|\b2\s*[:x]\s*1\b|\bhorizontal\b|\bvertical\b|\bpaisagem\b|\bretrato\b|\bwide\b|\bstories\b/i.test(text);
  const asksFormat = /\b(jpe?g|png|webp)\b/i.test(text);
  const asksStyle = /\b(foto|fotografia|fotorrealista|realista|anime|mang[áa]|cartoon|desenho animado|3d|render|aquarela|pintura|[óo]leo|cyberpunk|neon|futurista|minimalista|pixel art|ilustra[çc][ãa]o|cinematogr[áa]fic[oa]|cinematic)\b/i.test(text);
  const asksBackground = /\b(fundo|background)\b/i.test(text);

  if (!asksAspect && ASPECTS[previous.aspectRatio]) {
    spec.aspect = ASPECTS[previous.aspectRatio];
    const output = OUTPUT_DIMENSIONS[previous.aspectRatio] || OUTPUT_DIMENSIONS['1:1'];
    spec.outputWidth = output[0];
    spec.outputHeight = output[1];
  }

  if (!asksFormat && /^(png|jpg|webp)$/i.test(String(previous.format || ''))) {
    spec.format = String(previous.format).toLowerCase();
  }

  if (!asksStyle && previous.style) {
    const guide = Object.values(IMAGE_STYLE_GUIDE).find((item) => item.label.toLowerCase() === String(previous.style).toLowerCase());
    if (guide) {
      const key = Object.keys(IMAGE_STYLE_GUIDE).find((name) => IMAGE_STYLE_GUIDE[name] === guide);
      if (key) {
        spec.styleKey = key;
        spec.style = guide.label;
        spec.stylePrompt = guide.prompt;
        spec.negative = guide.negative;
      }
    }
  }

  if (!asksBackground && previous.backgroundName) {
    spec.background = {
      transparent: false,
      hex: previous.background || '#FFFFFF',
      name: previous.backgroundName,
    };
  }

  const variationOnly = /\b(outra|outro|varia[çc][ãa]o|vers[ãa]o|novo|nova)\b/i.test(text)
    && !/\b(mude|altere|cor|cores|fundo|estilo|formato|realista|anime|cartoon|3d|aquarela|pintura|cyberpunk|minimalista|pixel|horizontal|vertical|zoom|enquadramento|luz|ilumina[çc][ãa]o)\b/i.test(text);

  if (variationOnly) {
    spec.prompt = spec.previousPrompt;
    spec.variation = true;
  } else if (isImageEditRequest(text) || !spec.prompt || spec.prompt.length < 4) {
    spec.prompt = `${spec.previousPrompt}. Ajuste solicitado: ${text}`.slice(0, 1800);
  }

  return spec;
}

function buildImagePrompt(spec) {
  const style = IMAGE_STYLE_GUIDE[spec.styleKey] || IMAGE_STYLE_GUIDE.cinematografico;
  const background = spec.background?.transparent
    ? ''
    : spec.background?.name && spec.background.name !== 'padrão'
      ? `Background: ${spec.background.name}`
      : '';
  const negative = spec.hasText
    ? style.negative.replace(/\btext,\s*/i, '').replace(/,\s*text\b/i, '')
    : style.negative;

  const parts = [
    spec.prompt,
    style.prompt,
    background,
    `Composition: ${spec.aspect.ratio} aspect ratio, balanced, professional framing`,
    spec.hasText ? 'Include the requested text accurately and legibly' : 'No text, no letters, no watermark, no signature, no logo',
    'Ultra detailed, high resolution, sharp focus, high dynamic range, masterpiece quality',
    `Avoid: ${negative}`,
  ];

  return parts.filter(Boolean).join('. ').slice(0, 1800);
}

function buildAiPrompt(spec) {
  const guide = LOGO_STYLE_GUIDE[spec.styleKey] || LOGO_STYLE_GUIDE[spec.style] || LOGO_STYLE_GUIDE.moderno;
  const theme = spec.themeKey ? THEME_GUIDE[spec.themeKey] : null;
  const elements = spec.themeElements || theme?.elements || '';
  const palette = (spec.colors || []).join(', ');
  const background = spec.background?.transparent
    ? 'transparent background'
    : `plain solid ${spec.background?.name || 'white'} background`;
  const textInstruction = spec.wantsText
    ? `The brand name "${spec.brand}" must be prominently displayed in the center of the logo, spelled exactly, in a clean, legible, elegant font with a subtle outline for contrast.`
    : 'Symbol only, no text, no letters, no words.';
  const taglineInstruction = spec.wantsText && spec.tagline
    ? `Also include the short tagline "${spec.tagline}" in a smaller, legible font below the brand name.`
    : '';
  const roundInstruction = spec.round
    ? 'Circular badge/emblem composition with a decorative border, centered, symmetrical.'
    : 'Centered emblem composition with generous margins.';
  const parts = [
    `Professional logo design for ${spec.brand ? `"${spec.brand}"` : 'a brand'}`,
    theme ? `a ${theme.label} business` : '',
    spec.context ? `Original context: ${spec.context}` : '',
    `User request: ${spec.raw}`,
    elements ? `Theme elements: ${elements}` : '',
    `Visual style: ${guide.prompt}`,
    `Color palette: ${palette}`,
    textInstruction,
    taglineInstruction,
    roundInstruction,
    `Composition: ${spec.aspect.ratio} aspect ratio, balanced, professional branding, high contrast, crisp edges`,
    background,
    'Masterpiece, best quality, ultra detailed, commercial branding, clean and memorable, no mockup, no collage, no photo, no watermark, no signature, no extra text',
    `Avoid: ${guide.negative}`,
  ];
  return parts.filter(Boolean).join('. ').slice(0, 1800);
}

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function chooseChroma(spec) {
  const primary = normalizeHex(spec.colors?.[0] || '#D6336C') || '#D6336C';
  const value = primary.replace('#', '');
  const num = parseInt(value, 16);
  const hsv = rgbToHsv((num >> 16) & 255, (num >> 8) & 255, num & 255);
  if (hsv.s > 0.15 && hsv.h >= 140 && hsv.h <= 260) {
    return { name: 'warm peach', hex: '#FFB38A' };
  }
  return { name: 'cool teal blue', hex: '#0E7490' };
}

function buildHeroPrompt(spec) {
  const hero = THEME_HERO[spec.themeKey] || THEME_HERO.default;
  const palette = (spec.colors || []).join(', ');
  const chroma = chooseChroma(spec);
  return [
    hero,
    `color palette: ${palette}`,
    'high-quality 3D render, glossy finish, soft studio lighting, appetizing, polished',
    `centered, isolated object, no plate, no table, no shadow, no props, on a solid flat ${chroma.name} background (${chroma.hex}), no text, no letters, no watermark, no signature, product icon, sticker, crisp edges`,
  ].filter(Boolean).join('. ').slice(0, 700);
}

async function cropWatermarkBuffer(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const width = Math.max(1, Number(meta.width) || 1);
  const height = Math.max(1, Number(meta.height) || 1);
  const cropX = Math.round(width * 0.035);
  const cropY = Math.round(height * 0.035);
  return sharp(buffer, { failOn: 'none' })
    .extract({
      left: cropX,
      top: cropY,
      width: Math.max(1, width - cropX * 2),
      height: Math.max(1, height - cropY * 2),
    })
    .png()
    .toBuffer();
}

export async function removePlainBackground(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height || channels < 4) return sharp(buffer, { failOn: 'none' }).png().toBuffer();

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  const sample = (x, y) => {
    const i = (y * width + x) * channels;
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
    count += 1;
  };
  for (let x = 0; x < width; x += 1) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    sample(0, y);
    sample(width - 1, y);
  }
  if (!count) return sharp(buffer, { failOn: 'none' }).png().toBuffer();

  const br = sr / count;
  const bg = sg / count;
  const bb = sb / count;
  const bgHsv = rgbToHsv(br, bg, bb);
  const neutralBackground = bgHsv.s < 0.14;

  const isBackground = (index) => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const hsv = rgbToHsv(r, g, b);
    if (neutralBackground) {
      return hsv.s < 0.20 && Math.abs(hsv.v - bgHsv.v) < 0.45;
    }
    const dr = r - br;
    const dg = g - bg;
    const db = b - bb;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const sameHue = hsv.s > 0.10
      && hueDistance(hsv.h, bgHsv.h) < 32
      && Math.abs(hsv.v - bgHsv.v) < 0.42;
    const nearNeutralEdge = hsv.s <= 0.10 && distance < 95;
    return sameHue || nearNeutralEdge;
  };

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    const index = p * channels;
    if (!isBackground(index)) return;
    data[index + 3] = 0;
    queue[tail] = p;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head];
    head += 1;
    const x = p % width;
    const y = (p - x) / width;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  // Mantém apenas o maior componente conectado (o símbolo). Isso elimina
  // marca d'água, fragmentos soltos e ilhas de fundo que sobraram.
  const component = new Int32Array(width * height).fill(-1);
  const stack = new Int32Array(width * height);
  const sizes = [];
  let componentId = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (component[start] !== -1) continue;
    if (data[start * channels + 3] <= 16) continue;
    let top = 0;
    stack[top] = start;
    top += 1;
    component[start] = componentId;
    let size = 0;
    while (top > 0) {
      top -= 1;
      const p = stack[top];
      size += 1;
      const x = p % width;
      const y = (p - x) / width;
      if (x + 1 < width) {
        const np = p + 1;
        if (component[np] === -1 && data[np * channels + 3] > 16) {
          component[np] = componentId;
          stack[top] = np;
          top += 1;
        }
      }
      if (x > 0) {
        const np = p - 1;
        if (component[np] === -1 && data[np * channels + 3] > 16) {
          component[np] = componentId;
          stack[top] = np;
          top += 1;
        }
      }
      if (y + 1 < height) {
        const np = p + width;
        if (component[np] === -1 && data[np * channels + 3] > 16) {
          component[np] = componentId;
          stack[top] = np;
          top += 1;
        }
      }
      if (y > 0) {
        const np = p - width;
        if (component[np] === -1 && data[np * channels + 3] > 16) {
          component[np] = componentId;
          stack[top] = np;
          top += 1;
        }
      }
    }
    sizes[componentId] = size;
    componentId += 1;
  }

  let largest = -1;
  for (let id = 0; id < componentId; id += 1) {
    if (largest === -1 || sizes[id] > sizes[largest]) largest = id;
  }
  for (let p = 0; p < width * height; p += 1) {
    const id = component[p];
    if (id === -1) continue;
    if (id !== largest) data[p * channels + 3] = 0;
  }

  // Suaviza somente o canal alfa para evitar bordas serrilhadas sem borrar
  // as cores do símbolo. Duas passadas + contraste removem o halo claro.
  let alpha = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) alpha[p] = data[p * channels + 3];
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x;
        let sum = alpha[p] * 4;
        let total = 4;
        if (x > 0) { sum += alpha[p - 1]; total += 1; }
        if (x + 1 < width) { sum += alpha[p + 1]; total += 1; }
        if (y > 0) { sum += alpha[p - width]; total += 1; }
        if (y + 1 < height) { sum += alpha[p + width]; total += 1; }
        next[p] = Math.round(sum / total);
      }
    }
    alpha = next;
  }
  for (let p = 0; p < width * height; p += 1) {
    const value = alpha[p];
    data[p * channels + 3] = value < 24 ? 0 : Math.min(255, Math.round((value - 24) * 1.18));
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

export async function trimTransparent(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return buffer;
  const pad = Math.max(4, Math.round(Math.min(width, height) * 0.02));
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropWidth = Math.min(width - left, maxX - minX + 1 + pad * 2);
  const cropHeight = Math.min(height - top, maxY - minY + 1 + pad * 2);
  return sharp(buffer, { failOn: 'none' })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();
}

function buildScallopPath(cx, cy, radius, scallops = 28) {
  const step = (Math.PI * 2) / scallops;
  const innerRadius = radius / (1 + Math.sin(step / 2));
  const arcRadius = innerRadius * Math.sin(step / 2);
  const points = [];
  for (let index = 0; index <= scallops; index += 1) {
    const angle = -Math.PI / 2 + index * step;
    points.push([cx + innerRadius * Math.cos(angle), cy + innerRadius * Math.sin(angle)]);
  }
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let index = 0; index < scallops; index += 1) {
    const [x2, y2] = points[index + 1];
    d += ` A ${arcRadius.toFixed(2)} ${arcRadius.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return `${d} Z`;
}

function heartPath(cx, cy, size) {
  const s = size / 24;
  return `M ${cx.toFixed(2)} ${(cy + 8 * s).toFixed(2)} C ${(cx - 12 * s).toFixed(2)} ${(cy - 2 * s).toFixed(2)} ${(cx - 12 * s).toFixed(2)} ${(cy - 14 * s).toFixed(2)} ${cx.toFixed(2)} ${(cy - 7 * s).toFixed(2)} C ${(cx + 12 * s).toFixed(2)} ${(cy - 14 * s).toFixed(2)} ${(cx + 12 * s).toFixed(2)} ${(cy - 2 * s).toFixed(2)} ${cx.toFixed(2)} ${(cy + 8 * s).toFixed(2)} Z`;
}

function buildLocalCupcakeSvg(colors) {
  const [primary, dark, light, accent] = colors;
  const frostingDeep = shade(primary, -26);
  const frostingLight = shade(primary, 30);
  const wrapperDeep = shade(dark, -22);
  const wrapperLight = shade(dark, 22);
  const accentDeep = shade(accent, -18);
  const accentLight = shade(accent, 22);
  return `
    <defs>
      <radialGradient id="lumeFrosting" cx="34%" cy="26%" r="82%">
        <stop offset="0" stop-color="${shade(light, 8)}"/>
        <stop offset="0.30" stop-color="${frostingLight}"/>
        <stop offset="0.72" stop-color="${primary}"/>
        <stop offset="1" stop-color="${frostingDeep}"/>
      </radialGradient>
      <linearGradient id="lumeWrapper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${wrapperLight}"/>
        <stop offset="0.45" stop-color="${dark}"/>
        <stop offset="1" stop-color="${wrapperDeep}"/>
      </linearGradient>
      <radialGradient id="lumeCherry" cx="34%" cy="28%" r="72%">
        <stop offset="0" stop-color="#FF9A9A"/>
        <stop offset="0.35" stop-color="#EF4444"/>
        <stop offset="1" stop-color="#9F1239"/>
      </radialGradient>
      <filter id="lumeCupcakeShadow" x="-40%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="${wrapperDeep}" flood-opacity="0.24"/>
      </filter>
    </defs>
    <ellipse cx="0" cy="112" rx="72" ry="14" fill="${wrapperDeep}" opacity="0.20"/>
    <g filter="url(#lumeCupcakeShadow)">
      <path d="M -74 4 L 74 4 L 54 102 Q 0 116 -54 102 Z" fill="url(#lumeWrapper)"/>
      <path d="M -62 14 L 62 14 L 44 94 Q 0 106 -44 94 Z" fill="${accent}" opacity="0.92"/>
      <g stroke="${wrapperDeep}" stroke-width="3.5" stroke-linecap="round" opacity="0.28">
        <path d="M -46 18 L -34 94"/>
        <path d="M -24 18 L -17 98"/>
        <path d="M -2 18 L -2 100"/>
        <path d="M 22 18 L 17 98"/>
        <path d="M 46 18 L 34 94"/>
      </g>
      <path d="M -82 6 C -92 -18 -72 -44 -46 -38 C -48 -62 -18 -76 0 -54 C 14 -82 52 -72 48 -44 C 78 -54 94 -24 80 4 C 68 28 40 40 0 40 C -42 40 -68 30 -82 6 Z" fill="url(#lumeFrosting)" stroke="${frostingDeep}" stroke-width="3"/>
      <path d="M -64 -4 C -70 -22 -50 -36 -32 -30 C -30 -46 -6 -54 6 -40 C 20 -56 44 -46 40 -26 C 58 -34 68 -14 56 0 C 44 16 24 22 0 22 C -26 22 -50 14 -64 -4 Z" fill="${light}" opacity="0.20"/>
      <ellipse cx="-34" cy="-28" rx="17" ry="10" fill="#FFFFFF" opacity="0.45" transform="rotate(-22 -34 -28)"/>
      <path d="M 2 -60 Q 12 -84 30 -94" fill="none" stroke="${wrapperDeep}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="2" cy="-60" r="20" fill="url(#lumeCherry)" stroke="${shade('#EF4444', -20)}" stroke-width="2"/>
      <ellipse cx="-4" cy="-66" rx="7" ry="4.5" fill="#FFFFFF" opacity="0.72" transform="rotate(-18 -4 -66)"/>
      <g stroke-linecap="round" stroke-width="5">
        <path d="M -36 4 L -26 12" stroke="${accent}"/>
        <path d="M 26 6 L 36 14" stroke="#FFFFFF"/>
        <path d="M 6 -6 L 16 2" stroke="#7C3AED"/>
      </g>
    </g>
  `;
}

function buildLocalStarSvg(colors) {
  const [primary, dark, light, accent] = colors;
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI / 5) * index;
    const radius = index % 2 === 0 ? 86 : 38;
    points.push(`${(Math.cos(angle) * radius).toFixed(1)},${(Math.sin(angle) * radius).toFixed(1)}`);
  }
  return `
    <circle cx="0" cy="0" r="92" fill="${light}" opacity="0.9"/>
    <circle cx="0" cy="0" r="92" fill="none" stroke="${accent}" stroke-width="6" opacity="0.8"/>
    <polygon points="${points.join(' ')}" fill="${primary}" stroke="${dark}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="-18" cy="-18" r="10" fill="#FFFFFF" opacity="0.55"/>
  `;
}

function buildLocalHeroSvg(spec, cx, cy, size) {
  const scale = size / 220;
  const inner = ['doces', 'padaria'].includes(spec.themeKey)
    ? buildLocalCupcakeSvg(spec.colors)
    : buildLocalStarSvg(spec.colors);
  return `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${scale.toFixed(5)})">${inner}</g>`;
}

function fitFontPath(font, text, targetWidth, centerX, centerY) {
  const measure = font.getPath(text, 0, 0, 100);
  const box = measure.getBoundingBox();
  const baseWidth = Math.max(1, box.x2 - box.x1);
  const size = 100 * (targetWidth / baseWidth);
  const path = font.getPath(text, 0, 0, size);
  const bounds = path.getBoundingBox();
  const x = centerX - (bounds.x2 - bounds.x1) / 2 - bounds.x1;
  const y = centerY - (bounds.y2 - bounds.y1) / 2 - bounds.y1;
  return {
    d: font.getPath(text, x, y, size).toPathData(2),
    width: bounds.x2 - bounds.x1,
    height: bounds.y2 - bounds.y1,
    size,
  };
}

export async function buildHybridLogoSvg(spec, hero = { type: 'vector' }) {
  const [width, height] = spec.outputWidth && spec.outputHeight
    ? [spec.outputWidth, spec.outputHeight]
    : (OUTPUT_DIMENSIONS[spec.aspect.key] || OUTPUT_DIMENSIONS['1:1']);
  const cx = width / 2;
  const cy = height / 2;
  const badgeRadius = Math.min(width, height) * 0.44;
  const innerRadius = badgeRadius * 0.88;
  const hasText = Boolean(spec.brand) && spec.wantsText && !spec.noText;

  const colors = Array.isArray(spec.colors) && spec.colors.length
    ? spec.colors
    : (STYLE_COLORS[spec.styleKey] || STYLE_COLORS.moderno);
  const primary = colors[0] || '#D6336C';
  const dark = colors[1] || '#7B3F00';
  const light = colors[2] || '#FFF1E6';
  const accent = colors[3] || '#F7C948';
  const palette = [primary, dark, light, accent];

  const backgroundHex = spec.background?.transparent ? null : (spec.background?.hex || '#FFFFFF');
  const backgroundRect = backgroundHex
    ? `<rect width="${width}" height="${height}" fill="url(#bgGradient)"/>`
    : '';

  const heroSize = hasText ? badgeRadius * 0.80 : badgeRadius * 1.02;
  const heroCy = hasText ? cy - badgeRadius * 0.36 : cy;

  let heroSvg = '';
  if (hero.type === 'image' && hero.dataUri) {
    const aspect = hero.width && hero.height ? hero.width / hero.height : 1;
    const heroW = aspect >= 1 ? heroSize : heroSize * aspect;
    const heroH = aspect >= 1 ? heroSize / aspect : heroSize;
    heroSvg = `<image href="${hero.dataUri}" x="${(cx - heroW / 2).toFixed(2)}" y="${(heroCy - heroH / 2).toFixed(2)}" width="${heroW.toFixed(2)}" height="${heroH.toFixed(2)}" preserveAspectRatio="xMidYMid meet" filter="url(#heroShadow)"/>`;
    if (hero.medallion) {
      const ringRadius = Math.min(heroW, heroH) / 2;
      heroSvg += `
        <circle cx="${cx}" cy="${heroCy}" r="${(ringRadius - 2).toFixed(2)}" fill="none" stroke="#FFFFFF" stroke-width="${(badgeRadius * 0.022).toFixed(2)}" opacity="0.95"/>
        <circle cx="${cx}" cy="${heroCy}" r="${(ringRadius + 3).toFixed(2)}" fill="none" stroke="url(#goldRing)" stroke-width="${(badgeRadius * 0.012).toFixed(2)}"/>
      `;
    }
  } else {
    heroSvg = buildLocalHeroSvg({ ...spec, colors: palette }, cx, heroCy, heroSize);
  }

  let brandSvg = '';
  let brandHeight = 0;
  const textCenterY = cy + badgeRadius * 0.26;
  if (hasText) {
    const font = await loadDisplayFont();
    const maxTextWidth = innerRadius * 1.42;
    if (font) {
      const fitted = fitFontPath(font, spec.brand, maxTextWidth, cx, textCenterY);
      brandHeight = fitted.height;
      brandSvg = `
        <g>
          <path d="${fitted.d}" fill="none" stroke="${shade(dark, -32)}" stroke-width="${(fitted.size * 0.115).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>
          <path d="${fitted.d}" fill="none" stroke="${shade(light, 4)}" stroke-width="${(fitted.size * 0.082).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="${fitted.d}" fill="none" stroke="#FFFFFF" stroke-width="${(fitted.size * 0.034).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="${fitted.d}" fill="url(#brandFill)"/>
        </g>
      `;
    } else {
      const fontSize = Math.min(badgeRadius * 0.30, (innerRadius * 1.6) / Math.max(1, spec.brand.length * 0.54));
      brandHeight = fontSize;
      brandSvg = `
        <text x="${cx}" y="${textCenterY.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="'Segoe Script', 'Brush Script MT', cursive" font-size="${fontSize.toFixed(2)}" fill="none" stroke="#FFFFFF" stroke-width="${(fontSize * 0.10).toFixed(2)}" stroke-linejoin="round">${escapeXml(spec.brand)}</text>
        <text x="${cx}" y="${textCenterY.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="'Segoe Script', 'Brush Script MT', cursive" font-size="${fontSize.toFixed(2)}" fill="url(#brandFill)">${escapeXml(spec.brand)}</text>
      `;
    }
  }

  const dividerY = hasText ? textCenterY + brandHeight / 2 + badgeRadius * 0.065 : cy;
  const dividerSvg = hasText
    ? `<g opacity="0.95">
        <line x1="${(cx - badgeRadius * 0.18).toFixed(2)}" y1="${dividerY.toFixed(2)}" x2="${(cx - badgeRadius * 0.055).toFixed(2)}" y2="${dividerY.toFixed(2)}" stroke="${accent}" stroke-width="${(badgeRadius * 0.006).toFixed(2)}" stroke-linecap="round"/>
        <path d="M ${cx.toFixed(2)} ${(dividerY - badgeRadius * 0.022).toFixed(2)} L ${(cx + badgeRadius * 0.022).toFixed(2)} ${dividerY.toFixed(2)} L ${cx.toFixed(2)} ${(dividerY + badgeRadius * 0.022).toFixed(2)} L ${(cx - badgeRadius * 0.022).toFixed(2)} ${dividerY.toFixed(2)} Z" fill="${accent}"/>
        <line x1="${(cx + badgeRadius * 0.055).toFixed(2)}" y1="${dividerY.toFixed(2)}" x2="${(cx + badgeRadius * 0.18).toFixed(2)}" y2="${dividerY.toFixed(2)}" stroke="${accent}" stroke-width="${(badgeRadius * 0.006).toFixed(2)}" stroke-linecap="round"/>
      </g>`
    : '';

  const taglineText = hasText && spec.tagline ? spec.tagline.toUpperCase() : '';
  const taglineFontSize = Math.max(16, badgeRadius * 0.062);
  const taglineLetterSpacing = taglineFontSize * 0.16;
  const estimatedTaglineWidth = taglineText.length * (taglineFontSize * 0.62 + taglineLetterSpacing);
  const taglineScale = Math.min(1, (innerRadius * 1.48) / Math.max(1, estimatedTaglineWidth));
  const finalTaglineFontSize = taglineFontSize * taglineScale;
  const taglineY = dividerY + badgeRadius * 0.095;
  const taglineSvg = taglineText
    ? `<text x="${cx}" y="${taglineY.toFixed(2)}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="${finalTaglineFontSize.toFixed(2)}" font-weight="700" letter-spacing="${(taglineLetterSpacing * taglineScale).toFixed(2)}" fill="${primary}">${escapeXml(taglineText)}</text>`
    : '';

  const scallop = buildScallopPath(cx, cy, badgeRadius, 24);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bgGradient" cx="50%" cy="34%" r="78%">
      <stop offset="0" stop-color="${shade(backgroundHex || '#FFFFFF', 8)}"/>
      <stop offset="0.55" stop-color="${shade(backgroundHex || '#FFFFFF', 3)}"/>
      <stop offset="1" stop-color="${backgroundHex || '#FFFFFF'}"/>
    </radialGradient>
    <linearGradient id="scallopGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(primary, 16)}"/>
      <stop offset="0.5" stop-color="${primary}"/>
      <stop offset="1" stop-color="${shade(primary, -14)}"/>
    </linearGradient>
    <radialGradient id="creamGradient" cx="50%" cy="34%" r="70%">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.66" stop-color="${light}"/>
      <stop offset="1" stop-color="${shade(light, -7)}"/>
    </radialGradient>
    <linearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(accent, 26)}"/>
      <stop offset="0.5" stop-color="${accent}"/>
      <stop offset="1" stop-color="${shade(accent, -18)}"/>
    </linearGradient>
    <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(dark, 8)}"/>
      <stop offset="0.5" stop-color="${shade(dark, -16)}"/>
      <stop offset="1" stop-color="${shade(dark, -34)}"/>
    </linearGradient>
    <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${(badgeRadius * 0.035).toFixed(2)}" stdDeviation="${(badgeRadius * 0.055).toFixed(2)}" flood-color="${dark}" flood-opacity="0.22"/>
    </filter>
    <filter id="heroShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${(badgeRadius * 0.018).toFixed(2)}" stdDeviation="${(badgeRadius * 0.030).toFixed(2)}" flood-color="${dark}" flood-opacity="0.22"/>
    </filter>
    <filter id="brandShadow" x="-20%" y="-30%" width="140%" height="170%">
      <feDropShadow dx="0" dy="${(badgeRadius * 0.010).toFixed(2)}" stdDeviation="${(badgeRadius * 0.008).toFixed(2)}" flood-color="${shade(dark, -35)}" flood-opacity="0.18"/>
    </filter>
  </defs>
  ${backgroundRect}
  <path d="${scallop}" fill="url(#scallopGradient)" filter="url(#badgeShadow)"/>
  <circle cx="${cx}" cy="${cy}" r="${innerRadius.toFixed(2)}" fill="url(#creamGradient)"/>
  <circle cx="${cx}" cy="${cy}" r="${(innerRadius * 0.975).toFixed(2)}" fill="none" stroke="url(#goldRing)" stroke-width="${(badgeRadius * 0.016).toFixed(2)}"/>
  ${heroSvg}
  ${brandSvg}
  ${dividerSvg}
  ${taglineSvg}
</svg>`;
}

async function renderHybridLogo(spec, hero) {
  const svg = await buildHybridLogoSvg(spec, hero);
  const rendered = await convertLocal(spec, svg);
  return {
    ...rendered,
    source: hero?.type === 'image' ? 'ai' : 'local',
    hybrid: true,
  };
}

export async function computeOpaqueRatio(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height) return 1;
  let opaque = 0;
  for (let p = 0; p < width * height; p += 1) {
    if (data[p * channels + 3] > 16) opaque += 1;
  }
  return opaque / (width * height);
}

export async function computeCoolRatio(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let opaque = 0;
  let cool = 0;
  for (let p = 0; p < width * height; p += 1) {
    const i = p * channels;
    if (data[i + 3] <= 16) continue;
    opaque += 1;
    const hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (hsv.s > 0.15 && hsv.h >= 140 && hsv.h <= 260) cool += 1;
  }
  return opaque ? cool / opaque : 0;
}

export async function trimBottomFringe(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height) return buffer;
  const startY = Math.max(0, Math.round(height * 0.88));
  let total = 0;
  let cool = 0;
  for (let y = startY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i + 3] <= 16) continue;
      total += 1;
      const hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      if (hsv.s > 0.15 && hsv.h >= 140 && hsv.h <= 260) cool += 1;
    }
  }
  if (total > 0 && cool / total > 0.15) {
    return sharp(buffer, { failOn: 'none' })
      .extract({ left: 0, top: 0, width, height: Math.max(1, Math.round(height * 0.93)) })
      .png()
      .toBuffer();
  }
  return buffer;
}

export async function buildMedallion(buffer, size = 640) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const width = Number(meta.width) || 1;
  const height = Number(meta.height) || 1;
  const side = Math.min(width, height);
  const crop = Math.max(1, Math.round(side * 0.82));
  const left = Math.max(0, Math.round((width - crop) / 2));
  const top = Math.max(0, Math.round((height - crop) / 2));
  const resized = await sharp(buffer, { failOn: 'none' })
    .extract({ left, top, width: crop, height: crop })
    .resize(size, size, { fit: 'cover' })
    .modulate({ saturation: 1.06, brightness: 1.02 })
    .png()
    .toBuffer();

  const tint = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <radialGradient id="t" cx="50%" cy="42%" r="62%">
        <stop offset="0" stop-color="#FF8FB3" stop-opacity="0.10"/>
        <stop offset="0.62" stop-color="#FF7AA2" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#5A1E2E" stop-opacity="0.34"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#t)"/>
  </svg>`;

  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <radialGradient id="m" cx="50%" cy="50%" r="50%">
        <stop offset="0.90" stop-color="#FFFFFF" stop-opacity="1"/>
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#m)"/>
  </svg>`;

  return sharp(resized)
    .composite([
      { input: Buffer.from(tint), blend: 'soft-light' },
      { input: Buffer.from(mask), blend: 'dest-in' },
    ])
    .png()
    .toBuffer();
}

export async function prepareHero(spec, signal, onStatus) {
  const cooldown = imageCooldownRemaining();
  if (cooldown > 0) {
    return { type: 'vector', rateLimited: true, retryAfter: Math.ceil(cooldown / 1000) };
  }

  const prompt = buildHeroPrompt(spec);
  const url = new URL(`${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('width', '768');
  url.searchParams.set('height', '768');
  url.searchParams.set('seed', String(Math.floor(Math.random() * 1_000_000_000)));
  url.searchParams.set('model', 'flux');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('safe', 'true');
  url.searchParams.set('enhance', 'false');

  const buffer = await fetchPollinationsImage(url, signal, 0, onStatus);
  const cropped = await cropWatermarkBuffer(buffer);
  const transparent = await removePlainBackground(cropped);
  const trimmed = await trimBottomFringe(await trimTransparent(transparent));
  const opaqueRatio = await computeOpaqueRatio(trimmed);
  const coolRatio = await computeCoolRatio(trimmed);

  // Se o recorte não isolou o símbolo, usa um medalhão circular para não
  // aparecer um quadrado de fundo no meio da logo.
  if (opaqueRatio > 0.80 || coolRatio > 0.035) {
    const medallion = await buildMedallion(cropped);
    const medallionMeta = await sharp(medallion, { failOn: 'none' }).metadata();
    return {
      type: 'image',
      buffer: medallion,
      dataUri: `data:image/png;base64,${medallion.toString('base64')}`,
      width: Number(medallionMeta.width) || 1,
      height: Number(medallionMeta.height) || 1,
      medallion: true,
    };
  }

  const meta = await sharp(trimmed, { failOn: 'none' }).metadata();
  return {
    type: 'image',
    buffer: trimmed,
    dataUri: `data:image/png;base64,${trimmed.toString('base64')}`,
    width: Number(meta.width) || 1,
    height: Number(meta.height) || 1,
  };
}

function hexPoints(cx, cy, radius) {
  const points = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(' ');
}

function buildLogoSvg(spec) {
  const [width, height] = SVG_DIMENSIONS[spec.aspect.key] || SVG_DIMENSIONS['1:1'];
  const hasText = Boolean(spec.brand) && spec.wantsText && !spec.noText;
  const isWide = width > height;
  const markSize = isWide ? Math.min(height * 0.5, 420) : Math.min(width * 0.44, 420);
  const markCx = hasText && isWide ? width * 0.28 : width / 2;
  const markCy = hasText && !isWide ? height * 0.4 : height / 2;
  const radius = markSize / 2;

  const [dark, primary, accent] = spec.colors;
  const textColor = spec.background.transparent
    ? (spec.colorName === 'branco' ? '#FFFFFF' : '#111827')
    : (luminance(spec.background.hex) < 0.5 ? '#FFFFFF' : '#111827');

  const fontFamily = ['elegante', 'vintage'].includes(spec.style)
    ? "Georgia, 'Times New Roman', serif"
    : spec.style === 'fofo'
      ? "'Trebuchet MS', 'Segoe UI', sans-serif"
      : "'Segoe UI', Arial, sans-serif";
  const fontWeight = ['elegante', 'vintage'].includes(spec.style) ? 700 : 800;
  const brandText = ['moderno', 'tech', 'minimalista'].includes(spec.style)
    ? spec.brand.toUpperCase()
    : spec.brand;

  let lines = [brandText];
  if (hasText && !isWide && brandText.length > 14 && brandText.includes(' ')) {
    const words = brandText.split(/\s+/);
    const middle = Math.ceil(words.length / 2);
    lines = [words.slice(0, middle).join(' '), words.slice(middle).join(' ')];
  }

  const maxTextWidth = isWide ? width * 0.42 : width * 0.78;
  const longest = Math.max(...lines.map((line) => line.length));
  let fontSize = Math.min(112, Math.max(44, Math.floor((maxTextWidth / Math.max(1, longest)) * 1.55)));
  if (lines.length > 1) fontSize = Math.min(fontSize, 78);

  const lineHeight = fontSize * 1.12;
  const textX = hasText && isWide ? width * 0.5 : width / 2;
  const textAnchor = hasText && isWide ? 'start' : 'middle';
  const textY = hasText && !isWide ? height * 0.76 : height / 2;
  const textBlockOffset = (lines.length - 1) / 2;

  let badgeShape;
  if (spec.round || ['minimalista', 'natural', 'fofo', 'elegante'].includes(spec.style)) {
    badgeShape = `<circle cx="${markCx}" cy="${markCy}" r="${radius}" fill="url(#badge)" filter="url(#shadow)"/>`;
  } else if (spec.style === 'tech') {
    badgeShape = `<polygon points="${hexPoints(markCx, markCy, radius)}" fill="url(#badge)" filter="url(#shadow)"/>`;
  } else {
    badgeShape = `<rect x="${markCx - radius}" y="${markCy - radius}" width="${radius * 2}" height="${radius * 2}" rx="${radius * (spec.style === 'fofo' ? 0.38 : 0.26)}" fill="url(#badge)" filter="url(#shadow)"/>`;
  }

  const ring = ['elegante', 'vintage', 'minimalista'].includes(spec.style)
    ? `<circle cx="${markCx}" cy="${markCy}" r="${radius + Math.max(8, radius * 0.06)}" fill="none" stroke="${accent}" stroke-width="${Math.max(4, radius * 0.035)}" opacity="0.55"/>`
    : '';

  const flameScale = (radius * 1.44) / 400;
  const flameX = markCx - radius * 0.72;
  const flameY = markCy - radius * 0.72;

  const textSvg = hasText
    ? lines
        .map((line, index) => {
          const estimated = line.length * fontSize * 0.58;
          const lengthAttr = estimated > maxTextWidth
            ? ` textLength="${maxTextWidth.toFixed(0)}" lengthAdjust="spacingAndGlyphs"`
            : '';
          const y = textY + (index - textBlockOffset) * lineHeight;
          return `<text x="${textX.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="${textAnchor}" dominant-baseline="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${Math.max(1, fontSize * 0.03).toFixed(1)}" fill="${textColor}"${lengthAttr}>${escapeXml(line)}</text>`;
        })
        .join('')
    : '';

  const backgroundRect = spec.background.transparent
    ? ''
    : `<rect width="${width}" height="${height}" fill="${spec.background.hex}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="1" stop-color="${primary}"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${Math.round(radius * 0.06)}" stdDeviation="${Math.round(radius * 0.08)}" flood-color="${dark}" flood-opacity="0.28"/>
    </filter>
  </defs>
  ${backgroundRect}
  ${badgeShape}
  ${ring}
  <g transform="translate(${flameX.toFixed(2)} ${flameY.toFixed(2)}) scale(${flameScale.toFixed(5)})">
    <path d="M200 40 C230 110 300 150 300 235 C300 305 255 350 200 350 C145 350 100 305 100 235 C100 190 125 155 155 120 C162 165 178 190 200 205 C200 160 200 100 200 40 Z" fill="url(#flame)"/>
    <path d="M200 160 C218 200 245 220 245 260 C245 295 225 315 200 315 C175 315 155 295 155 260 C155 235 170 215 185 200 C190 220 195 230 200 235 C200 210 200 185 200 160 Z" fill="${accent}" opacity="0.92"/>
  </g>
  ${textSvg}
</svg>`;
}

async function convertLocal(spec, svg) {
  if (spec.format === 'svg') {
    return {
      buffer: Buffer.from(svg),
      mimeType: 'image/svg+xml',
      ext: 'svg',
      source: 'local',
      width: spec.aspect.width,
      height: spec.aspect.height,
    };
  }

  const pipeline = sharp(Buffer.from(svg));

  if (spec.format === 'jpg') {
    return {
      buffer: await pipeline.flatten({ background: spec.background.hex || '#FFFFFF' }).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer(),
      mimeType: 'image/jpeg',
      ext: 'jpg',
      source: 'local',
      width: spec.aspect.width,
      height: spec.aspect.height,
    };
  }

  if (spec.format === 'webp') {
    return {
      buffer: await pipeline.webp({ quality: 94 }).toBuffer(),
      mimeType: 'image/webp',
      ext: 'webp',
      source: 'local',
      width: spec.aspect.width,
      height: spec.aspect.height,
    };
  }

  return {
    buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
    mimeType: 'image/png',
    ext: 'png',
    source: 'local',
    width: spec.aspect.width,
    height: spec.aspect.height,
  };
}

async function renderLocal(spec) {
  const svg = buildLogoSvg(spec);
  try {
    return await convertLocal(spec, svg);
  } catch (err) {
    console.warn('[logo] falha ao converter o SVG:', err.message);
    return {
      buffer: Buffer.from(svg),
      mimeType: 'image/svg+xml',
      ext: 'svg',
      source: 'local',
      width: spec.aspect.width,
      height: spec.aspect.height,
      formatNote: 'Entreguei em SVG para garantir o arquivo.',
    };
  }
}

async function convertAiImage(buffer, spec) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const sourceWidth = Math.max(1, Number(meta.width) || 1);
  const sourceHeight = Math.max(1, Number(meta.height) || 1);

  // A API gratuita coloca uma pequena marca no canto. Um corte leve remove a
  // marca sem alterar a composição principal.
  const cropX = Math.min(Math.round(sourceWidth * 0.055), Math.max(0, sourceWidth - 1));
  const cropY = Math.min(Math.round(sourceHeight * 0.055), Math.max(0, sourceHeight - 1));
  const width = Math.max(1, sourceWidth - cropX);
  const height = Math.max(1, sourceHeight - cropY);
  const [targetWidth, targetHeight] = spec.outputWidth && spec.outputHeight
    ? [spec.outputWidth, spec.outputHeight]
    : (OUTPUT_DIMENSIONS[spec.aspect.key] || OUTPUT_DIMENSIONS['1:1']);

  const pipeline = sharp(buffer, { failOn: 'none' })
    .extract({ left: 0, top: 0, width, height })
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 });

  if (spec.format === 'jpg') {
    return {
      buffer: await pipeline.flatten({ background: spec.background?.hex || '#FFFFFF' }).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer(),
      mimeType: 'image/jpeg',
      ext: 'jpg',
      source: 'ai',
      width: targetWidth,
      height: targetHeight,
    };
  }

  if (spec.format === 'webp') {
    return {
      buffer: await pipeline.webp({ quality: 94 }).toBuffer(),
      mimeType: 'image/webp',
      ext: 'webp',
      source: 'ai',
      width: targetWidth,
      height: targetHeight,
    };
  }

  return {
    buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
    mimeType: 'image/png',
    ext: 'png',
    source: 'ai',
    width: targetWidth,
    height: targetHeight,
  };
}

async function fetchPollinationsImage(url, signal, retries = 1, onStatus = null) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', forwardAbort, { once: true });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LumeAI/1.4' },
      signal: controller.signal,
    });

    if (res.status === 402 || res.status === 429) {
      const bodyText = await res.text().catch(() => '');
      const retryAfter = parseRetryAfter(res, bodyText);
      cooldownUntil = Math.max(cooldownUntil, Date.now() + retryAfter * 1000);

      if (retries > 0) {
        const seconds = Math.max(1, Math.min(60, Math.round(retryAfter)));
        if (onStatus) onStatus({ message: `A API gratuita libera 1 imagem a cada 45s. Aguardando ${seconds}s…`, retryAfter: seconds });
        await wait(seconds * 1000, signal);
        return fetchPollinationsImage(url, signal, retries - 1, onStatus);
      }

      throw rateLimitError(retryAfter);
    }

    if (!res.ok) throw new Error(`serviço de imagens respondeu HTTP ${res.status}`);

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('o serviço não devolveu uma imagem');

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1024) throw new Error('imagem vazia');
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('imagem grande demais');

    // O limite gratuito recomeça a contar a partir do início da requisição.
    cooldownUntil = Math.max(cooldownUntil, startedAt + LEGACY_IMAGE_INTERVAL_MS);
    return buffer;
  } catch (err) {
    if (err.name === 'AbortError') {
      if (timedOut) throw new Error('tempo esgotado ao gerar a imagem');
      throw err;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }
}

async function generatePollinationsImage(prompt, spec, signal, onStatus = null) {
  const cacheKey = imageCacheKey(prompt, spec);
  if (!spec.noCache) {
    const cached = getCachedImage(cacheKey);
    if (cached) {
      if (onStatus) onStatus({ message: 'Reaproveitando uma imagem gerada agora…' });
      return { ...cached, prompt, cached: true };
    }
  }

  const url = new URL(`${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('width', String(spec.aspect.width));
  url.searchParams.set('height', String(spec.aspect.height));
  url.searchParams.set('seed', String(Math.floor(Math.random() * 1_000_000_000)));
  url.searchParams.set('model', 'flux');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('safe', 'true');
  url.searchParams.set('enhance', 'false');

  const buffer = await scheduleImage(
    () => fetchPollinationsImage(url, signal, 1, onStatus),
    signal,
    onStatus,
  );
  const converted = await convertAiImage(buffer, spec);
  const result = { ...converted, prompt };
  if (!spec.noCache) setCachedImage(cacheKey, result);
  return result;
}

export async function createLogo({ text, messages = [], signal, onStatus } = {}) {
  const spec = resolveLogoSpec(text, messages);
  spec.aiPrompt = buildHeroPrompt(spec);

  // SVG de verdade: usa o símbolo vetorial local, sem raster.
  if (spec.format === 'svg') {
    const svg = await buildHybridLogoSvg(spec, { type: 'vector' });
    return {
      buffer: Buffer.from(svg),
      mimeType: 'image/svg+xml',
      ext: 'svg',
      source: 'local',
      width: spec.aspect.width,
      height: spec.aspect.height,
      spec,
      heroSource: 'vector',
    };
  }

  let hero;
  try {
    if (onStatus) onStatus({ message: 'Criando o símbolo da sua logo com IA…' });
    hero = await prepareHero(spec, signal, onStatus);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('[logo] símbolo com IA indisponível, usando o símbolo vetorial:', err.message);
    hero = {
      type: 'vector',
      rateLimited: err.code === 'IMAGE_RATE_LIMIT',
      retryAfter: err.retryAfter || 0,
    };
  }

  try {
    const rendered = await renderHybridLogo(spec, hero);
    return {
      ...rendered,
      spec,
      heroSource: hero.type === 'image' ? 'ai' : 'vector',
      rateLimited: Boolean(hero.rateLimited),
      retryAfter: hero.retryAfter || 0,
    };
  } catch (err) {
    console.warn('[logo] falha no compositor híbrido, usando o gerador local:', err.message);
    const local = await renderLocal(spec);
    return {
      ...local,
      spec,
      heroSource: 'vector',
      rateLimited: Boolean(hero?.rateLimited),
      retryAfter: hero?.retryAfter || 0,
    };
  }
}

export async function createImage({ text, messages = [], signal, onStatus } = {}) {
  const spec = resolveImageSpec(text, messages);
  const prompt = buildImagePrompt(spec);
  spec.aiPrompt = prompt;

  try {
    return { ...(await generatePollinationsImage(prompt, spec, signal, onStatus)), spec };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.code === 'IMAGE_RATE_LIMIT') throw err;
    console.warn('[imagem] IA de imagem indisponível:', err.message);
    const friendly = new Error('Não consegui gerar a imagem agora. A fila gratuita de imagens pode estar ocupada; tente novamente em alguns segundos.');
    friendly.code = 'IMAGE_ERROR';
    throw friendly;
  }
}

export function buildLogoCaption({ spec, image }) {
  const format = String(image.ext || spec.format || 'png').toUpperCase();
  const background = spec.transparent ? 'transparente' : (spec.background.name || 'branco');
  const lines = [
    'Aqui está a sua logo! 🎨',
    '',
    `- **Formato:** ${format}`,
    `- **Fundo:** ${background}`,
    spec.brand ? `- **Marca:** ${spec.brand}` : '- **Marca:** símbolo, sem texto',
    `- **Estilo:** ${spec.style}`,
  ];

  if (spec.themeLabel) lines.push(`- **Tema:** ${spec.themeLabel}`);

  if (image.heroSource === 'ai') {
    lines.push('- **Arte:** símbolo 3D gerado por IA + nome aplicado em alta definição');
  } else if (image.rateLimited) {
    lines.push(`- **Arte:** símbolo vetorial do Lume AI (a IA de imagens está no limite gratuito). Peça “outra versão” em ${image.retryAfter || 45}s para tentar a arte 3D.`);
  } else {
    lines.push('- **Arte:** símbolo vetorial do Lume AI + nome aplicado em alta definição');
  }

  if (spec.formatNote) lines.push(`- ${spec.formatNote}`);
  if (image.formatNote) lines.push(`- ${image.formatNote}`);

  lines.push('', 'Quer ajustar? Peça: “deixe o fundo transparente”, “mude para azul”, “quero em JPG” ou “sem texto”.');
  return lines.join('\n');
}

export function buildImageCaption({ spec, image }) {
  const format = String(image.ext || spec.format || 'png').toUpperCase();
  const lines = [
    'Aqui está a imagem que você pediu! 🖼️',
    '',
    `- **Formato:** ${format}`,
    `- **Estilo:** ${spec.style}`,
    `- **Proporção:** ${spec.aspect.ratio}`,
  ];

  if (spec.formatNote) lines.push(`- ${spec.formatNote}`);

  lines.push('', 'Quer ajustar? Peça: “mais realista”, “fundo preto”, “em 16:9”, “outra variação” ou “mais detalhes”.');
  return lines.join('\n');
}
