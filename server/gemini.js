// Integração direta com a API REST do Google Gemini (sem SDK externo).

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-omni-1.1-flash',
];

export function brandModelName(id, fallback = '') {
  const known = {
    'gemini-3.8-flash': 'Lume AI',
    'gemini-3.7-flash': 'Lume AI',
    'gemini-3.6-flash': 'Lume AI',
    'gemini-3.5-flash': 'Lume AI',
    'gemini-3.5-flash-lite': 'Lume AI Lite',
    'gemini-3.1-flash-lite': 'Lume AI Lite',
    'gemini-flash-latest': 'Lume AI',
    'gemini-flash-lite-latest': 'Lume AI Lite',
    'gemini-omni-1.1-flash': 'Lume AI',
  };
  if (known[id]) return known[id];
  const name = String(fallback || id || 'Lume AI');
  return name
    .replace(/Google\s*/gi, '')
    .replace(/Gemini/gi, 'Lume AI')
    .replace(/\s+/g, ' ')
    .trim() || 'Lume AI';
}

export const DEFAULT_MODELS = [
  { id: 'gemini-3.1-flash-lite', name: brandModelName('gemini-3.1-flash-lite'), hint: 'Modelo principal do Lume AI' },
  { id: 'gemini-3.5-flash', name: brandModelName('gemini-3.5-flash'), hint: 'Alternativa rápida do Lume AI' },
  { id: 'gemini-3.6-flash', name: brandModelName('gemini-3.6-flash'), hint: 'Alternativa avançada do Lume AI' },
];

export class GeminiError extends Error {
  constructor(message, { status = 500, code = 'GEMINI_ERROR' } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
  }
}

export function isModelId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{2,80}$/.test(value);
}

function friendlyError(status, payload) {
  const raw = payload?.error?.message || '';
  const code = payload?.error?.status || '';

  if (status === 400 && /api key not valid|invalid api key/i.test(raw)) {
    return 'Chave de conexão inválida. Confira a chave no Google AI Studio e cole de novo.';
  }
  if (status === 400 && /api key/i.test(raw)) {
    return 'A chave de conexão foi recusada. Gere uma nova chave no Google AI Studio.';
  }
  if (status === 401 || status === 403) {
    return 'A chave de conexão não tem permissão para usar o motor de IA. Verifique se a API de IA está ativa na sua conta Google.';
  }
  if (status === 404 || code === 'NOT_FOUND') {
    return 'Não encontrei um modelo disponível para sua chave. O Lume AI vai tentar uma alternativa automaticamente.';
  }
  if (status === 429) {
    return 'O limite gratuito do motor de IA foi atingido neste instante. O Lume AI já tentou versões alternativas; aguarde alguns segundos e tente novamente.';
  }
  if (status === 503 || status === 500) {
    return 'O motor de IA está instável neste momento. Tente novamente em alguns segundos.';
  }
  if (/safety|blocked/i.test(code)) {
    return 'O Lume AI bloqueou esta resposta por questões de segurança. Tente reformular o pedido.';
  }
  if (raw) return `Detalhe técnico: ${raw}`;
  return `Falha na comunicação com o motor do Lume AI (HTTP ${status}).`;
}

async function toGeminiError(res) {
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // resposta sem JSON
  }
  return new GeminiError(friendlyError(res.status, payload), {
    status: res.status,
    code: payload?.error?.status || 'GEMINI_ERROR',
  });
}

