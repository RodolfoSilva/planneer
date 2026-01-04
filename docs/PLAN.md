# Planneer - Plataforma SaaS de Cronogramas com IA

## Visao do Produto

Plataforma SaaS inteligente para geracao automatizada de cronogramas de projetos:

1. **Descricao do Projeto**: O usuario descreve o tipo de projeto (construcao, manutencao industrial, engenharia, TI, etc.)

2. **Analise de Historico**: A IA analisa todos os projetos existentes no banco (templates historicos) usando RAG para encontrar projetos similares

3. **Personalizacao Inteligente**: A IA faz perguntas contextuais para personalizar o cronograma baseado nas especificidades do projeto

4. **Geracao Completa**: No final, a IA gera:
   - Cronograma completo com atividades, duracoes, predecessoras, WBS e recursos
   - Arquivo XER (ou XML P6) pronto para importar no Primavera P6
   - Visualizacao interativa dentro do proprio SaaS

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│    React + React Query + TanStack Router + Tailwind         │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                     Backend (Bun)                           │
│         Elysia/Hono + Drizzle ORM + Better-Auth             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ XER Parser  │  │ AI Service  │  │ Schedule Generator  │  │
│  │ (import/    │  │ (OpenAI +   │  │ (WBS, atividades,   │  │
│  │  export)    │  │  Anthropic) │  │  predecessoras)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              PostgreSQL + pgvector                          │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │ Users/Auth    │  │ Projects      │  │ Vector Store    │  │
│  │ Organizations │  │ Schedules     │  │ (embeddings)    │  │
│  └───────────────┘  └───────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Runtime | Bun |
| Backend Framework | Elysia |
| ORM | Drizzle ORM |
| Database | PostgreSQL + pgvector |
| Auth | better-auth (Google, GitHub, Email) |
| Frontend | React 19 + Vite |
| State/Data | React Query + fetch |
| Styling | Tailwind CSS |
| LLM | OpenAI (primary) + Anthropic (fallback) |
| File Storage | S3-compatible (MinIO local, S3 prod) |
| WebSocket | Elysia WebSocket |
| Testes | Bun test + testes de integração obrigatórios |

---

## Fase 1: Infraestrutura Base (Semana 1-2)

### 1.1 Setup do Projeto

- Estrutura monorepo com `packages/backend` e `packages/frontend`
- Configuração Bun + TypeScript
- Docker Compose para PostgreSQL + pgvector + MinIO
- Variáveis de ambiente e configuração

### 1.2 Banco de Dados

- Schema inicial com Drizzle ORM:
  - `users`, `organizations`, `organization_members`
  - `projects`, `schedules`, `activities`, `resources`
  - `project_templates` (para RAG)
  - `embeddings` (pgvector)

### 1.3 Autenticação

- Better-Auth para OAuth
- Providers: Google, GitHub, email/senha
- Multi-tenancy básico (organizations)

---

## Fase 2: Parser XER e Importação (Semana 3-4)

### 2.1 Parser XER/XML P6

- Usar biblioteca `xer-parser` (npm) para arquivos XER
- Criar parser para XML P6
- Extrair: WBS, atividades, durações, predecessoras, recursos, calendários

### 2.2 Pipeline de Importação

- Upload de arquivos para S3
- Job queue para processamento (Bun workers)
- Transformação para modelo interno
- Geração de embeddings (OpenAI ada-002)
- Armazenamento vetorial em pgvector

### 2.3 Endpoints REST

- `POST /api/templates/upload` - upload de XER/XML
- `GET /api/templates` - listar templates
- `GET /api/templates/:id` - detalhes do template

---

## Fase 3: Motor de IA e RAG (Semana 5-6)

### 3.1 Serviço de LLM

- Abstração para múltiplos providers (OpenAI + Anthropic)
- Fallback automático entre providers
- Rate limiting e retry logic
- Streaming de respostas

### 3.2 Sistema RAG

