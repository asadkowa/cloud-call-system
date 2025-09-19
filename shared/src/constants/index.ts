export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  maxLimit: 100,
};

export const CALL_STATUSES = {
  RINGING: 'ringing',
  ANSWERED: 'answered',
  BUSY: 'busy',
  FAILED: 'failed',
  COMPLETED: 'completed',
  TRANSFERRED: 'transferred',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
  SUPERVISOR: 'supervisor',
  USER: 'user',
} as const;

export const EXTENSION_TYPES = {
  USER: 'user',
  QUEUE: 'queue',
  CONFERENCE: 'conference',
  IVR: 'ivr',
} as const;

export const QUEUE_STRATEGIES = {
  ROUND_ROBIN: 'round_robin',
  LONGEST_IDLE: 'longest_idle',
  LEAST_CALLS: 'least_calls',
  RANDOM: 'random',
} as const;

export const AGENT_STATUSES = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  AWAY: 'away',
  BREAK: 'break',
  OFFLINE: 'offline',
} as const;

export const WEBSOCKET_EVENTS = {
  CALL_INCOMING: 'call:incoming',
  CALL_ANSWERED: 'call:answered',
  CALL_ENDED: 'call:ended',
  AGENT_STATUS_CHANGED: 'agent:status_changed',
  QUEUE_STATS_UPDATED: 'queue:stats_updated',
} as const;