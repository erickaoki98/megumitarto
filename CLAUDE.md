# Painel de Vendas — Megumi Tarot

CRM/painel de gestão de vendas para um negócio de leitura de tarô. Vendedores
cadastram clientes e perguntas, sobem fotos das cartas, e a IA gera o texto da
leitura (persona "Megumi") e o áudio que é enviado ao cliente.

> **IMPORTANTE — o código-fonte está dentro de um `.zip` na raiz do repositório**
> (`horizons-export-*.zip`), ainda **não extraído** para o repo. Para fazer
> alterações de fato (e deployar), os arquivos precisam ser extraídos para a
> raiz. Confirmar com o usuário antes de extrair, pois é uma mudança estrutural.
> O projeto é um export do **Hostinger Horizons** e o usuário faz deploy na **Vercel**.

## Stack

- **React 18 + Vite 5** (JSX, sem TypeScript), alias `@` → `src/`
- **React Router 6** (`BrowserRouter`)
- **Tailwind CSS 3** + **shadcn/ui** sobre **Radix UI** (componentes em `src/components/ui/`)
- **framer-motion** (animações), **recharts** (gráficos), **react-helmet** (títulos)
- **lucide-react** (ícones)
- Backend: **Supabase** (auth + Postgres + Storage + Edge Functions)
- Transcrição de áudio: **AssemblyAI** (chamada direta do cliente)
- Idioma da UI: **português (pt-BR)**. Timezone de referência: **America/Sao_Paulo**.

Scripts: `npm run dev` (porta 3000), `npm run build`, `npm run lint`.

## Backend (Supabase)

- Projeto: `hudxninxnaigenbrigzk` — client em `src/lib/customSupabaseClient.js`
  (URL + anon key hardcoded; export nomeado `supabase`).
- **Storage bucket**: `sales-assets` (pastas `readings/`, `audio/`); uploads de
  comprovantes via `MultiFileUpload` (pastas `payments`/`proofs`).
- **Edge Functions** invocadas via `supabase.functions.invoke(...)` (ver `src/lib/aiUtils.js`):
  - `analyze-tarot-card` — identifica cartas a partir da imagem (`{ imageUrl }` → `{ cardNames }`)
  - `generate-tarot-reading-text` — gera o texto da leitura (persona Megumi)
  - `generate-audio-from-text` — TTS via ElevenLabs (retorna `{ audioBase64 }` MP3)
  - `summarize-sale-context` — resume/otimiza o contexto da venda
  - `optimize-question` — reescreve a pergunta inserindo nomes das pessoas
  - `analyze-transcript` — resume / extrai perguntas / gera leitura a partir de transcrição

### Tabelas (inferidas pelo uso)

- **`profiles`**: `id` (= auth.users.id), `name`, `role` (`admin` | `seller`).
  Default de role no app é `seller`.
- **`sales`**: principal. Colunas usadas:
  - identidade: `id` (uuid), `friendly_id` (nº curto exibido como `#123`)
  - cliente: `customer_name`, `customer_birth_date` (date `YYYY-MM-DD`), `whatsapp`
  - origem: `controle_de_leads` (texto = nome da origem; default `'Não Especificado'`)
  - conteúdo: `summary`, `internal_notes`, `observations`
  - `additional_people` (jsonb): `[{ name, birthDate, relationship }]`
  - perguntas (3 representações coexistem por legado):
    - `questions_data` (jsonb, **canônica**): `[{ question, imageUrl, cardName, interpretation, audioUrl }]`
    - `questions_json` (array de strings) e `questions` (string com `\n`)
  - pagamento: `price` (numeric), `payment_method` (`pix` | `credit_card` | `transfer_euro`)
  - arquivos: `files_urls` (jsonb array) e `payment_proof_url` (legado = primeiro arquivo)
  - `seller_id` (fk → profiles.id), `status`, `created_at` (usado também como "data da venda", editável)
- **`lead_source_options`**: `id`, `name`, `is_active`, `created_at`. Gerenciada em
  `/admin-settings` via `LeadSourceManager` + hook `useLeadSources`.

### Status da venda (workflow)
`draft` → `pending_reading` → `reading_completed` → `pending_sending` → `completed`
- Gerar áudio move automaticamente para `pending_sending`.
- Checkbox "Enviado ao Cliente" alterna entre `pending_sending` e `completed`.

## Estrutura de rotas (`src/App.jsx`)

Auth via `AuthContext` (`src/contexts/AuthContext.jsx`). `PrivateRoute` protege
rotas; `adminOnly` restringe a admins.

- `/login` — pública (`LoginPage`)
- `/sales`, `/sales/new`, `/sales/:id` — admin + seller
- `/transcribe` (`TranscribeAudioPage`), `/summarize` (`SummarizePage`) — admin + seller
- `/reports`, `/sellers` (`SellerManagementPage`), `/admin-settings` — **admin only**
- Layout: `src/components/layouts/DashboardLayout.jsx` (sidebar; menu filtrado por role)

## Páginas-chave

- **`SalesPage`** — lista de vendas, busca (nome/ID/WhatsApp), filtro por status,
  cards de estatística e painel de bônus (5% sobre vendas do mês, exceto rascunhos).
  Não-admin só vê as próprias vendas (filtro `seller_id` no client).
- **`NewSalePage`** — formulário de nova venda; autocomplete de clientes anteriores;
  "Otimizar com IA" (resumo e perguntas); salvar como rascunho.
- **`SaleDetailPage`** — núcleo do fluxo de leitura: por pergunta, sobe foto das cartas
  (galeria ou câmera) → identifica cartas → gera texto → gera áudio. Edição inline de
  pergunta/texto/WhatsApp; modal de edição completa; troca de status.
- **`ReportsPage`** (admin) — relatórios por período (timezone SP), receita, por vendedor,
  por origem; gráficos recharts.
- **`TranscribeAudioPage`** / **`SummarizePage`** — ferramentas de IA: transcrever áudio
  (AssemblyAI, pt, single speaker) e resumir/extrair perguntas/gerar leitura.

## Convenções e cuidados

- Datas de nascimento na UI usam máscara `DD/MM/AAAA`, convertidas para `YYYY-MM-DD`
  ao salvar. Datas/horas usam `src/lib/dateUtils.js` (sempre America/Sao_Paulo).
- WhatsApp validado por regex (mínimo 10 dígitos) e é obrigatório na nova venda.
- O isolamento por vendedor é feito no client (`.eq('seller_id', ...)`). A segurança
  real **deve** vir de RLS no Supabase — não confiar só no filtro do front.
- **Segredo exposto**: a chave da AssemblyAI está hardcoded em `src/lib/assemblyAi.js`
  e vai para o bundle do cliente. A anon key do Supabase é pública por design (ok),
  mas a da AssemblyAI idealmente deveria ir para uma Edge Function. Sinalizar se for mexer aí.
- Plugins Vite do Horizons (`plugins/visual-editor`, `selection-mode`) só rodam em dev.
- Sem suíte de testes configurada.