function buildBody({
  contents,
  systemInstruction,
  temperature = 0.8,
  maxOutputTokens = 8192,
  tools = null,
  thinkingBudget = null,
}) {
  const body = {
    contents,
    generationConfig: {
      temperature: Math.min(2, Math.max(0, Number(temperature) || 0)),
      maxOutputTokens,
    },
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
  if (Array.isArray(tools) && tools.length) body.tools = tools;
  if (typeof thinkingBudget === 'number' && Number.isFinite(thinkingBudget)) {
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }
  return body;
}

function extractText(json) {
  const candidates = json?.candidates;
  if (!Array.isArray(candidates) || !candidates.length) return '';
  return (candidates[0]?.content?.parts || [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
}

/**
 * Envia o histórico e devolve eventos conforme chegam (streaming).
 * Eventos: { type: 'text', text } | { type: 'thinking' } | { type: 'sources', sources }
 */
export async function* streamChat({
  apiKey,
  model,
  contents,
  systemInstruction,
  temperature = 0.8,
  maxOutputTokens = 8192,
  tools = null,
  thinkingBudget = null,
  signal,
}) {
  const url = `${API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildBody({ contents, systemInstruction, temperature, maxOutputTokens, tools, thinkingBudget }),
      ),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new GeminiError('Não consegui conectar ao motor do Lume AI. Verifique sua internet.', {
      code: 'NETWORK_ERROR',
    });
  }

  if (!res.ok) throw await toGeminiError(res);
  if (!res.body) throw new GeminiError('O motor do Lume AI respondeu vazio. Tente novamente.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finishReason = null;
  let thoughtSent = false;
  const sources = new Map();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '').trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue; // pedaço incompleto, ignora
        }

        if (json?.promptFeedback?.blockReason) {
          throw new GeminiError(
            'O Lume AI bloqueou esta conversa por questões de segurança. Tente reformular a pergunta.',
            { code: 'BLOCKED', status: 400 },
          );
        }

        const candidate = json?.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;

        const meta = candidate?.groundingMetadata;
        for (const chunk of meta?.groundingChunks || []) {
          const web = chunk?.web;
          if (web?.uri) {
            const key = String(web.uri);
            if (!sources.has(key)) {
              sources.set(key, { uri: key, title: String(web.title || key) });
            }
          }
        }

        for (const part of candidate?.content?.parts || []) {
          if (part?.thought === true) {
            if (!thoughtSent) {
              thoughtSent = true;
              yield { type: 'thinking' };
            }
            continue; // raciocínio interno não é exibido
          }
          if (typeof part?.text === 'string' && part.text) {
            yield { type: 'text', text: part.text };
          }
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
    throw new GeminiError('O Lume AI interrompeu a resposta por política de segurança.', {
      code: 'BLOCKED',
      status: 400,
    });
  }

  if (sources.size) {
    yield { type: 'sources', sources: [...sources.values()].slice(0, 8) };
  }
}

/**
 * Resposta única (sem streaming), usada no teste de conexão.
 */
export async function generateText({
  apiKey,
  model,
  contents,
  systemInstruction,
  temperature = 0.8,
  maxOutputTokens = 512,
  thinkingBudget = null,
}) {
  const url = `${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody({ contents, systemInstruction, temperature, maxOutputTokens, thinkingBudget })),
    });
  } catch {
    throw new GeminiError('Não consegui conectar ao motor do Lume AI. Verifique sua internet.', {
      code: 'NETWORK_ERROR',
    });
  }

  if (!res.ok) throw await toGeminiError(res);
  const json = await res.json();
  return extractText(json);
}

/**
 * Lista os modelos realmente disponíveis para a chave informada.
 */
export async function listAvailableModels(apiKey) {
  const url = `${API_BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new GeminiError('Não consegui conectar ao motor do Lume AI. Verifique sua internet.', {
      code: 'NETWORK_ERROR',
    });
  }

  if (!res.ok) throw await toGeminiError(res);
  const json = await res.json();

  const models = (json?.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => {
      const id = String(m.name || '').replace(/^models\//, '');
      return {
        id,
        name: brandModelName(id, m.displayName || id),
        hint: m.description || '',
      };
    })
    .filter((m) => m.id && !/embedding|aqa|image|tts|transcribe|robotics|lyria|nano-banana|computer-use|deep-research|antigravity|gemma/i.test(m.id));

  const priority = (id) => {
    if (id === DEFAULT_MODEL) return 0;
    if (id.includes('3.6-flash')) return 1;
    if (id.includes('3.5-flash')) return 2;
    if (id.includes('3.1-flash-lite')) return 3;
    if (id.includes('flash')) return 4;
    if (id.includes('pro')) return 5;
    return 6;
  };

  return models.sort((a, b) => priority(a.id) - priority(b.id) || a.id.localeCompare(b.id));
}
