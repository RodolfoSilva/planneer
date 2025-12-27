import { createAuthClient } from 'better-auth/react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
  };
  
  if (body) {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.error?.message || error.message || 'Request failed');
  }
  
  return response.json();
}

// Better-Auth client
export const authClient = createAuthClient({
  baseURL: API_BASE || 'http://localhost:4000',
  fetchOptions: {
    credentials: 'include',
  },
});

// Auth wrapper for compatibility
export const auth = {
  login: async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message || 'Login failed');
    }
    return result.data;
  },
  
  register: async (email: string, password: string, name: string) => {
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      throw new Error(result.error.message || 'Registration failed');
    }
    return result.data;
  },
  
  logout: async () => {
    const result = await authClient.signOut();
    if (result.error) {
      throw new Error(result.error.message || 'Logout failed');
    }
    return result.data;
  },
  
  getSession: async () => {
    const result = await authClient.getSession();
    if (result.error) {
      throw new Error(result.error.message || 'Failed to get session');
    }
    return result.data;
  },
};

// Projects
export const projects = {
  list: () =>
    apiRequest<{ success: boolean; data: { items: any[]; total: number } }>('/api/projects'),
  
  get: (id: string) =>
    apiRequest<{ success: boolean; data: any }>(`/api/projects/${id}`),
  
  create: (data: { organizationId: string; name: string; description?: string; type: string }) =>
    apiRequest<{ success: boolean; data: any }>('/api/projects', { method: 'POST', body: data }),
  
  update: (id: string, data: Partial<{ name: string; description: string; type: string; status: string }>) =>
    apiRequest<{ success: boolean; data: any }>(`/api/projects/${id}`, { method: 'PATCH', body: data }),
  
  delete: (id: string) =>
    apiRequest<{ success: boolean; data: { deleted: boolean } }>(`/api/projects/${id}`, { method: 'DELETE' }),
};

// Schedules
export const schedules = {
  list: (projectId?: string) =>
    apiRequest<{ success: boolean; data: { items: any[]; total: number } }>(
      `/api/schedules${projectId ? `?projectId=${projectId}` : ''}`
    ),
  
  get: (id: string) =>
    apiRequest<{ success: boolean; data: any }>(`/api/schedules/${id}`),
  
  create: (data: { projectId: string; name: string; description?: string; startDate?: string }) =>
    apiRequest<{ success: boolean; data: any }>('/api/schedules', { method: 'POST', body: data }),
  
  update: (id: string, data: Partial<{ name: string; description: string; status: string }>) =>
    apiRequest<{ success: boolean; data: any }>(`/api/schedules/${id}`, { method: 'PATCH', body: data }),
  
  export: (id: string, format: 'xer' | 'xml') =>
    apiRequest<{ success: boolean; data: { content: string; contentType: string; filename: string } }>(
      `/api/schedules/${id}/export`,
      { method: 'POST', body: { format } }
    ),
  
  delete: (id: string) =>
    apiRequest<{ success: boolean; data: { deleted: boolean } }>(`/api/schedules/${id}`, { method: 'DELETE' }),
};

// Templates
export const templates = {
  list: (type?: string) =>
    apiRequest<{ success: boolean; data: { items: any[]; total: number } }>(
      `/api/templates${type ? `?type=${type}` : ''}`
    ),
  
  get: (id: string) =>
    apiRequest<{ success: boolean; data: any }>(`/api/templates/${id}`),
  
  upload: async (file: File, organizationId: string, metadata?: { name?: string; description?: string; type?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', organizationId);
    if (metadata?.name) formData.append('name', metadata.name);
    if (metadata?.description) formData.append('description', metadata.description);
    if (metadata?.type) formData.append('type', metadata.type);
    
    const response = await fetch(`${API_BASE}/api/templates/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.error?.message || error.message || 'Upload failed');
    }
    
    return response.json();
  },
  
  delete: (id: string) =>
    apiRequest<{ success: boolean; data: { deleted: boolean } }>(`/api/templates/${id}`, { method: 'DELETE' }),
};

// Chat
export const chat = {
  listSessions: () =>
    apiRequest<{ success: boolean; data: { items: any[]; total: number } }>('/api/chat'),
  
  startSession: (data: { organizationId: string; projectType: string; projectDescription: string }) =>
    apiRequest<{ success: boolean; data: any }>('/api/chat/start', { method: 'POST', body: data }),
  
  getSession: (id: string) =>
    apiRequest<{ success: boolean; data: any }>(`/api/chat/${id}`),
  
  sendMessage: (sessionId: string, content: string) =>
    apiRequest<{ success: boolean; data: any }>(
      `/api/chat/${sessionId}/message`,
      { method: 'POST', body: { content } }
    ),
  
  generateSchedule: (sessionId: string) =>
    apiRequest<{ success: boolean; data: any }>(
      `/api/chat/${sessionId}/generate`,
      { method: 'POST' }
    ),
};

// Organizations
export const organizations = {
  list: () =>
    apiRequest<{ success: boolean; data: { items: any[]; total: number } }>('/api/organizations'),
  
  get: (id: string) =>
    apiRequest<{ success: boolean; data: any }>(`/api/organizations/${id}`),
  
  create: (data: { name: string; slug: string }) =>
    apiRequest<{ success: boolean; data: any }>('/api/organizations', { method: 'POST', body: data }),
  
  update: (id: string, data: Partial<{ name: string; slug: string; logo: string | null }>) =>
    apiRequest<{ success: boolean; data: any }>(`/api/organizations/${id}`, { method: 'PATCH', body: data }),
  
  delete: (id: string) =>
    apiRequest<{ success: boolean; data: { deleted: boolean } }>(`/api/organizations/${id}`, { method: 'DELETE' }),
  
  getMembers: (id: string) =>
    apiRequest<{ success: boolean; data: { items: any[]; total: number } }>(`/api/organizations/${id}/members`),
};

// Health
export const health = {
  check: () =>
    apiRequest<{ status: string; timestamp: string; version: string }>('/api/health'),
};

