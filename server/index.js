import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MODEL,
  DEFAULT_MODELS,
  FALLBACK_MODELS,
  GeminiError,
  brandModelName,
  generateText,
  isModelId,
  listAvailableModels,
  streamChat,
} from './gemini.js';
import { PERSONA_LIST, buildSystemPrompt } from './prompts.js';
import { generateFallbackText } from './fallback.js';
import { getDemoStore } from './demo.js';
import {
  buildImageCaption,
  buildLogoCaption,
  createImage,
  createLogo,
  isImageEditRequest,
  isImageRequest,
  isLogoEditRequest,
  isLogoRequest,
} from './images.js';
import * as plans from './plans.js';
import * as store from './store.js';

const APP_VERSION = '1.4.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = String(process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
const PUBLIC_MODE = process.env.PUBLIC_MODE === 'true';
const PUBLIC_DAILY_MESSAGE_CAP = Math.max(1, Number(process.env.PUBLIC_DAILY_MESSAGE_CAP) || 300);
let publicDay = '';
let publicMessages = 0;

function checkPublicDailyCap() {
  if (!PUBLIC_MODE) return null;
  const day = new Date().toISOString().slice(0, 10);
  if (publicDay !== day) {
    publicDay = day;
    publicMessages = 0;
  }
  if (publicMessages >= PUBLIC_DAILY_MESSAGE_CAP) {
    return {
      error: 'A demonstração pública atingiu o limite de mensagens de hoje. Entre no Discord para saber mais ou volte amanhã.',
      code: 'PUBLIC_LIMIT',
    };
  }
  return null;
}

const ATTACHMENT_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
  ['application/pdf', 'pdf'],
]);
const MAX_TOTAL_ATTACHMENT_BYTES = 35 * 1024 * 1024;

const app = express();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64mb' }));

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
}

// Injeta a URL pública nos metadados de SEO sem precisar editar o HTML.
app.get(['/', '/index.html'], ah(async (req, res) => {
  const base = publicBaseUrl(req);
  const html = (await fs.readFile(path.join(ROOT, 'public', 'index.html'), 'utf8'))
    .replaceAll('__PUBLIC_URL__', base);
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
}));

app.get(['/sobre', '/sobre.html'], ah(async (req, res) => {
  const base = publicBaseUrl(req);
  const html = (await fs.readFile(path.join(ROOT, 'public', 'sobre.html'), 'utf8'))
    .replaceAll('__PUBLIC_URL__', base);
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
}));

