// User and Organization types
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
}

// Project types
export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  type: ProjectType;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectType = 
  | 'construction'
  | 'industrial_maintenance'
  | 'engineering'
  | 'it'
  | 'other';

export type ProjectStatus = 
  | 'draft'
  | 'planning'
  | 'in_progress'
  | 'completed'
  | 'archived';

// Schedule types
export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: ScheduleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleStatus = 'draft' | 'active' | 'completed' | 'archived';

// Activity types
export interface Activity {
  id: string;
  scheduleId: string;
  wbsId: string | null;
  code: string;
  name: string;
  description: string | null;
  duration: number; // in days
  durationUnit: DurationUnit;
  startDate: Date | null;
  endDate: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  percentComplete: number;
  activityType: ActivityType;
  calendarId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DurationUnit = 'hours' | 'days' | 'weeks' | 'months';

export type ActivityType = 
  | 'task'
  | 'milestone'
  | 'summary'
  | 'start_milestone'
  | 'finish_milestone';

// WBS types
export interface WBS {
  id: string;
  scheduleId: string;
  parentId: string | null;
  code: string;
  name: string;
  level: number;
  sortOrder: number;
  createdAt: Date;
}

// Predecessor/Relationship types
export interface ActivityRelationship {
  id: string;
  predecessorId: string;
  successorId: string;
  type: RelationshipType;
  lag: number; // in days
  lagUnit: DurationUnit;
}

export type RelationshipType = 'FS' | 'FF' | 'SS' | 'SF';

// Resource types
export interface Resource {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: ResourceType;
  unit: string | null;
  costPerUnit: number | null;
  createdAt: Date;
}

export type ResourceType = 'labor' | 'material' | 'equipment' | 'expense';

export interface ResourceAssignment {
  id: string;
  activityId: string;
  resourceId: string;
  units: number;
  plannedUnits: number;
  actualUnits: number;
}

// Template types (for RAG)
export interface ProjectTemplate {
  id: string;
  organizationId: string | null; // null = system template
  name: string;
  description: string | null;
  type: ProjectType;
  sourceFile: string | null;
  sourceFormat: 'xer' | 'xml' | 'manual';
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Chat types
export interface ChatSession {
  id: string;
  userId: string;
  projectId: string | null;
  status: ChatSessionStatus;
  context: ChatContext;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatSessionStatus = 'active' | 'completed' | 'abandoned';

export interface ChatContext {
  projectType?: ProjectType;
  projectDescription?: string;
  similarTemplates?: string[];
  collectedInfo: Record<string, unknown>;
  generatedScheduleId?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Export format types
export type ExportFormat = 'xer' | 'xml' | 'csv' | 'xlsx';

export interface ExportOptions {
  format: ExportFormat;
  includeResources?: boolean;
  includeRelationships?: boolean;
  includeWBS?: boolean;
}

// Chat channel adapter interface (for future integrations)
export interface ChatChannelMessage {
  channelType: ChatChannelType;
  externalId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type ChatChannelType = 'web' | 'whatsapp' | 'telegram' | 'slack';

export interface ChatChannelResponse {
  content: string;
  isStreaming?: boolean;
  metadata?: Record<string, unknown>;
}






