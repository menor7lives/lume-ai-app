// Motor de texto alternativo (sem chave) usado apenas quando o motor principal
// e todos os modelos de reserva atingem o limite gratuito.
//
// O texto é enviado ao Pollinations, um serviço público de IA. Não envie dados
// sensíveis nesse modo; ele existe para o Lume AI continuar respondendo.

const TEXT_URL = 'https://text.pollinations.ai/';
const TIMEOUT_MS = 75_000;

export async function generateFallbackText({ systemInstruction, contents, signal } = {}) {
  const messages = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: String(systemInstruction) });
  }

  for (const item of contents || []) {
    const text = (item.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) {
      messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content: text });
    }
  }

  // Mantém a conversa curta para caber no limite do serviço.
  const system = messages.find((message) => message.role === 'system') || null;
  const conversation = messages.filter((message) => message.role !== 'system');
  const trimmed = [];
  let chars = 0;

  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const message = conversation[index];
    if (trimmed.length >= 12 || chars + message.content.length > 8000) break;
    trimmed.unshift(message);
    chars += message.content.length;
  }

  const finalMessages = [system, ...trimmed].filter(Boolean);
  if (!finalMessages.length) throw new Error('sem conteúdo para o modo alternativo');

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', forwardAbort, { once: true });

  try {
    const res = await fetch(TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LumeAI/1.4',
      },
      body: JSON.stringify({ messages: finalMessages }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = new Error(`modo alternativo respondeu HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfter = Number(res.headers.get('retry-after')) || 0;
      throw err;
    }

    const text = (await res.text()).trim();
    if (!text) throw new Error('modo alternativo respondeu vazio');
    return text;
  } catch (err) {
    if (err.name === 'AbortError' && timedOut) {
      throw new Error('tempo esgotado no modo alternativo');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }
}
