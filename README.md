# 🔥 Lume AI — seu assistente de IA pessoal

O **Lume AI** é um assistente de IA que roda no seu computador, com interface web bonita, histórico local, anexos, pesquisa na web e planos de uso. Ele usa um **motor de IA do Google** e foi feito para ser simples: clique em `iniciar.bat`, abra o navegador e converse.

> **Sobre “ser melhor que o ChatGPT”:** o Lume AI usa modelos de IA do Google, do mesmo nível dos melhores modelos disponíveis. Em muitas tarefas ele entrega respostas tão boas quanto (ou melhores, dependendo do modelo e do contexto). Não existe garantia honesta de superioridade em tudo — mas você ganha privacidade, personalização, controle de custos e a possibilidade de usar o modo inteligente com raciocínio profundo.

---

## ✨ O que ele faz

- **Chat com streaming** — a resposta aparece letra por letra, com opção de parar.
- **Modo inteligente** — ativa o raciocínio profundo do motor de IA para respostas mais cuidadosas.
- **Pesquisa na web** — busca fatos atuais no Google e mostra as fontes (planos Plus e Pro).
- **Anexos** — imagens (PNG, JPG, WEBP, HEIC) e PDFs, com prévia e limites por plano.
- **Geração de imagens** — fotos, ilustrações, anime, 3D, wallpapers, avatares e muito mais. O Lume AI monta o prompt, escolhe o estilo e entrega o arquivo no formato pedido.
- **Logos profissionais** — PNG transparente, JPG, WEBP ou SVG, com cores, estilo e proporção do jeito que você pedir.
- **Ajustes por conversa** — peça “mais realista”, “fundo preto”, “em 16:9”, “outra variação” e o Lume AI continua a partir da imagem anterior.
- **Histórico local** — conversas salvas em `data/conversations.json`, com busca, renomear, apagar e exportar em Markdown.
- **Personas** — assistente geral, programador, professor, game designer e modo direto.
- **Instruções personalizadas** — ensine o Lume AI sobre você, seu trabalho e seu jeito de escrever.
- **Modelo automático** — o Lume AI escolhe o melhor modelo para cada conversa, sem você precisar configurar nada.
- **Modo alternativo** — se o motor principal atingir o limite, o Lume AI tenta outros modelos e um motor de texto reserva para continuar respondendo.
- **Tema claro/escuro**, atalhos de teclado, layout responsivo para celular.
- **Planos com limites reais** — Grátis, Plus e Pro, aplicados no servidor.
- **Privacidade** — a chave de conexão fica só no servidor; o histórico fica no seu PC.

---

## 🚀 Começando (Windows)

### 1. Instale o Node.js

