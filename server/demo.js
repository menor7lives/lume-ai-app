// Armazenamento isolado para a demonstração pública.
//
// Cada visitante recebe um cookie de sessão e um armazenamento em memória
// próprio. Nada é gravado no disco e ninguém vê as conversas de outra pessoa.

import crypto from 'node:crypto';
import { DEFAULT_MODEL } from './gemini.js';
import { PLANS } from './plans.js';
import { DEFAULT_SETTINGS, publicSettings, selectHistory } from './store.js';

const DEFAULT_TITLE = 'Nova conversa';
const MAX_SESSIONS = 500;
const MAX_CONVERSATIONS = 12;
const MAX_MESSAGES = 80;

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function tomorrowKey() {
  return todayKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function serializePlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    emoji: plan.emoji,
    tagline: plan.tagline,
    price: plan.price,
    priceLabel: plan.priceLabel,
    period: plan.period,
    highlight: plan.highlight,
    limits: plan.limits,
    features: plan.features,
  };
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

function createStore() {
  const conversations = [];
  const usage = { messages: 0, attachments: 0 };
  const settings = {
    ...DEFAULT_SETTINGS,
    model: DEFAULT_MODEL,
    smartMode: false,
    webSearch: false,
  };

  return {
    async listConversations() {
      return [...conversations]
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .map(summary);
    },

    async getConversation(id) {
      if (!id) return null;
      return conversations.find((conv) => conv.id === id) || null;
    },

    async createConversation({ title } = {}) {
      const now = new Date().toISOString();
      const conv = {
        id: crypto.randomUUID(),
        title: String(title || '').trim().slice(0, 80) || DEFAULT_TITLE,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      conversations.unshift(conv);
      if (conversations.length > MAX_CONVERSATIONS) conversations.length = MAX_CONVERSATIONS;
      return conv;
    },

    async renameConversation(id, title) {
      const conv = await this.getConversation(id);
      if (!conv) return null;
      const clean = String(title || '').trim().slice(0, 80);
      if (clean) conv.title = clean;
      conv.updatedAt = new Date().toISOString();
      return conv;
    },

    async deleteConversation(id) {
      const index = conversations.findIndex((conv) => conv.id === id);
      if (index === -1) return false;
      conversations.splice(index, 1);
      return true;
    },

    async clearConversations() {
      conversations.length = 0;
      return true;
    },

    async appendMessage(id, { role, content, interrupted = false, attachments = [], sources = [] }) {
      const conv = await this.getConversation(id);
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
      if (conv.messages.length > MAX_MESSAGES) conv.messages.splice(0, conv.messages.length - MAX_MESSAGES);
      conv.updatedAt = message.at;
      return { conversation: conv, message };
    },

    async removeTrailingAssistant(id) {
      const conv = await this.getConversation(id);
      if (!conv) return null;
      while (conv.messages.length && conv.messages[conv.messages.length - 1].role === 'assistant') {
        conv.messages.pop();
      }
      conv.updatedAt = new Date().toISOString();
      return conv;
    },

    async getSettings() {
      return { ...settings };
    },

    async saveSettings(patch = {}) {
      if (typeof patch.persona === 'string' && patch.persona.trim()) settings.persona = patch.persona.trim().slice(0, 40);
      if (typeof patch.language === 'string' && patch.language.trim()) settings.language = patch.language.trim().slice(0, 10);
      if (typeof patch.customInstructions === 'string') settings.customInstructions = patch.customInstructions.slice(0, 4000);
      if (typeof patch.temperature === 'number' && Number.isFinite(patch.temperature)) {
        settings.temperature = Math.min(2, Math.max(0, patch.temperature));
      }
      return { ...settings };
    },

    // Cada visitante tem a própria cota gratuita. Sem isso, o limite diário
    // seria compartilhado entre todas as pessoas e a demonstração acabaria
    // depois das primeiras mensagens.
    getBillingStatus() {
      const plan = PLANS.free;
      return {
        plan: serializePlan(plan),
        plans: ['free', 'plus', 'pro'].map((id) => serializePlan(PLANS[id])),
        usage: { ...usage },
        limits: plan.limits,
        remaining: {
          messages: Math.max(0, plan.limits.messagesPerDay - usage.messages),
          attachments: Math.max(0, plan.limits.attachmentsPerDay - usage.attachments),
        },
        expiresAt: null,
        source: 'public-demo',
        checkout: { plus: '', pro: '' },
        resetAt: tomorrowKey(),
        serverDate: todayKey(),
      };
    },

    checkMessageAllowed() {
      const billing = this.getBillingStatus();
      const limit = billing.limits.messagesPerDay;
      if (limit != null && billing.usage.messages >= limit) {
        return {
          ok: false,
          billing,
          message: `Você usou as ${limit} mensagens gratuitas de hoje na demonstração. Volte amanhã ou entre no Discord para conhecer os planos.`,
        };
      }
      return { ok: true, billing };
    },

    consumeMessage() {
      usage.messages += 1;
    },

    checkAttachmentsAllowed(count) {
      const billing = this.getBillingStatus();
      const { limits } = billing;
      if (count > limits.maxAttachmentsPerMessage) {
        return {
          ok: false,
          billing,
          message: `A demonstração permite até ${limits.maxAttachmentsPerMessage} anexos por mensagem.`,
        };
      }
      if (limits.attachmentsPerDay != null && billing.usage.attachments + count > limits.attachmentsPerDay) {
        return {
          ok: false,
          billing,
          message: `A demonstração permite ${limits.attachmentsPerDay} anexos por dia.`,
        };
      }
      return { ok: true, billing };
    },

    consumeAttachments(count) {
      if (count) usage.attachments += count;
    },

    publicSettings,
    selectHistory,
  };
}

const sessions = new Map();

export function getDemoStore(req, res) {
  const cookie = String(req.headers.cookie || '');
  const match = cookie.match(/(?:^|;\s*)lume_demo=([a-f0-9-]{36})/);
  let sessionId = match?.[1];

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.setHeader('Set-Cookie', `lume_demo=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  }

  if (!sessions.has(sessionId)) {
    if (sessions.size >= MAX_SESSIONS) {
      sessions.delete(sessions.keys().next().value);
    }
    sessions.set(sessionId, createStore());
  }

  return sessions.get(sessionId);
}
