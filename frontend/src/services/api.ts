import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';

class ApiService {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: 'http://localhost:3002/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          useAuthStore.getState().logout();
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async login(email: string, password: string) {
    const response = await this.instance.post('/auth/login', { email, password });
    return response.data;
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    role?: string;
  }) {
    const response = await this.instance.post('/auth/register', userData);
    return response.data;
  }

  async refreshToken() {
    const response = await this.instance.post('/auth/refresh');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.instance.get('/auth/me');
    return response.data;
  }

  async logout() {
    const response = await this.instance.post('/auth/logout');
    return response.data;
  }

  // Tenant methods
  async getTenants() {
    const response = await this.instance.get('/tenants');
    return response.data;
  }

  async createTenant(tenantData: {
    name: string;
    domain: string;
    planType: string;
    maxExtensions?: number;
    maxConcurrentCalls?: number;
    features?: string;
  }) {
    const response = await this.instance.post('/tenants', tenantData);
    return response.data;
  }

  async updateTenant(tenantId: string, updateData: {
    name?: string;
    domain?: string;
    planType?: string;
    maxExtensions?: number;
    maxConcurrentCalls?: number;
    features?: string;
    isActive?: boolean;
  }) {
    const response = await this.instance.put(`/tenants/${tenantId}`, updateData);
    return response.data;
  }

  async deleteTenant(tenantId: string) {
    const response = await this.instance.delete(`/tenants/${tenantId}`);
    return response.data;
  }

  async getCurrentTenant() {
    const response = await this.instance.get('/tenants/current');
    return response.data;
  }

  // User methods
  async getUsers() {
    const response = await this.instance.get('/users');
    return response.data;
  }

  async getUserById(id: string) {
    const response = await this.instance.get(`/users/${id}`);
    return response.data;
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    extensionId?: string;
  }) {
    const response = await this.instance.post('/users', userData);
    return response.data;
  }

  async updateUser(id: string, userData: any) {
    const response = await this.instance.put(`/users/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await this.instance.delete(`/users/${id}`);
    return response.data;
  }

  async changePassword(id: string, passwordData: {
    currentPassword: string;
    newPassword: string;
  }) {
    const response = await this.instance.post(`/users/${id}/change-password`, passwordData);
    return response.data;
  }

  // Extension methods
  async getExtensions() {
    const response = await this.instance.get('/extensions');
    return response.data;
  }

  async getAvailableExtensions() {
    const response = await this.instance.get('/extensions/available');
    return response.data;
  }

  async getExtensionById(id: string) {
    const response = await this.instance.get(`/extensions/${id}`);
    return response.data;
  }

  async createExtension(extensionData: {
    number: string;
    displayName: string;
    type: string;
    config?: any;
  }) {
    const response = await this.instance.post('/extensions', extensionData);
    return response.data;
  }

  async updateExtension(id: string, extensionData: any) {
    const response = await this.instance.put(`/extensions/${id}`, extensionData);
    return response.data;
  }

  async deleteExtension(id: string) {
    const response = await this.instance.delete(`/extensions/${id}`);
    return response.data;
  }

  async assignExtension(extensionId: string, userId: string) {
    const response = await this.instance.post(`/extensions/${extensionId}/assign`, { userId });
    return response.data;
  }

  async unassignExtension(extensionId: string) {
    const response = await this.instance.post(`/extensions/${extensionId}/unassign`);
    return response.data;
  }

  // SIP Extension methods
  async getSipCredentials(extensionId: string) {
    const response = await this.instance.get(`/extensions/${extensionId}/sip-credentials`);
    return response.data;
  }

  async getExtensionConfig(extensionId: string) {
    const response = await this.instance.get(`/extensions/${extensionId}/config`);
    return response.data;
  }

  async getExtensionStatus(extensionId: string) {
    const response = await this.instance.get(`/extensions/${extensionId}/status`);
    return response.data;
  }

  async registerExtension(extensionId: string, userAgent?: string, contact?: string) {
    const response = await this.instance.post(`/extensions/${extensionId}/register`, { userAgent, contact });
    return response.data;
  }

  async unregisterExtension(extensionId: string) {
    const response = await this.instance.post(`/extensions/${extensionId}/unregister`);
    return response.data;
  }

  async updateSipSettings(extensionId: string, settings: {
    sipEnabled?: boolean;
    regeneratePassword?: boolean;
  }) {
    const response = await this.instance.put(`/extensions/${extensionId}/sip-settings`, settings);
    return response.data;
  }

  async initiateExtensionCall(extensionId: string, toNumber: string) {
    const response = await this.instance.post(`/extensions/${extensionId}/call`, { toNumber });
    return response.data;
  }

  async getRegisteredExtensions() {
    const response = await this.instance.get('/extensions/registered/all');
    return response.data;
  }

  // Call methods
  async getCalls(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await this.instance.get(`/calls?${params.toString()}`);
    return response.data;
  }

  async getActiveCalls() {
    const response = await this.instance.get('/calls/active');
    return response.data;
  }

  async getCallById(id: string) {
    const response = await this.instance.get(`/calls/${id}`);
    return response.data;
  }

  async createCall(callData: {
    fromNumber: string;
    toNumber: string;
    direction: 'inbound' | 'outbound';
    extensionId?: string;
    queueId?: string;
    agentId?: string;
  }) {
    const response = await this.instance.post('/calls', callData);
    return response.data;
  }

  async updateCall(id: string, callData: any) {
    const response = await this.instance.put(`/calls/${id}`, callData);
    return response.data;
  }

  async transferCall(id: string, targetExtensionId: string) {
    const response = await this.instance.post(`/calls/${id}/transfer`, { targetExtensionId });
    return response.data;
  }

  async getCallsByAgent(agentId: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await this.instance.get(`/calls/agent/${agentId}?${params.toString()}`);
    return response.data;
  }

  async getCallsByExtension(extensionId: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const response = await this.instance.get(`/calls/extension/${extensionId}?${params.toString()}`);
    return response.data;
  }

  async getCallStats(startDate?: Date, endDate?: Date) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await this.instance.get(`/calls/stats/overview?${params.toString()}`);
    return response.data;
  }

  async getTodayCallStats() {
    const response = await this.instance.get('/calls/stats/today');
    return response.data;
  }

  // Queue methods
  async getQueues() {
    const response = await this.instance.get('/queues');
    return response.data;
  }

  // PBX methods
  async getPbxStatus() {
    const response = await this.instance.get('/pbx/status');
    return response.data;
  }

  async getPbxExtensions() {
    const response = await this.instance.get('/pbx/extensions');
    return response.data;
  }

  async getPbxCalls() {
    const response = await this.instance.get('/pbx/calls');
    return response.data;
  }

  async initiatePbxCall(callData: {
    fromNumber: string;
    toNumber: string;
  }) {
    const response = await this.instance.post('/pbx/calls', callData);
    return response.data;
  }

  async answerPbxCall(callId: string) {
    const response = await this.instance.post(`/pbx/calls/${callId}/answer`);
    return response.data;
  }

  async endPbxCall(callId: string) {
    const response = await this.instance.post(`/pbx/calls/${callId}/end`);
    return response.data;
  }

  async transferPbxCall(callId: string, targetExtension: string) {
    const response = await this.instance.post(`/pbx/calls/${callId}/transfer`, {
      targetExtension
    });
    return response.data;
  }

  // Subscription/Billing methods
  async getSubscription() {
    const response = await this.instance.get('/subscription');
    return response.data;
  }

  async createSubscription(subscriptionData: {
    planType: 'basic' | 'professional' | 'enterprise';
    billingCycle?: 'monthly' | 'yearly';
    paymentMethodId?: string;
    trialDays?: number;
  }) {
    const response = await this.instance.post('/subscription', subscriptionData);
    return response.data;
  }

  async updateSubscription(updateData: {
    planType?: 'basic' | 'professional' | 'enterprise';
    quantity?: number;
  }) {
    const response = await this.instance.put('/subscription', updateData);
    return response.data;
  }

  async cancelSubscription(immediate = false) {
    const response = await this.instance.delete('/subscription', { data: { immediate } });
    return response.data;
  }

  async reactivateSubscription() {
    const response = await this.instance.post('/subscription/reactivate');
    return response.data;
  }

  async getSubscriptionPlans() {
    const response = await this.instance.get('/subscription/plans');
    return response.data;
  }

  async getUsageData(billingPeriod?: string) {
    const params = billingPeriod ? `?billingPeriod=${billingPeriod}` : '';
    const response = await this.instance.get(`/subscription/usage${params}`);
    return response.data;
  }

  async recordUsage(usageData: {
    recordType: 'call_minutes' | 'seat_count' | 'sms_count';
    quantity: number;
    description?: string;
  }) {
    const response = await this.instance.post('/subscription/usage', usageData);
    return response.data;
  }

  // Admin methods for plan management
  async getAdminPlans(includeInactive = false) {
    const params = includeInactive ? '?includeInactive=true' : '';
    const response = await this.instance.get(`/admin/plans${params}`);
    return response.data;
  }

  async getAdminPlan(id: string) {
    const response = await this.instance.get(`/admin/plans/${id}`);
    return response.data;
  }

  async createAdminPlan(planData: {
    name: string;
    description?: string;
    monthlyPrice: number;
    yearlyPrice: number;
    features: string[];
    maxExtensions: number;
    maxConcurrentCalls: number;
    maxUsers: number;
    isActive?: boolean;
  }) {
    const response = await this.instance.post('/admin/plans', planData);
    return response.data;
  }

  async updateAdminPlan(id: string, planData: any) {
    const response = await this.instance.put(`/admin/plans/${id}`, planData);
    return response.data;
  }

  async deleteAdminPlan(id: string) {
    const response = await this.instance.delete(`/admin/plans/${id}`);
    return response.data;
  }

  async togglePlanStatus(id: string, isActive: boolean) {
    const response = await this.instance.post(`/admin/plans/${id}/toggle`, { isActive });
    return response.data;
  }

  async assignPlanToTenant(planId: string, tenantId: string, billingCycle = 'monthly') {
    const response = await this.instance.post(`/admin/plans/${planId}/assign`, {
      tenantId,
      billingCycle
    });
    return response.data;
  }

  async getAdminTenants() {
    const response = await this.instance.get('/admin/tenants');
    return response.data;
  }

  async seedDefaultPlans() {
    const response = await this.instance.post('/admin/plans/seed');
    return response.data;
  }

  // Generic method for custom API calls
  async get(endpoint: string) {
    const response = await this.instance.get(endpoint);
    return response.data;
  }

  async post(endpoint: string, data?: any) {
    const response = await this.instance.post(endpoint, data);
    return response.data;
  }

  async put(endpoint: string, data?: any) {
    const response = await this.instance.put(endpoint, data);
    return response.data;
  }

  async delete(endpoint: string) {
    const response = await this.instance.delete(endpoint);
    return response.data;
  }
}

export const api = new ApiService();