app.get('/robots.txt', (req, res) => {
  const base = publicBaseUrl(req);
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const base = publicBaseUrl(req);
  const now = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/sobre</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
</urlset>`);
});

app.use(express.static(path.join(ROOT, 'public'), {
  maxAge: 0,
  etag: true,
  extensions: ['html'],
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));
app.use('/api/uploads', express.static(store.UPLOADS_DIR, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));

// Na demonstração pública cada visitante tem um armazenamento isolado em
// memória. No uso local, usa o armazenamento normal em arquivos.
app.use('/api', (req, res, next) => {
  req.lumeStore = PUBLIC_MODE ? getDemoStore(req, res) : store;
  next();
});

function httpError(status, message, code = 'BAD_REQUEST') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function resolveKey(settings) {
  const fromSettings = String(settings.apiKey || '').trim();
  if (fromSettings) return { key: fromSettings, source: 'settings' };
  const fromEnv = String(process.env.LUME_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (fromEnv) return { key: fromEnv, source: 'env' };
  return { key: '', source: null };
}

function normalizeModel(value) {
  if (!isModelId(value)) return DEFAULT_MODEL;
  if (/^gemini-(?:1|2)\./.test(String(value))) return DEFAULT_MODEL;
  return value;
}

// No modo público o armazenamento da sessão tem a própria cota. No modo local
// usamos a cota global baseada em arquivo.
function billingFor(storeApi) {
  return storeApi?.getBillingStatus ? storeApi.getBillingStatus() : plans.getBillingStatus();
}

function checkMessageAllowedFor(storeApi) {
  return storeApi?.checkMessageAllowed ? storeApi.checkMessageAllowed() : plans.checkMessageAllowed();
}

function consumeMessageFor(storeApi) {
  return storeApi?.consumeMessage ? storeApi.consumeMessage() : plans.consumeMessage();
}

function checkAttachmentsAllowedFor(storeApi, count) {
  return storeApi?.checkAttachmentsAllowed
    ? storeApi.checkAttachmentsAllowed(count)
    : plans.checkAttachmentsAllowed(count);
}

function consumeAttachmentsFor(storeApi, count) {
  return storeApi?.consumeAttachments ? storeApi.consumeAttachments(count) : plans.consumeAttachments(count);
}

function maskKey(key) {
  if (!key) return '';
  return `••••${key.slice(-4)}`;
}

async function buildState(storeApi = store) {
  const settings = await storeApi.getSettings();
  const { key, source } = resolveKey(settings);
  return {
    configured: Boolean(key),
    keySource: source,
    keyPreview: PUBLIC_MODE ? '' : maskKey(key),
    settings: storeApi.publicSettings(settings),
    discordUrl: String(settings.discordUrl || process.env.DISCORD_URL || '').trim(),
    personas: PERSONA_LIST,
    models: PUBLIC_MODE ? [] : DEFAULT_MODELS,
    billing: await billingFor(storeApi),
    version: APP_VERSION,
    publicMode: PUBLIC_MODE,
  };
}

async function buildContents(messages) {
  const contents = [];

  for (const msg of messages) {
    const text = String(msg.content || '').trim();
    const parts = [];
    if (text) parts.push({ text });

    for (const att of msg.attachments || []) {
      if (!att?.file) continue;
      // Imagens geradas pelo Lume AI não precisam voltar para o motor de texto.
      if (att.kind === 'logo' || att.kind === 'image') continue;
      try {
        const data = await fs.readFile(path.join(store.UPLOADS_DIR, path.basename(att.file)));
        parts.push({ inlineData: { mimeType: att.mimeType, data: data.toString('base64') } });
      } catch {
        // arquivo removido do disco: segue sem ele
      }
    }

    if (!parts.length) continue;
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  // O motor de IA exige que a conversa comece com o usuário.
  while (contents.length && contents[0].role !== 'user') contents.shift();
  return contents;
}

function sanitizeName(name, ext) {
  const base = String(name || '')
    .replace(/[^\w.\-() ]+/g, '')
    .trim()
    .slice(0, 80);
  return base || `anexo.${ext}`;
}

function parseAttachments(raw, limits) {
  const files = [];
  let total = 0;

  for (const item of raw) {
    const mimeType = String(item?.mimeType || '').toLowerCase();
    const ext = ATTACHMENT_TYPES.get(mimeType);
    if (!ext) {
      throw httpError(400, 'Formato de anexo não suportado. Use PNG, JPG, WEBP, HEIC ou PDF.', 'BAD_ATTACHMENT');
    }

    const data = String(item?.data || '');
    if (!data || !/^[A-Za-z0-9+/=\r\n]+$/.test(data)) {
      throw httpError(400, 'Anexo inválido ou vazio.', 'BAD_ATTACHMENT');
    }

    const maxBytes = limits.maxAttachmentMb * 1024 * 1024;
    if (data.length > maxBytes * 1.45) {
      throw httpError(400, `O plano atual permite anexos de até ${limits.maxAttachmentMb} MB.`, 'ATTACHMENT_TOO_LARGE');
    }

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) throw httpError(400, 'Anexo inválido ou vazio.', 'BAD_ATTACHMENT');
    if (buffer.length > maxBytes) {
      throw httpError(400, `O plano atual permite anexos de até ${limits.maxAttachmentMb} MB.`, 'ATTACHMENT_TOO_LARGE');
    }

    total += buffer.length;
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw httpError(400, 'A soma dos anexos desta mensagem é muito grande.', 'ATTACHMENT_TOO_LARGE');
    }

    files.push({ name: sanitizeName(item?.name, ext), mimeType, ext, buffer });
  }

  return files;
}

async function saveAttachments(files) {
  await fs.mkdir(store.UPLOADS_DIR, { recursive: true });
  const saved = [];

  try {
    for (const file of files) {
      const id = crypto.randomUUID();
      const filename = `${id}.${file.ext}`;
      await fs.writeFile(path.join(store.UPLOADS_DIR, filename), file.buffer);
      saved.push({
        id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.buffer.length,
        file: filename,
        url: `/api/uploads/${filename}`,
      });
    }
    return saved;
  } catch (err) {
    await Promise.all(saved.map((att) => fs.unlink(path.join(store.UPLOADS_DIR, att.file)).catch(() => {})));
    throw err;
  }
}

function thinkingBudgetFor(model, smartMode) {
  if (!model.includes('2.5')) return null;
  if (smartMode) return 8192;
  if (model.includes('pro')) return 128; // mínimo aceito pelo 2.5 Pro
  return 0;
}

// Se um modelo atinge o limite, ele fica em "descanso" por alguns minutos para
// não gastar chamadas repetidas com a mesma resposta 429.
const modelCooldowns = new Map();

function modelCooling(id) {
  const until = modelCooldowns.get(id);
  return Boolean(until && until > Date.now());
}

function markModelCooling(id, ms = 60_000) {
  if (!id) return;
  modelCooldowns.set(id, Date.now() + ms);
}

// Se o modelo principal estiver indisponível, tenta uma alternativa leve
// sem o usuário precisar escolher nada.
function nextFallbackModel(current, tried) {
  for (const id of FALLBACK_MODELS) {
    if (id !== current && !tried.has(id) && !modelCooling(id)) return id;
  }
  // Se todos estiverem em descanso, ainda tenta os não testados.
  for (const id of FALLBACK_MODELS) {
    if (id !== current && !tried.has(id)) return id;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Estado, planos e configurações
// ---------------------------------------------------------------------------

app.get('/api/health', ah(async (req, res) => {
  const state = await buildState(req.lumeStore);
  res.json({
    ok: true,
    configured: state.configured,
    model: state.settings.model,
    plan: state.billing.plan.id,
    version: APP_VERSION,
    uptime: Math.round(process.uptime()),
  });
}));

app.get('/api/state', ah(async (req, res) => {
  res.json(await buildState(req.lumeStore));
}));

app.get('/api/plans', ah(async (req, res) => {
  res.json(await billingFor(req.lumeStore));
}));

app.post('/api/plan/activate', ah(async (req, res) => {
  if (PUBLIC_MODE) return res.status(403).json({ error: 'A ativação de planos está disponível apenas na versão completa.' });
  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Digite o código de ativação.' });

  try {
    const billing = await plans.activateLicense(code);
    res.json({ ok: true, billing });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

app.put('/api/settings', ah(async (req, res) => {
  if (PUBLIC_MODE) return res.status(403).json({ error: 'As configurações não podem ser alteradas na demonstração pública.' });
  const body = req.body || {};
  const patch = {
    model: body.model,
    persona: body.persona,
    language: body.language,
    customInstructions: body.customInstructions,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    smartMode: typeof body.smartMode === 'boolean' ? body.smartMode : undefined,
    webSearch: typeof body.webSearch === 'boolean' ? body.webSearch : undefined,
    discordUrl: typeof body.discordUrl === 'string' ? body.discordUrl : undefined,
  };

  if (body.removeApiKey === true) patch.apiKey = '';
  else if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim();

  if (patch.model !== undefined) {
    if (!isModelId(patch.model)) return res.status(400).json({ error: 'Modelo inválido.' });
    patch.model = normalizeModel(patch.model);
  }

  await req.lumeStore.saveSettings(patch);
  res.json(await buildState(req.lumeStore));
}));

app.post('/api/settings/test', ah(async (req, res) => {
  if (PUBLIC_MODE) return res.status(403).json({ error: 'O teste de conexão está disponível apenas na versão completa.' });
  const settings = await req.lumeStore.getSettings();
  const provided = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const apiKey = provided || resolveKey(settings).key;
  const model = normalizeModel(req.body?.model || settings.model);

  if (!apiKey) return res.status(400).json({ error: 'Cole a chave de conexão do Lume AI para testar.' });

  const startedAt = Date.now();
  const reply = await generateText({
    apiKey,
    model,
    contents: [{ role: 'user', parts: [{ text: 'Responda apenas com a palavra: ok' }] }],
    systemInstruction: 'Você é um verificador de conexão. Responda somente "ok".',
    temperature: 0,
    maxOutputTokens: 128,
    thinkingBudget: 0,
  });

  res.json({
    ok: true,
    model,
    modelName: brandModelName(model),
    latencyMs: Date.now() - startedAt,
    reply: reply.trim().slice(0, 80),
  });
}));

app.post('/api/models', ah(async (req, res) => {
  if (PUBLIC_MODE) return res.status(403).json({ error: 'A lista de modelos está disponível apenas na versão completa.' });
  const settings = await req.lumeStore.getSettings();
  const provided = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const apiKey = provided || resolveKey(settings).key;

  if (!apiKey) return res.status(400).json({ error: 'Configure a chave de conexão do Lume AI primeiro.' });

  const models = await listAvailableModels(apiKey);
  res.json({ models: models.length ? models : DEFAULT_MODELS });
}));

// ---------------------------------------------------------------------------
// Conversas
// ---------------------------------------------------------------------------

app.get('/api/conversations', ah(async (req, res) => {
  res.json({ conversations: await req.lumeStore.listConversations() });
}));

app.post('/api/conversations', ah(async (req, res) => {
  const conv = await req.lumeStore.createConversation({ title: req.body?.title });
  res.status(201).json(conv);
}));

app.delete('/api/conversations', ah(async (req, res) => {
  await req.lumeStore.clearConversations();
  res.json({ ok: true });
}));

app.get('/api/conversations/:id', ah(async (req, res) => {
  const conv = await req.lumeStore.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json(conv);
}));

app.patch('/api/conversations/:id', ah(async (req, res) => {
  const conv = await req.lumeStore.renameConversation(req.params.id, req.body?.title);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json(conv);
}));

app.delete('/api/conversations/:id', ah(async (req, res) => {
  const removed = await req.lumeStore.deleteConversation(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Logos (geração de imagem)
// ---------------------------------------------------------------------------

function lastVisualMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'assistant') continue;
    const attachment = (message.attachments || []).find((att) => att.kind === 'logo' || att.kind === 'image');
    if (attachment) return { message, kind: attachment.kind };
  }
  return null;
}

async function handleVisualRequest({ res, conv, fresh, text, kind, storeApi = store }) {
  const isLogo = kind === 'logo';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let finished = false;
  let closed = false;
  const controller = new AbortController();

  const send = (event, payload) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  res.on('close', () => {
    if (!finished) {
      closed = true;
      controller.abort();
    }
  });

  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  const billing = await billingFor(storeApi);
  send('meta', { conversation: fresh, title: fresh.title, billing });
  send('thinking', { active: true });
  send('status', { message: isLogo ? 'Criando sua logo com IA…' : 'Gerando sua imagem com IA…' });

  const onStatus = (status) => {
    if (status?.message) send('status', status);
  };

  try {
    const image = isLogo
      ? await createLogo({ text, messages: fresh.messages, signal: controller.signal, onStatus })
      : await createImage({ text, messages: fresh.messages, signal: controller.signal, onStatus });
    if (closed) return;

    const [saved] = await saveAttachments([{
      name: `${isLogo ? 'logo' : 'imagem'}-${Date.now()}.${image.ext}`,
      mimeType: image.mimeType,
      ext: image.ext,
      buffer: image.buffer,
    }]);

    Object.assign(saved, {
      kind,
      brand: image.spec.brand || '',
      transparent: Boolean(image.spec.transparent),
      format: image.ext,
      aspectRatio: image.spec.aspect.ratio,
      prompt: image.spec.prompt || image.spec.raw || '',
      style: image.spec.style || '',
      styleKey: image.spec.styleKey || '',
      theme: image.spec.themeKey || '',
      themeKey: image.spec.themeKey || '',
      themeLabel: image.spec.themeLabel || '',
      colors: Array.isArray(image.spec.colors) ? image.spec.colors : [],
      round: Boolean(image.spec.round),
      tagline: image.spec.tagline || '',
      background: image.spec.background?.hex || '',
      backgroundName: image.spec.background?.name || '',
    });

    const result = await storeApi.appendMessage(conv.id, {
      role: 'assistant',
      content: isLogo
        ? buildLogoCaption({ spec: image.spec, image })
        : buildImageCaption({ spec: image.spec, image }),
      attachments: [saved],
    });

    finished = true;
    send('done', {
      conversation: result?.conversation || null,
      title: result?.conversation?.title || fresh.title,
      message: result?.message || null,
      billing: await billingFor(storeApi),
    });
    res.end();
  } catch (err) {
    finished = true;

    if (closed || err.name === 'AbortError') {
      if (!res.writableEnded) res.end();
      return;
    }

    console.error(`[${kind}]`, err);
    const message = err.code === 'IMAGE_RATE_LIMIT'
      ? err.message
      : isLogo
        ? 'Não consegui gerar a logo agora. Tente novamente em alguns segundos ou peça uma descrição diferente.'
        : (err.message || 'Não consegui gerar a imagem agora. Tente novamente em alguns segundos.');
    const result = await storeApi.appendMessage(conv.id, { role: 'assistant', content: message }).catch(() => null);

    if (result) {
      send('done', {
        conversation: result.conversation,
        title: result.conversation.title,
        message: result.message,
        billing: await billingFor(storeApi),
      });
    } else {
      send('error', { error: message, code: isLogo ? 'LOGO_ERROR' : 'IMAGE_ERROR' });
    }
    res.end();
  } finally {
    clearInterval(ping);
  }
}

// ---------------------------------------------------------------------------
// Chat (streaming via Server-Sent Events)
// ---------------------------------------------------------------------------

app.post('/api/chat', ah(async (req, res) => {
  const settings = await req.lumeStore.getSettings();
  const { key: apiKey } = resolveKey(settings);

  if (!apiKey) {
    return res.status(400).json({
      error: 'O Lume AI ainda não está conectado. Abra Configurações e cole sua chave gratuita do Google AI Studio.',
      code: 'NO_KEY',
    });
  }

  // 1. Limite de mensagens do plano + proteção global da demonstração
  const publicLimit = checkPublicDailyCap();
  if (publicLimit) return res.status(429).json(publicLimit);

  const access = await checkMessageAllowedFor(req.lumeStore);
  if (!access.ok) {
    return res.status(402).json({ error: access.message, code: 'LIMIT_REACHED', billing: access.billing });
  }

  const { conversationId, message, regenerate = false } = req.body || {};
  const conv = conversationId ? await req.lumeStore.getConversation(conversationId) : null;
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada. Crie uma nova.', code: 'NOT_FOUND' });

  let text = '';
  let attachments = [];
  let filesToSave = [];
  let regenerateWasVisual = '';

  if (!regenerate) {
    text = typeof message === 'string' ? message.trim() : '';
    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

    if (!text && !rawAttachments.length) {
      return res.status(400).json({ error: 'Escreva uma mensagem ou anexe um arquivo.' });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: 'Mensagem muito longa (máximo de 8.000 caracteres).' });
    }

    if (rawAttachments.length) {
      const attachAccess = await checkAttachmentsAllowedFor(req.lumeStore, rawAttachments.length);
      if (!attachAccess.ok) {
        return res.status(402).json({ error: attachAccess.message, code: 'LIMIT_REACHED', billing: attachAccess.billing });
      }
      try {
        filesToSave = parseAttachments(rawAttachments, attachAccess.billing.limits);
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message, code: err.code || 'BAD_ATTACHMENT', billing: attachAccess.billing });
      }
    }
  } else if (!conv.messages.length) {
    return res.status(400).json({ error: 'Não há mensagem para regenerar.' });
  }

  // 2. Consome a cota (mensagem + anexos) e grava o que for necessário
  if (filesToSave.length) {
    try {
      attachments = await saveAttachments(filesToSave);
    } catch (err) {
      console.error('[anexos]', err);
      return res.status(500).json({ error: 'Não consegui salvar o anexo. Tente novamente.' });
    }
  }

  await consumeMessageFor(req.lumeStore);
  if (PUBLIC_MODE) publicMessages += 1;
  if (attachments.length) await consumeAttachmentsFor(req.lumeStore, attachments.length);

  if (regenerate) {
    const trailing = conv.messages[conv.messages.length - 1];
    const trailingAttachment = trailing?.role === 'assistant'
      ? (trailing.attachments || []).find((att) => att.kind === 'logo' || att.kind === 'image')
      : null;
    regenerateWasVisual = trailingAttachment?.kind || '';
    await req.lumeStore.removeTrailingAssistant(conv.id);
  } else {
    await req.lumeStore.appendMessage(conv.id, { role: 'user', content: text, attachments });
  }

  const fresh = await req.lumeStore.getConversation(conv.id);
  const last = fresh.messages[fresh.messages.length - 1];
  if (!last || last.role !== 'user') {
    return res.status(400).json({ error: 'Não há uma pergunta do usuário para responder.' });
  }

  // 3. Pedidos visuais não passam pelo motor de texto: são gerados como imagem.
  const visualText = regenerate
    ? (fresh.messages.filter((item) => item.role === 'user').at(-1)?.content || '')
    : text;
  const lastVisual = lastVisualMessage(fresh.messages);
  const lastVisualKind = lastVisual?.kind || '';
  const shortEdit = visualText.length <= 90
    && !/^\s*(o que|como|qual|quando|onde|por que|porque|quem)\b/i.test(visualText);
  const shortLogoEdit = lastVisualKind === 'logo'
    && shortEdit
    && /\b(png|jpe?g|webp|svg|transparente|fundo|cor|cores|azul|verde|roxo|vermelho|rosa|preto|branco|dourado|estilo|redond[ao]|circular|horizontal|vertical|outra|varia[çc][ãa]o|vers[ãa]o)\b/i.test(visualText);
  const shortImageEdit = lastVisualKind === 'image'
    && shortEdit
    && /\b(png|jpe?g|webp|fundo|cor|cores|azul|verde|roxo|vermelho|rosa|preto|branco|dourado|estilo|realista|anime|cartoon|3d|aquarela|pintura|cyberpunk|minimalista|pixel|horizontal|vertical|16:9|9:16|4:3|3:4|2:1|zoom|enquadramento|ilumina[çc][ãa]o|luz|detalhe|detalhes|outra|varia[çc][ãa]o|vers[ãa]o)\b/i.test(visualText);

  const wantsLogo = Boolean(visualText) && (
    isLogoRequest(visualText)
    || regenerateWasVisual === 'logo'
    || (lastVisualKind === 'logo' && (isLogoEditRequest(visualText) || shortLogoEdit))
  );
  const wantsImage = !wantsLogo && Boolean(visualText) && (
    isImageRequest(visualText)
    || regenerateWasVisual === 'image'
    || (lastVisualKind === 'image' && (isImageEditRequest(visualText) || shortImageEdit))
  );

  if (wantsLogo || wantsImage) {
    await handleVisualRequest({
      res,
      conv,
      fresh,
      text: visualText,
      kind: wantsLogo ? 'logo' : 'image',
      storeApi: req.lumeStore,
    });
    return;
  }

  const history = req.lumeStore.selectHistory(fresh.messages);
  const contents = await buildContents(history);
  if (!contents.length) return res.status(400).json({ error: 'Não há conteúdo para enviar.' });

  const billing = await billingFor(req.lumeStore);
  const model = normalizeModel(settings.model);
  const startModel = modelCooling(model)
    ? (nextFallbackModel(model, new Set([model])) || model)
    : model;
  const webSearch = Boolean(settings.webSearch) && billing.limits.webSearch;
  const systemInstruction = buildSystemPrompt({ ...settings, webSearch });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let finished = false;
  let closed = false;
  const controller = new AbortController();

  const send = (event, payload) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  res.on('close', () => {
    if (!finished) {
      closed = true;
      controller.abort();
    }
  });

  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  send('meta', {
    conversation: fresh,
    title: fresh.title,
    model: startModel,
    modelName: brandModelName(startModel),
    billing,
  });

  let full = '';
  let sources = [];
  let usedModel = startModel;
  let usedFallbackText = false;
  const triedModels = new Set([usedModel]);

  try {
    while (true) {
      try {
        for await (const event of streamChat({
          apiKey,
          model: usedModel,
          contents,
          systemInstruction,
          temperature: settings.temperature,
          maxOutputTokens: billing.limits.maxOutputTokens,
          tools: webSearch ? [{ google_search: {} }] : null,
          thinkingBudget: thinkingBudgetFor(usedModel, settings.smartMode),
          signal: controller.signal,
        })) {
          if (event.type === 'text') {
            full += event.text;
            send('delta', { text: event.text });
          } else if (event.type === 'thinking') {
            send('thinking', { active: true });
          } else if (event.type === 'sources') {
            sources = event.sources;
            send('sources', { sources });
          }
        }

        if (!full.trim()) {
          throw new GeminiError('O Lume AI não retornou texto. Tente novamente.', {
            status: 503,
            code: 'EMPTY_RESPONSE',
          });
        }
        break;
      } catch (err) {
        const retryable = err instanceof GeminiError
          && (err.status === 404 || err.status === 429 || err.status === 503 || err.code === 'NOT_FOUND');

        if (err instanceof GeminiError) {
          if (err.status === 429) markModelCooling(usedModel, 60_000);
          else if (err.status === 503) markModelCooling(usedModel, 15_000);
          else if (err.status === 404) markModelCooling(usedModel, 5 * 60_000);
        }

        if (retryable && !full.trim()) {
          const fallback = nextFallbackModel(usedModel, triedModels);
          if (fallback) {
            triedModels.add(fallback);
            usedModel = fallback;
            if (err.status === 404) await req.lumeStore.saveSettings({ model: fallback }).catch(() => {});
            send('meta', {
              conversation: fresh,
              title: fresh.title,
              model: fallback,
              modelName: brandModelName(fallback),
              billing,
              notice: 'O Lume AI usou uma versão alternativa para continuar respondendo.',
            });
            continue;
          }

          // Último recurso: um motor de texto alternativo sem chave. Assim o
          // chat continua respondendo mesmo quando todos os modelos do Google
          // estão temporariamente limitados.
          try {
            const alternative = await generateFallbackText({
              systemInstruction,
              contents,
              signal: controller.signal,
            });
            if (alternative) {
              usedFallbackText = true;
              full = alternative;
              send('delta', { text: alternative });
              send('meta', {
                conversation: fresh,
                title: fresh.title,
                model: startModel,
                modelName: 'Lume AI',
                billing,
                notice: 'O motor principal atingiu o limite agora. O Lume AI continuou com um modo alternativo.',
              });
              break;
            }
          } catch (alternativeError) {
            if (alternativeError.name === 'AbortError') throw alternativeError;
            console.warn('[fallback]', alternativeError.message);
          }
        }
        throw err;
      }
    }

    if (!full.trim()) {
      throw new GeminiError('O Lume AI não retornou texto. Tente novamente.');
    }

    // Se o modelo principal estava limitado e uma alternativa funcionou,
    // lembra a escolha para as próximas mensagens.
    if (!usedFallbackText && usedModel !== model) {
      await req.lumeStore.saveSettings({ model: usedModel }).catch(() => {});
    }

    const saved = await req.lumeStore.appendMessage(conv.id, { role: 'assistant', content: full, sources });
    finished = true;

    if (saved) {
      const updatedBilling = await billingFor(req.lumeStore);
      send('done', {
        conversation: saved.conversation,
        title: saved.conversation.title,
        message: saved.message,
        billing: updatedBilling,
      });
    } else {
      send('done', { conversation: null });
    }
    res.end();
  } catch (err) {
    finished = true;

    if (closed || err.name === 'AbortError') {
      if (full.trim()) {
        await req.lumeStore.appendMessage(conv.id, { role: 'assistant', content: full, interrupted: true, sources }).catch(() => {});
      }
      if (!res.writableEnded) res.end();
      return;
    }

    const friendly = err instanceof GeminiError ? err.message : 'Erro inesperado ao falar com o Lume AI.';
    if (!(err instanceof GeminiError)) console.error('[chat]', err);

    if (full.trim()) {
      await req.lumeStore.appendMessage(conv.id, { role: 'assistant', content: full, interrupted: true, sources }).catch(() => {});
    }

    send('error', { error: friendly, code: err.code || 'ERROR' });
    res.end();
  } finally {
    clearInterval(ping);
  }
}));

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err);
  if (res.headersSent) return res.end();
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Erro interno no servidor.' : err.message });
});

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  🔥 LUME AI — assistente pessoal');
  console.log(`  ➜  http://localhost:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`  ➜  rede: http://${HOST}:${PORT}`);
  }
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERRO] A porta ${PORT} já está em uso. Feche o outro programa ou troque PORT no arquivo .env.\n`);
  } else {
    console.error('\n[ERRO] Não foi possível iniciar o servidor:', err.message, '\n');
  }
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nEncerrando o Lume AI...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  });
}
