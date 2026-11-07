# Colocando o Lume AI online

O Lume AI funciona de duas formas:

| Modo | Uso | Segurança |
| --- | --- | --- |
| **Local** (`iniciar.bat`) | Seu computador, seus dados, sua chave | Ninguém de fora acessa |
| **Demonstração pública** (`PUBLIC_MODE=true`) | Link para clientes conhecerem | Conversas isoladas por visitante, configurações bloqueadas, sem expor sua chave |

> **Importante:** nunca exponha a instância local completa na internet. Ela tem
> acesso às suas conversas, configurações e à sua chave. Para publicar, use o
> modo demonstração em um servidor separado.

---

## 1. Publicar a demonstração no Render (mais fácil, grátis)

1. Crie uma conta em <https://render.com>.
2. Suba a pasta `lume` para um repositório no GitHub (sem a pasta `data` e sem `.env`).
3. No Render, clique em **New → Blueprint** e conecte o repositório.
4. O arquivo `render.yaml` já está pronto. Preencha quando pedir:
   - `LUME_API_KEY`: sua chave do Google AI Studio.
   - `PUBLIC_URL`: a URL que o Render vai gerar (ex.: `https://lume-ai-demo.onrender.com`).
   - `DISCORD_URL`: link do seu Discord (opcional).
5. Clique em **Apply**. O Render instala e inicia sozinho.
6. Abra a URL, teste o chat e uma imagem.

O plano gratuito do Render hiberna após um tempo sem acesso. O primeiro acesso
pode demorar ~30 segundos. Para uso contínuo, use o plano Starter.

### Variáveis usadas

| Variável | Valor | Para que serve |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Aceitar acesso externo |
| `PUBLIC_MODE` | `true` | Ativa o modo demonstração seguro |
| `LUME_DATA_DIR` | `/tmp/lume-data` | Dados temporários no servidor |
| `PUBLIC_URL` | `https://seu-site` | Sitemap, canonical e Open Graph |
| `LUME_API_KEY` | sua chave | Motor de IA (não aparece no site) |
| `DISCORD_URL` | link do Discord | Botão de suporte/vendas |

> No modo público a chave **nunca** é exibida, e as configurações não podem ser
> alteradas pelos visitantes.

---

## 2. Publicar com Docker (Railway, Fly.io, VPS, etc.)

O projeto inclui `Dockerfile` e `.dockerignore`.

```bash
docker build -t lume-ai .
docker run -d --name lume-ai \
  -p 3000:3000 \
  -e PUBLIC_MODE=true \
  -e PUBLIC_URL=https://seu-dominio.com \
  -e LUME_API_KEY=sua_chave \
  -e LUME_DATA_DIR=/data \
  -v lume-data:/data \
  lume-ai
```

- `-v lume-data:/data` mantém dados entre reinícios (opcional no modo demo).
- Em produção, coloque um proxy HTTPS (Caddy, Nginx, Cloudflare) na frente.
- O `.dockerignore` já exclui `.env`, `data/` e `node_modules/` da imagem.

### Railway

1. Crie um projeto e conecte o repositório.
2. O Railway detecta o `Dockerfile`.
3. Adicione as variáveis acima em **Variables**.
4. Gere o domínio em **Settings → Networking**.

### VPS (Ubuntu)

```bash
sudo apt update && sudo apt install -y nodejs npm caddy
git clone SEU_REPOSITORIO lume
cd lume
npm install --omit=dev
PUBLIC_MODE=true HOST=127.0.0.1 PORT=3000 LUME_API_KEY=... npm start
```

Use o Caddy para HTTPS automático:

```caddy
seu-dominio.com {
  reverse_proxy 127.0.0.1:3000
}
```

---

## 3. Link temporário para testar (Cloudflare Tunnel)

Serve para mostrar o Lume AI rapidamente, sem comprar domínio. **Use sempre o
modo público.**

```powershell
# terminal 1 — inicia a demonstração em outra porta
$env:PUBLIC_MODE="true"
$env:PORT="3001"
$env:LUME_DATA_DIR="$PWD\data-public"
node server/index.js

# terminal 2 — cria o link público
cloudflared tunnel --url http://127.0.0.1:3001
```

O Cloudflare mostra um link `https://algo.trycloudflare.com`. Ele é temporário e
não é ideal para o Google indexar. Para aparecer no Google, use um domínio fixo
(Render, Railway ou VPS).

---

## 4. Aparecer no Google

1. Publique em um domínio fixo (ex.: `https://lume-ai.com.br`).
2. Confirme que `https://seu-dominio/robots.txt` e
   `https://seu-dominio/sitemap.xml` abrem corretamente.
3. Crie uma conta no [Google Search Console](https://search.google.com/search-console).
4. Adicione a propriedade do domínio e confirme a posse.
5. Em **Sitemaps**, envie `https://seu-dominio/sitemap.xml`.
6. Em **Inspeção de URL**, cole a página inicial e clique em
   **Solicitar indexação**.
7. Divulgue o link em redes sociais, Discord e outros sites para acelerar.

O Google leva de alguns dias a algumas semanas para indexar. O site já inclui:

- `title`, `description`, `keywords` e `robots` otimizados;
- Open Graph e Twitter Card (`og-image.png`);
- JSON-LD do tipo `SoftwareApplication` com os planos;
- `canonical`, `robots.txt` e `sitemap.xml` dinâmicos;
- página `/sobre` com conteúdo indexável.

> Para o Google indexar, o site precisa estar em um domínio estável e acessível
> sem login. O link temporário do Cloudflare não é confiável para SEO.

---

## 5. O que ainda é necessário para vender planos

- **Discord**: preencha `DISCORD_URL` com o convite real.
- **Pagamento**: use Stripe, Mercado Pago ou Pix manual e gere a licença com
  `node tools/gerar-licenca.js`.
- **Login Google**: precisa de credenciais OAuth no Google Cloud Console e de
  uma decisão de arquitetura (local x nuvem).
- **Licenças seguras**: para distribuir aos clientes, assine os códigos com
  chave assimétrica (o segredo atual fica no servidor).
- **Banco de dados**: para milhares de usuários, troque o JSON local por
  PostgreSQL/Supabase.

---

## 6. Checklist antes de divulgar

- [ ] `PUBLIC_MODE=true` no servidor público.
- [ ] `LUME_API_KEY` configurada como variável secreta (nunca no HTML).
- [ ] `PUBLIC_URL` com o domínio final.
- [ ] `/robots.txt` e `/sitemap.xml` abrindo.
- [ ] Chat respondendo e imagens sendo geradas.
- [ ] Limite diário do plano Grátis funcionando.
- [ ] Nenhuma conversa ou chave aparecendo para outro visitante.
