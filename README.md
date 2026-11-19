# TailyPaw+

MVP da disciplina Processos de Negócio (UCSal, 2026): reencontro de pets perdidos na cidade.
Projeto independente, separado da plataforma oficial do TailyPaw.

- `frontend/`: site (React + Vite + TypeScript + Tailwind), publicado na **Vercel**.
- `backend/`: API (Node.js + Express + TypeScript), publicada no **Render**, com banco **Neon** (Postgres).

As quatro telas: **T1 Resgate** (`/`), **T2 Publicar alerta** (`/publicar`), **T3 Caso do pet** (`/caso/:id` e a página da plaquinha `/p/:codigo`) e **T4 Conversa** (`/conversas`).
Login e "Meus pets e alertas" são janelas sobre as telas, e não telas novas.
Sem conta, `/` mostra só a apresentação; o mapa e a lista da cidade exigem login. `/caso/:id` e `/p/:codigo` abrem sem login, por causa do QR do cartaz e da plaquinha.
Em Conversas há a aba **Pessoas** (buscar pelo nome, seguir e conversar). A cidade é escolhida em lista do IBGE, e as fotos aceitam só JPG, PNG e WEBP.

## Rodar no computador

```bash
# API (porta 3333). Sem DATABASE_URL usa um banco embutido, sem instalar nada.
cd backend
npm install
npm run dev

# Site (porta 5174), em outro terminal
cd frontend
npm install
npm run dev
```

Teste automático das regras de negócio (RN01 a RN10): `cd backend && npm run test:smoke`.

## Publicar (passo a passo)

### 1. GitHub
1. Crie um repositório vazio no GitHub (por exemplo, `tailypawplus`), sem README.
2. Na pasta `TailyPawPlus`:
   ```bash
   git add .
   git commit -m "feat: MVP TailyPaw+"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/tailypawplus.git
   git push -u origin main
   ```

### 2. Banco no Neon
1. Crie uma conta em https://neon.tech e um projeto (região: São Paulo, se houver).
2. Copie a **connection string** (começa com `postgresql://` e termina com `?sslmode=require`).
   As tabelas são criadas sozinhas quando a API sobe.

### 3. API no Render
1. Em https://render.com, entre com o GitHub e clique em **New > Blueprint**; escolha o repositório.
   O Render lê o `render.yaml` e cria o serviço `tailypawplus-api`.
2. Preencha as variáveis pedidas:
   - `DATABASE_URL`: a connection string do Neon.
   - `CORS_ORIGIN`: o endereço do site na Vercel (passo 4). Pode deixar vazio agora e voltar depois.
3. Aguarde o deploy e abra `https://tailypawplus-api.onrender.com/api/health` (o nome pode variar). Deve aparecer `{"ok":true}`.

> O plano gratuito do Render "dorme" após 15 minutos sem uso; a primeira visita depois disso leva cerca de 1 minuto.
> Antes da apresentação, abra o endereço `/api/health` para acordar a API.

### 4. Site na Vercel
1. Em https://vercel.com, **Add New > Project**, escolha o repositório.
2. Em **Root Directory**, selecione `frontend`. O framework (Vite) é detectado sozinho.
3. Em **Environment Variables**, crie `VITE_API_URL` com o endereço da API do Render (sem barra no final).
4. Clique em **Deploy**. Depois, volte ao Render e coloque o endereço da Vercel em `CORS_ORIGIN`.

### Demonstração do arquivamento ao vivo (RN05/RN06)
No Render, mude `LIFECYCLE_UNIT` para `minutes` e `LIFECYCLE_CONFIRM`/`LIFECYCLE_ARCHIVE` para `2`.
Um alerta de perdido pede confirmação após 2 minutos e é arquivado 2 minutos depois. Volte para `days` e `5` depois da apresentação.

## Regras de negócio implementadas
| ID | Onde |
|---|---|
| RN01 campos obrigatórios | `backend/src/routes/alerts.ts` (POST) e validação na T2 |
| RN02 aviso à cidade | `alerts.ts`, após publicar |
| RN03 ponto aproximado | `backend/src/util.ts` (`approximate`) |
| RN04 um alerta ativo por pet | `backend/src/services.ts` (`findDuplicate`) |
| RN05/RN06 confirmar e arquivar | `services.ts` (`runLifecycle`) |
| RN07 só o autor encerra | `alerts.ts` (`ownAlert`) |
| RN08 recompensa | `alerts.ts` |
| RN09 autor não é "dono" | `alerts.ts` (`/claim`) |
| RN10 localização só com toque | `backend/src/routes/pets.ts` (`/tags/:code/found`) |

Fotos de exemplo usadas nas capturas: Pexels (licença livre).
