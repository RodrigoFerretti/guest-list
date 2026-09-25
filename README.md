# guest-list

Lista de convidados para a porta de eventos, feita para o celular. Quem está na porta busca o nome, toca e confirma a chegada. Quem organiza acompanha o contador de outro celular, adiciona nomes de última hora e exporta a lista no fim.

Cada pessoa publica a sua própria cópia na sua conta Cloudflare (plano gratuito), com um endereço próprio do tipo `https://meu-evento.pages.dev`. Não existe um serviço central: os dados dos convidados ficam só na sua conta.

> **Versão 1.** A primeira versão (GitHub Pages + Google Sheets + uma senha) foi usada em uma festa de casamento em janeiro de 2026. Para vê-la: `git checkout d7cc1a9`. As lições dessa versão viraram a versão atual: endereço sem nome de usuário, dois papéis de acesso, código de acesso fora da URL e histórico de quem chegou quando.

## Como funciona

| | Porta | Organizador (admin) |
|---|---|---|
| Buscar, confirmar e desfazer chegada | ✔ | ✔ |
| Adicionar ou remover convidado | | ✔ |
| Importar nomes em lote, exportar CSV | | ✔ |
| Estatísticas e chegadas por hora | | ✔ |
| Gerar um novo link para a porta | | ✔ |

Não há cadastro. Existem dois usuários fixos, **`admin`** e **`porta`**, e as senhas de cada um ficam no seu `config.yaml`. Na tela de entrada a pessoa escolhe *Porta* ou *Organizador* e digita a senha; o celular lembra o acesso até a pessoa sair. Usuário e senha vão no cabeçalho `Authorization` de cada chamada, nunca na URL, e no Cloudflare só existe o hash das senhas. Se a senha da porta vazar, troque-a no `config.yaml` e rode `bun run deploy`: a antiga para de valer na hora.

## Publicando a sua cópia

Pré-requisitos: uma conta Cloudflare (gratuita), [Bun](https://bun.sh) e Git.

```bash
git clone https://github.com/RodrigoFerretti/guest-list.git
cd guest-list
bun install
cp config.example.yaml config.yaml     # edite: slug (vira a URL), title, admin_password, host_password
bunx wrangler login                     # abre o navegador uma única vez
bun run setup                           # cria o banco e o projeto na sua conta
bun run deploy                          # publica em https://<slug>.pages.dev
```

`bun run setup` lê o `config.yaml`, cria o banco D1 e o projeto Pages com o nome do slug, aplica o esquema `schema.sql` e escreve o `wrangler.jsonc` com o título e os hashes das senhas. `bun run deploy` envia a pasta `public/` e as funções de `functions/` e mostra o endereço com um QR code (também salvo em `qr-code.png`) para você compartilhar.

O `config.yaml`, o `wrangler.jsonc` e o `qr-code.png` são desta implantação e ficam fora do Git.

### Depois de publicar

- **Carregar a lista.** No aplicativo, entre pelo link de admin, menu `⋯` → *Importar nomes* (um por linha). Ou pelo terminal: `bun run import lista.txt` (aceita também um CSV com coluna `guest`, `nome` ou `name`).
- **Entregar o acesso da porta.** Passe o endereço (o QR code de `bun run links` serve) e a senha `host_password` para quem vai receber os convidados. A senha de admin fica só com você.
- **No dia.** A lista se atualiza sozinha a cada 15 segundos em todos os celulares. Cada chegada guarda a hora e qual usuário confirmou.
- **Depois.** Menu `⋯` → *Exportar CSV* baixa a lista com as horas. Troque `host_password` no `config.yaml` e rode `bun run deploy` para encerrar o acesso usado no evento.
- **Reaproveitar para outro evento.** Mude `title` e as senhas (e `slug`, se quiser outro endereço) no `config.yaml` e rode `bun run setup` e `bun run deploy` de novo. Um slug novo cria um banco novo e vazio.

### Domínio próprio (opcional)

No painel da Cloudflare, abra o projeto em *Workers & Pages* → *Custom domains* e adicione o seu domínio. O endereço `<slug>.pages.dev` continua funcionando.

## Desenvolvimento local

```bash
bun run dev          # http://localhost:8788 com um banco D1 local; imprime os links locais
bun run check        # verificação de tipos das functions e dos scripts
```

O ambiente local não toca na sua conta Cloudflare: `bun run dev` aplica o esquema em um banco local e usa as mesmas senhas do `config.yaml`.

## Estrutura

```
public/            página (index.html, app.js, style.css)
functions/api/     API como Cloudflare Pages Functions (uma rota por arquivo)
  _middleware.ts   confere usuário e senha em toda chamada
  guests/          listar, adicionar, remover, marcar presença
  import.ts, export.ts, stats.ts, config.ts, me.ts
schema.sql         tabelas guests e checkins (histórico)
scripts/           setup, deploy, links, import, dev
config.example.yaml
```

### API

Todas as rotas exigem `Authorization: Basic base64(usuário:senha)`, exceto `GET /api/config`.

| Método e rota | Papel | O que faz |
|---|---|---|
| `GET /api/config` | público | título e idioma |
| `GET /api/me` | qualquer | usuário e papel |
| `GET /api/guests` | qualquer | lista com presença atual |
| `POST /api/guests/:id/presence` | qualquer | `{ "present": true }` marca ou desmarca a chegada |
| `POST /api/guests` | admin | `{ "name": "..." }` adiciona (409 se já existe) |
| `DELETE /api/guests/:id` | admin | remove da lista (o histórico fica) |
| `POST /api/import` | admin | `{ "names": [...] }` até 500 por vez |
| `GET /api/export` | admin | CSV |
| `GET /api/stats` | admin | totais e histórico de chegadas |

## English summary

Guest check-in list for event doors, self-hosted on your own Cloudflare account (free tier) at `https://<slug>.pages.dev`. Two fixed users with passwords set in `config.yaml`: `porta` (door: search, confirm arrivals) and `admin` (add, import, export, stats). Copy `config.example.yaml` to `config.yaml`, set the passwords and `language: en`, then `bun install`, `bunx wrangler login`, `bun run setup`, `bun run deploy`. The v1 (GitHub Pages + Google Sheets) is at commit `d7cc1a9`.

## Licença

MIT.
