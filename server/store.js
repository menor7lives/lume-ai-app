// Persistência local: conversas e configurações em arquivos JSON.
// Nada sai do seu computador (exceto o texto enviado ao motor de IA).

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MODEL } from './gemini.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.LUME_DATA_DIR
  ? path.resolve(process.env.LUME_DATA_DIR)
  : path.join(ROOT, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  temperature: 0.7,
  persona: 'assistente',
  language: 'pt-BR',
  customInstructions: '',
  smartMode: true,
  webSearch: false,
  discordUrl: 'https://discord.gg/DHe8aZmTjK',
  apiKey: '',
};

const DEFAULT_TITLE = 'Nova conversa';

let conversationsCache = null;
let settingsCache = null;
let writeQueue = Promise.resolve();

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[store] não foi possível ler ${path.basename(file)}:`, err.message);
    return fallback;
  }
}

function persist(file, getData) {
  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(getData(), null, 2), 'utf8');
      await fs.rename(tmp, file);
    })
    .catch((err) => console.error('[store] falha ao salvar:', err.message));
  return writeQueue;
}

async function loadConversations() {
  if (!conversationsCache) {
    const raw = await readJson(CONVERSATIONS_FILE, { conversations: [] });
    conversationsCache = Array.isArray(raw?.conversations) ? raw : { conversations: [] };
  }
  return conversationsCache;
}

function makeTitle(text) {
  const clean = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>`~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return DEFAULT_TITLE;
  return clean.length > 52 ? `${clean.slice(0, 52).trimEnd()}…` : clean;
}

function summary(conv) {
  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messageCount: conv.messages.length,
  };
}

export async function listConversations() {
  const { conversations } = await loadConversations();
  return [...conversations]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map(summary);
}

export async function getConversation(id) {
  if (!id) return null;
  const { conversations } = await loadConversations();
  return conversations.find((c) => c.id === id) || null;
}

export async function createConversation({ title } = {}) {
  const { conversations } = await loadConversations();
  const now = new Date().toISOString();
  const conv = {
    id: crypto.randomUUID(),
    title: String(title || '').trim().slice(0, 80) || DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  conversations.unshift(conv);
  await persist(CONVERSATIONS_FILE, () => conversationsCache);
  return conv;
}

export async function renameConversation(id, title) {
  const conv = await getConversation(id);
  if (!conv) return null;
  const clean = String(title || '').trim().slice(0, 80);
  if (clean) conv.title = clean;
  conv.updatedAt = new Date().toISOString();
  await persist(CONVERSATIONS_FILE, () => conversationsCache);
  return conv;
}

async function removeUploadFiles(conversations) {
  const files = new Set();
  for (const conv of conversations) {
    for (const msg of conv.messages || []) {
      for (const att of msg.attachments || []) {
        if (att?.file) files.add(path.basename(att.file));
      }
    }
  }
  await Promise.all(
    [...files].map((file) => fs.unlink(path.join(UPLOADS_DIR, file)).catch(() => {})),
  );
}

export async function deleteConversation(id) {
  const { conversations } = await loadConversations();
  const index = conversations.findIndex((c) => c.id === id);
  if (index === -1) return false;
  const [removed] = conversations.splice(index, 1);
  await removeUploadFiles([removed]);
  await persist(CONVERSATIONS_FILE, () => conversationsCache);
  return true;
}

export async function clearConversations() {
  const { conversations } = await loadConversations();
  await removeUploadFiles(conversations);
  conversations.length = 0;
  await persist(CONVERSATIONS_FILE, () => conversationsCache);
}

export async function appendMessage(id, { role, content, interrupted = false, attachments = [], sources = [] }) {
  const conv = await getConversation(id);
  if (!conv) return null;

  const message = {
    id: crypto.randomUUID(),
    role: role === 'assistant' ? 'assistant' : 'user',
    content: String(content || ''),
    at: new Date().toISOString(),
  };
  if (interrupted) message.interrupted = true;
  if (Array.isArray(attachments) && attachments.length) message.attachments = attachments;
  if (Array.isArray(sources) && sources.length) message.sources = sources;

  if (message.role === 'user' && (!conv.title || conv.title === DEFAULT_TITLE)) {
    conv.title = makeTitle(message.content || attachments?.[0]?.name || '');
  }

  conv.messages.push(message);
  conv.updatedAt = message.at;
  await persist(CONVERSATIONS_FILE, () => conversationsCache);
  return { conversation: conv, message };
}

export async function removeTrailingAssistant(id) {
  const conv = await getConversation(id);
  if (!conv) return null;
  while (conv.messages.length && conv.messages[conv.messages.length - 1].role === 'assistant') {
    conv.messages.pop();
  }
  conv.updatedAt = new Date().toISOString();
  await persist(CONVERSATIONS_FILE, () => conversationsCache);
  return conv;
}

// Mantém o contexto dentro de um tamanho saudável (mensagens recentes).
// O motor de IA tem contexto enorme; usamos até ~150 mil caracteres (~40 mil tokens).
export function selectHistory(messages, { maxMessages = 80, maxChars = 150000 } = {}) {
  const picked = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const content = String(msg.content || '');
    if (!content.trim()) continue;
    if (picked.length >= maxMessages || chars + content.length > maxChars) break;
    picked.push(msg);
    chars += content.length;
  }
  return picked.reverse();
}

