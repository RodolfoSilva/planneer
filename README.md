# Planneer

Plataforma SaaS inteligente para geração automatizada de cronogramas de projetos usando IA.

## Visão do Produto

1. **Descrição do Projeto**: O usuário descreve o tipo de projeto (construção, manutenção industrial, engenharia, TI, etc.)

2. **Análise de Histórico**: A IA analisa todos os projetos existentes no banco (templates históricos) usando RAG para encontrar projetos similares

3. **Personalização Inteligente**: A IA faz perguntas contextuais para personalizar o cronograma baseado nas especificidades do projeto

4. **Geração Completa**: No final, a IA gera:
   - Cronograma completo com atividades, durações, predecessoras, WBS e recursos
   - Arquivo XER (ou XML P6) pronto para importar no Primavera P6
   - Visualização interativa dentro do próprio SaaS

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Runtime | Bun |
| Backend Framework | Elysia |
| ORM | Drizzle ORM |
| Database | PostgreSQL + pgvector |
| Auth | Better-Auth |
| Frontend | React 19 + Vite |
| State/Data | React Query + fetch |
| Styling | Tailwind CSS |
| LLM | OpenAI (primary) + Anthropic (fallback) |
| File Storage | S3-compatible (MinIO local, S3 prod) |
| WebSocket | Elysia WebSocket |

## Pré-requisitos

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://docker.com/) e Docker Compose
- Node.js >= 18 (para algumas ferramentas)

## Setup do Projeto

1. Clone o repositório:
```bash
git clone <repo-url>
cd planneer
```

2. Instale as dependências:
```bash
bun install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie os serviços Docker:
```bash
bun run docker:up
```

5. Execute as migrations do banco:
```bash
bun run db:migrate
```

6. Inicie o desenvolvimento:
```bash
bun run dev
```

## Estrutura do Projeto

```
planneer/
├── docs/                    # Documentação do projeto
├── packages/
│   ├── backend/             # API REST + WebSocket (Elysia)
│   ├── frontend/            # Interface web (React + Vite)
│   └── shared/              # Types e utilitários compartilhados
├── docker-compose.yml       # PostgreSQL + pgvector + MinIO
└── package.json             # Workspaces config
```

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `bun run dev` | Inicia todos os serviços em modo desenvolvimento |
| `bun run dev:backend` | Inicia apenas o backend |
| `bun run dev:frontend` | Inicia apenas o frontend |
| `bun run build` | Build de produção |
| `bun run test` | Executa todos os testes |
| `bun run docker:up` | Inicia containers Docker |
| `bun run docker:down` | Para containers Docker |
| `bun run db:migrate` | Executa migrations |
| `bun run db:studio` | Abre Drizzle Studio |

## Documentação

- [Planejamento do Projeto](docs/PLAN.md)

## Licença

Proprietário - Todos os direitos reservados.

