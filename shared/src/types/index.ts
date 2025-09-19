export interface Tenant {
  id: string;
  name: string;
  domain: string;
  planType: 'basic' | 'professional' | 'enterprise';
  maxExtensions: number;
  maxConcurrentCalls: number;
  features: TenantFeature[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantFeature {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  extensionId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'agent' | 'supervisor' | 'user';

export interface Extension {
  id: string;
  tenantId: string;
  number: string;
  userId?: string;
  displayName: string;
  type: ExtensionType;
  status: ExtensionStatus;
  config: ExtensionConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type ExtensionType = 'user' | 'queue' | 'conference' | 'ivr';
export type ExtensionStatus = 'active' | 'inactive' | 'busy' | 'unavailable';

export interface ExtensionConfig {
  voicemail: boolean;
  callForwarding?: string;
  callWaiting: boolean;
  doNotDisturb: boolean;
  recordCalls: boolean;
}

export interface Call {
  id: string;
  tenantId: string;
  fromNumber: string;
  toNumber: string;
  direction: 'inbound' | 'outbound';
  status: CallStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordingUrl?: string;
  queueId?: string;
  agentId?: string;
}

export type CallStatus = 'ringing' | 'answered' | 'busy' | 'failed' | 'completed' | 'transferred';

export interface Queue {
  id: string;
  tenantId: string;
  name: string;
  extension: string;
  strategy: QueueStrategy;
  maxWaitTime: number;
  musicOnHold?: string;
  agents: QueueAgent[];
  isActive: boolean;
}

export type QueueStrategy = 'round_robin' | 'longest_idle' | 'least_calls' | 'random';

export interface QueueAgent {
  userId: string;
  skillLevel: number;
  isLoggedIn: boolean;
  currentStatus: AgentStatus;
}

export type AgentStatus = 'available' | 'busy' | 'away' | 'break' | 'offline';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}