- Busca vetorial por similaridade (pgvector)
- Contexto retrieval baseado no tipo de projeto
- Prompt engineering para análise de projetos
- System prompts especializados por domínio (construção, TI, etc.)

### 3.3 Chat Inteligente

- `POST /api/chat/start` - inicia sessão de planejamento
- `POST /api/chat/message` - envia mensagem
- `GET /api/chat/:sessionId/history` - histórico
- Perguntas contextuais baseadas em templates similares
- WebSocket para comunicação em tempo real

---

## Fase 4: Gerador de Cronogramas (Semana 7-8)

### 4.1 Engine de Geração

- Algoritmo de geração de WBS
- Cálculo de durações baseado em histórico
- Definição automática de predecessoras
- Alocação de recursos

### 4.2 Exportação

- Gerador de XER (formato Primavera)
- Gerador de XML P6
- Exportação CSV/Excel
- `POST /api/schedules/:id/export` - exportar cronograma

### 4.3 Endpoints

- `POST /api/schedules/generate` - gera cronograma a partir da sessão de chat
- `GET /api/schedules/:id` - detalhes do cronograma
- `PATCH /api/schedules/:id/activities/:activityId` - editar atividade

---

## Fase 5: Frontend e Visualização (Semana 9-10)

### 5.1 Páginas Core

- Dashboard com projetos recentes
- Wizard de criação (chat com IA)
- Visualização de cronograma (tabela + timeline básica)
- Gestão de templates

### 5.2 Componentes de Visualização

- Tabela de atividades (editável)
- Timeline horizontal simples (CSS Grid)
- Indicadores de progresso
- Preview do WBS

### 5.3 UX do Chat

- Interface conversacional
- Indicador de "pensando"
- Sugestões de respostas
- Resumo do cronograma gerado

---

## Fase 6: Polish e Deploy (Semana 11-12)

### 6.1 Testes e Qualidade

- Testes unitários (Bun test)
- Testes de integração das APIs
- Validação de exportação XER/XML

### 6.2 Deploy

- Containerização (Docker)
- CI/CD (GitHub Actions)
- Backend: Railway
- Frontend: Netlify

---

## Estrutura de Pastas

```
planneer/
├── docs/
│   └── PLAN.md              # Este planejamento do projeto
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── routes/          # Rotas REST
│   │   │   ├── services/        # Lógica de negócio
│   │   │   │   ├── ai/          # LLM, RAG
│   │   │   │   ├── parser/      # XER/XML parsers
│   │   │   │   └── scheduler/   # Geração de cronogramas
│   │   │   ├── db/              # Drizzle schema e migrations
│   │   │   ├── auth/            # Better-Auth config
│   │   │   └── lib/             # Utilities
│   │   └── package.json
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── api/             # React Query hooks
│   │   └── package.json
│   └── shared/                  # Types compartilhados
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Parsing XER complexo | Usar biblioteca xer-parser, começar com subset de features |
| Qualidade da IA | Refinar prompts iterativamente, usar few-shot |
| Custo de embeddings | Cache agressivo, batch processing |
| Multi-tenancy segurança | Row-level security no PostgreSQL |

---

## Próximos Passos Após MVP

1. Gantt chart interativo completo
2. Colaboração em tempo real
3. Integração direta com Primavera P6 API
4. Mobile app (React Native + Expo)
5. Integrações (Jira, MS Project, Asana)
6. Integração com WhatsApp e outros canais de chat

---

## Arquitetura de Chat (Extensível)

O sistema de chat é projetado com arquitetura de canais/adapters para facilitar integrações futuras:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Service Core                         │
│         (Lógica de negócio, RAG, geração de respostas)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Channel Adapter Interface                  │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│ WebChannel  │ WhatsApp    │ Telegram    │ Slack            │
│ (WebSocket) │ (Futuro)    │ (Futuro)    │ (Futuro)         │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

Cada canal implementa a interface `ChatChannelAdapter` que permite:
- Receber mensagens do canal externo
- Enviar respostas formatadas para o canal
- Gerenciar sessões de chat
- Suportar streaming de respostas (quando aplicável)




