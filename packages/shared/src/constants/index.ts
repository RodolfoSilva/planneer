// Project type labels
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  construction: "Construção",
  industrial_maintenance: "Manutenção Industrial",
  engineering: "Engenharia",
  it: "Tecnologia da Informação",
  other: "Outro",
};

// Project status labels
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  planning: "Planejamento",
  in_progress: "Em Andamento",
  completed: "Concluído",
  archived: "Arquivado",
};

// Schedule status labels
export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  archived: "Arquivado",
};

// Activity type labels
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  task: "Tarefa",
  milestone: "Marco",
  summary: "Resumo",
  start_milestone: "Marco de Início",
  finish_milestone: "Marco de Término",
};

// Relationship type labels
export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  FS: "Término-Início (FS)",
  FF: "Término-Término (FF)",
  SS: "Início-Início (SS)",
  SF: "Início-Término (SF)",
};

// Resource type labels
export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  labor: "Mão de Obra",
  material: "Material",
  equipment: "Equipamento",
  expense: "Despesa",
};

// Duration unit labels
export const DURATION_UNIT_LABELS: Record<string, string> = {
  hours: "Horas",
  days: "Dias",
  weeks: "Semanas",
  months: "Meses",
};

// Export format labels
export const EXPORT_FORMAT_LABELS: Record<string, string> = {
  xer: "Primavera XER",
  xml: "Primavera XML (P6)",
  csv: "CSV",
  xlsx: "Excel",
};

// API constants
export const API_VERSION = "v1";
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Chat constants
export const MAX_CHAT_MESSAGE_LENGTH = 10000;
export const CHAT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// File upload constants
export const MAX_FILE_SIZE_MB = 50;
export const ALLOWED_FILE_EXTENSIONS = [".xer", ".xml"];

// LLM constants
export const DEFAULT_LLM_MODEL = "gpt-4-turbo-preview";
export const FALLBACK_LLM_MODEL = "claude-3-sonnet-20240229";
export const MAX_TOKENS = 4096;
export const EMBEDDING_MODEL = "text-embedding-ada-002";
export const EMBEDDING_DIMENSIONS = 1536;