Baixe a versão **LTS** em [nodejs.org](https://nodejs.org) e instale com as opções padrão.

### 2. Pegue sua chave gratuita no Google AI Studio

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Faça login com sua conta Google.
3. Clique em **Create API key** e copie a chave (começa com `AIza...`).

### 3. Abra o Lume AI

Dê **dois cliques em `iniciar.bat`**. Na primeira vez ele instala as dependências e abre o navegador em `http://localhost:3000`.

Na tela inicial, clique em **Configurações**, cole a chave, clique em **Testar conexão** e depois em **Salvar**. Pronto: já pode conversar.

### Alternativa manual

```bat
npm install
npm start
```

Depois abra `http://localhost:3000`.

Também dá para colocar a chave no arquivo `.env`:

```env
LUME_API_KEY=AIza...
```

O Lume AI aceita a chave pelo `.env` **ou** pela tela de Configurações. A interface nunca mostra a chave completa.

---

## 🌐 Colocar online

O projeto já vem pronto para hospedagem:

- **`Dockerfile`** e **`.dockerignore`** para Render, Railway, Fly.io ou VPS.
- **`render.yaml`** com a configuração de demonstração pública.
- **SEO completo**: `title`, `description`, Open Graph, Twitter Card, JSON-LD,
  `robots.txt` e `sitemap.xml` dinâmicos, além da página `/sobre`.
- **Modo público seguro** (`PUBLIC_MODE=true`): cada visitante tem conversas
  isoladas em memória, as configurações ficam bloqueadas e a chave nunca aparece.

> ⚠️ **Nunca exponha a instância local completa na internet.** Ela tem acesso às
> suas conversas, configurações e à sua chave. Para publicar, use uma segunda
> instância com `PUBLIC_MODE=true`.

O passo a passo completo está em **[DEPLOY.md](DEPLOY.md)**.

---

## 💎 Planos e limites

| | 🌱 **Grátis** | ⚡ **Plus** | 🔥 **Pro** |
|---|---|---|---|
| Preço | R$ 0 | R$ 19,90/mês | R$ 49,90/mês |
| Mensagens por dia | 30 | 500 | ilimitadas |
| Anexos por dia | 3 | 100 | ilimitados |
| Anexos por mensagem | 2 | 4 | 6 |
| Tamanho por anexo | 5 MB | 10 MB | 20 MB |
| Pesquisa na web | — | ✓ | ✓ |
| Modo inteligente | ✓ | ✓ | ✓ |
| Resposta máxima | 4.096 tokens | 8.192 tokens | 16.384 tokens |

Os limites são **por dia** e zeram à meia-noite (horário do computador). Ao ativar um plano, o contador do dia é zerado de bônus.

### Como ativar um plano

1. Combine o pagamento com o suporte (PIX, cartão ou link de checkout).
2. Você recebe um código parecido com `LUME-PLUS-MX...`.
3. No Lume AI, clique no selo do plano (canto superior ou rodapé da barra lateral) → **Já tem um código?** → cole e clique em **Ativar**.

### Como vender os planos

O Lume AI foi feito para você usar sozinho, mas já vem com a estrutura de licenças:

1. Defina os links de pagamento no `.env`:

   ```env
   CHECKOUT_PLUS_URL=https://seu-link-de-pagamento-plus
   CHECKOUT_PRO_URL=https://seu-link-de-pagamento-pro
   ```

   Podem ser links do Mercado Pago, Stripe, Kiwify, Hotmart ou até um WhatsApp.

2. Depois de receber o pagamento, gere um código:

   ```bat
   node tools/gerar-licenca.js plus 30
   node tools/gerar-licenca.js pro 90
   ```

   O segundo número são os dias de validade.

3. Envie o código para o cliente ativar no Lume AI.

**Segredo das licenças:** se você não definir `LICENSE_SECRET` no `.env`, o Lume AI cria automaticamente um segredo em `data/.license-secret`. Guarde esse arquivo: é ele que valida os códigos. Se trocar de computador, copie junto. Nunca publique esse arquivo nem o `.env`.

> ⚠️ **Transparência:** como o Lume AI roda no computador do usuário, os limites são aplicados localmente e alguém com conhecimento técnico poderia burlá-los editando os arquivos. Para vender como SaaS de verdade, seria necessário um servidor central com login e cobrança. Para uso pessoal, familiar ou clientes de confiança, o modelo atual funciona bem.

### Desbloquear um plano só para você

No `.env`:

```env
LUME_PLAN=pro
```

Reinicie o Lume AI. Isso ignora os limites (útil para desenvolvimento e para o dono da instalação). Para voltar ao normal, deixe vazio e reinicie.

---

## 🧠 Dicas para respostas melhores

- **Tarefas difíceis:** mantenha o **Modo inteligente** ligado para respostas mais profundas.
- **Dia a dia:** o Lume AI escolhe automaticamente um modelo rápido e equilibrado.
- **Fatos atuais:** ligue **Web** (Plus/Pro) para o Lume AI pesquisar no Google e citar fontes.
- **Imagens e PDFs:** anexe prints, contratos, tabelas e fotos; o motor de IA lê o conteúdo.
- **Contexto longo:** o Lume AI envia até 80 mensagens / 150 mil caracteres de histórico.
- **Instruções personalizadas:** escreva quem você é, o que faz e como quer as respostas.
- **Personas:** use “Programador” para código, “Professor” para aprender e “Modo direto” para respostas curtas.
- **Regerar:** se a resposta não ficou boa, clique em **Regerar** na última resposta.

### Atalhos

| Atalho | Ação |
|---|---|
| `Enter` | Enviar mensagem |
| `Shift + Enter` | Nova linha |
| `Ctrl + K` | Nova conversa |
| `Esc` | Fechar barra lateral / diálogos |

---

## 📁 Estrutura do projeto

```
lume/
├─ iniciar.bat            # launcher do Windows
├─ package.json
├─ .env.example           # modelo de configuração
├─ server/
│  ├─ index.js            # API, SSE, uploads e rotas
│  ├─ gemini.js           # integração com o motor de IA
│  ├─ prompts.js          # personas e prompts (modo inteligente/web)
│  ├─ store.js            # conversas e configurações em JSON
│  └─ plans.js            # planos, limites, uso e licenças
├─ public/
│  ├─ index.html          # interface
│  ├─ styles.css          # tema e layout
│  ├─ app.js              # lógica do chat, anexos e planos
│  └─ favicon.svg
├─ tools/
│  └─ gerar-licenca.js    # gera códigos de ativação
└─ data/                  # criado em tempo de execução
   ├─ conversations.json
   ├─ settings.json
   ├─ usage.json
   ├─ uploads/
   └─ .license-secret     # segredo local (se não usar .env)
```

---

## 🔒 Privacidade e dados

- Conversas, configurações, uso e anexos ficam **no seu computador**, em `data/`.
- A chave de conexão fica no servidor (`data/settings.json` ou `.env`) e nunca é enviada ao navegador.
- O servidor escuta em `127.0.0.1` por padrão: só este computador acessa.
- Para acessar de outro aparelho da rede, use `HOST=0.0.0.0` no `.env` **com consciência do risco** (qualquer pessoa na rede poderá usar sua chave).
- Os textos, imagens e PDFs enviados são processados pelo motor de IA do Google, sujeitos à política de privacidade do Google.
- Para apagar tudo: feche o Lume AI e remova a pasta `data/` (ou use **Apagar histórico** nas Configurações).

**Backup:** copie a pasta `data/` (e o `.env`, se quiser manter a chave). Guarde o `.license-secret` se vender licenças.

---

## 🛠️ Personalização

- **Preços, limites e recursos dos planos:** `server/plans.js`.
- **Personas e prompts:** `server/prompts.js`.
- **Modelos disponíveis:** `server/gemini.js` (lista `DEFAULT_MODELS`).
- **Cores e layout:** `public/styles.css`.
- **Comportamento da interface:** `public/app.js`.
- **Porta e host:** `.env` (`PORT`, `HOST`).

Depois de alterar arquivos do servidor, reinicie o Lume AI. Arquivos do cliente bastam recarregar a página.

---

## 🧩 Problemas comuns

**“Node.js não encontrado”**
Instale o Node LTS em [nodejs.org](https://nodejs.org) e rode `iniciar.bat` de novo. O launcher também procura em `C:\Program Files\nodejs`.

**A porta 3000 já está em uso**
Feche o outro programa ou coloque `PORT=3001` no `.env` e reinicie.

**“Chave da API inválida”**
Confira se copiou a chave inteira em [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Se a chave for antiga, gere outra. Verifique também se a API **Generative Language** está ativa no Google Cloud do projeto.

**“Limite do motor de IA atingido”**
O plano gratuito do Google tem limites por minuto e por dia. Espere um pouco ou use outra chave. Os limites do motor de IA são diferentes dos limites dos planos do Lume AI.

**A resposta demora muito**
O modo inteligente raciocina mais. Para conversas rápidas, desligue o modo inteligente.

**Anexo recusado**
Veja o limite do seu plano (tamanho, quantidade por mensagem e por dia). Formatos aceitos: PNG, JPG, WEBP, HEIC e PDF.

**O Windows avisa que o `.bat` é suspeito**
É normal com arquivos baixados. O `iniciar.bat` só roda o Node localmente. Se preferir, execute `npm start` manualmente.

**O Lume AI não abre**
Confira se a janela preta ficou aberta com a mensagem `http://localhost:3000`. Se fechou, veja o erro na janela e rode de novo.

---

## 📌 Limites do plano gratuito do Google

O Lume AI não cobra pelo uso do motor de IA: você usa a cota da sua conta Google. As cotas gratuitas mudam com o tempo e variam por modelo. Se aparecer erro `429`, você atingiu o limite do Google — não é um bug do Lume AI. Consulte a página oficial de preços/limites do Google para os números atuais.

---

## 🧭 Roadmap sugerido

- Login e cobrança centralizada (para vender como SaaS).
- Geração automática de títulos com IA.
- Busca semântica no histórico.
- Voz (entrada e saída).
- Mais formatos de anexo (Word, Excel, áudio).
- Integração com WhatsApp/Telegram.

---

Feito com carinho para ser o seu assistente de todo dia. 🔥