export async function getSettings() {
  if (!settingsCache) {
    const raw = await readJson(SETTINGS_FILE, {});
    settingsCache = { ...DEFAULT_SETTINGS };
    for (const [key, value] of Object.entries(raw || {})) {
      if (key in DEFAULT_SETTINGS) settingsCache[key] = value;
    }

    // Modelos antigos foram desativados pelo provedor. Migra automaticamente
    // para o modelo atual sem o usuário precisar escolher nada.
    if (!settingsCache.model || /^gemini-(?:1|2)\./.test(String(settingsCache.model))) {
      settingsCache.model = DEFAULT_MODEL;
      await persist(SETTINGS_FILE, () => settingsCache);
    }

    // O Discord do Lume AI já vem configurado de fábrica. Se o arquivo antigo
    // tiver o campo vazio, usa o convite oficial.
    if (!settingsCache.discordUrl) {
      settingsCache.discordUrl = DEFAULT_SETTINGS.discordUrl;
      await persist(SETTINGS_FILE, () => settingsCache);
    }
  }
  return { ...settingsCache };
}

function cleanDiscordUrl(value) {
  const raw = String(value || '').trim().slice(0, 500);
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch {
    return '';
  }
}

export async function saveSettings(patch = {}) {
  const current = await getSettings();
  const next = { ...current };

  if (typeof patch.model === 'string' && patch.model.trim()) next.model = patch.model.trim().slice(0, 80);
  if (typeof patch.persona === 'string' && patch.persona.trim()) next.persona = patch.persona.trim().slice(0, 40);
  if (typeof patch.language === 'string' && patch.language.trim()) next.language = patch.language.trim().slice(0, 10);
  if (typeof patch.customInstructions === 'string') next.customInstructions = patch.customInstructions.slice(0, 4000);
  if (typeof patch.temperature === 'number' && Number.isFinite(patch.temperature)) {
    next.temperature = Math.min(2, Math.max(0, patch.temperature));
  }
  if (typeof patch.smartMode === 'boolean') next.smartMode = patch.smartMode;
  if (typeof patch.webSearch === 'boolean') next.webSearch = patch.webSearch;
  if (typeof patch.discordUrl === 'string') next.discordUrl = cleanDiscordUrl(patch.discordUrl);
  if (typeof patch.apiKey === 'string') next.apiKey = patch.apiKey.trim();

  settingsCache = next;
  await persist(SETTINGS_FILE, () => settingsCache);
  return { ...next };
}

export function publicSettings(settings) {
  return {
    model: settings.model,
    temperature: settings.temperature,
    persona: settings.persona,
    language: settings.language,
    customInstructions: settings.customInstructions,
    smartMode: settings.smartMode,
    webSearch: settings.webSearch,
    discordUrl: settings.discordUrl,
  };
}
