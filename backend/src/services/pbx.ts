import { EventEmitter } from 'events';
import { prisma } from '../config/database';

export interface SipExtension {
  id: string;
  number: string;
  password: string;
  domain: string;
  tenantId: string;
  userId?: string;
  status: 'available' | 'busy' | 'offline' | 'ringing';
}

export interface CallSession {
  id: string;
  callId: string;
  fromNumber: string;
  toNumber: string;
  fromExtension?: string;
  toExtension?: string;
  direction: 'inbound' | 'outbound' | 'internal';
  status: 'ringing' | 'answered' | 'hold' | 'transfer' | 'ended';
  startTime: Date;
  answerTime?: Date;
  endTime?: Date;
  tenantId: string;
  recordingEnabled: boolean;
  recordingPath?: string;
}

export interface PbxConfig {
  domain: string;
  sipPort: number;
  mediaPort: number;
  rtpPortRange: { start: number; end: number };
  recordingEnabled: boolean;
  recordingPath: string;
  maxConcurrentCalls: number;
}

class PbxService extends EventEmitter {
  private config: PbxConfig;
  private activeCalls: Map<string, CallSession> = new Map();
  private extensions: Map<string, SipExtension> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.config = {
      domain: process.env.PBX_DOMAIN || 'localhost',
      sipPort: parseInt(process.env.SIP_PORT || '5060'),
      mediaPort: parseInt(process.env.MEDIA_PORT || '5080'),
      rtpPortRange: {
        start: parseInt(process.env.RTP_PORT_START || '10000'),
        end: parseInt(process.env.RTP_PORT_END || '20000')
      },
      recordingEnabled: process.env.RECORDING_ENABLED === 'true',
      recordingPath: process.env.RECORDING_PATH || '/var/recordings',
      maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS || '100')
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing PBX Service...');

      // Load existing extensions from database
      await this.loadExtensions();

      // Initialize SIP stack (mock implementation for now)
      await this.initializeSipStack();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log(`PBX Service initialized on ${this.config.domain}:${this.config.sipPort}`);

      this.emit('pbx:ready', {
        domain: this.config.domain,
        port: this.config.sipPort,
        extensions: this.extensions.size
      });
    } catch (error) {
      console.error('Failed to initialize PBX Service:', error);
      throw error;
    }
  }

  private async loadExtensions(): Promise<void> {
    try {
      // DISABLED to prevent infinite database queries in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Extension loading disabled in development mode');
        return;
      }

      const dbExtensions = await prisma.extension.findMany({
        where: { type: 'user' },
        include: { user: true }
      });

      for (const ext of dbExtensions) {
        const sipExtension: SipExtension = {
          id: ext.id,
          number: ext.number,
          password: this.generateSipPassword(),
          domain: this.config.domain,
          tenantId: ext.tenantId,
          userId: ext.user?.id,
          status: 'offline'
        };

        this.extensions.set(ext.number, sipExtension);
      }

      console.log(`Loaded ${this.extensions.size} extensions`);
    } catch (error) {
      console.error('Failed to load extensions:', error);
      throw error;
    }
  }

  private async initializeSipStack(): Promise<void> {
    // Mock SIP stack initialization
    // In a real implementation, this would initialize FreeSWITCH ESL connection
    console.log('SIP Stack initialized (mock)');

    // Simulate FreeSWITCH Event Socket Library connection
    setTimeout(() => {
      this.emit('sip:connected');
    }, 1000);
  }

  private setupEventHandlers(): void {
    this.on('sip:connected', () => {
      console.log('SIP stack connected');
    });

    this.on('call:incoming', this.handleIncomingCall.bind(this));
    this.on('call:answered', this.handleCallAnswered.bind(this));
    this.on('call:ended', this.handleCallEnded.bind(this));
  }

  // Extension Management
  async createExtension(extensionData: {
    number: string;
    tenantId: string;
    userId?: string;
  }): Promise<SipExtension> {
    const { number, tenantId, userId } = extensionData;

    if (this.extensions.has(number)) {
      throw new Error(`Extension ${number} already exists`);
    }

    const sipExtension: SipExtension = {
      id: `ext-${Date.now()}`,
      number,
      password: this.generateSipPassword(),
      domain: this.config.domain,
      tenantId,
      userId,
      status: 'offline'
    };

    this.extensions.set(number, sipExtension);

    // Register extension with SIP stack (mock)
    await this.registerExtension(sipExtension);

    this.emit('extension:created', sipExtension);

    return sipExtension;
  }

  async updateExtensionStatus(number: string, status: SipExtension['status']): Promise<void> {
    const extension = this.extensions.get(number);
    if (!extension) {
      throw new Error(`Extension ${number} not found`);
    }

    extension.status = status;
    this.extensions.set(number, extension);

    this.emit('extension:status', { number, status });
  }

  getExtension(number: string): SipExtension | undefined {
    return this.extensions.get(number);
  }

  getAllExtensions(tenantId?: string): SipExtension[] {
    const extensions = Array.from(this.extensions.values());
    return tenantId ? extensions.filter(ext => ext.tenantId === tenantId) : extensions;
  }

  // Call Management
  async initiateCall(fromNumber: string, toNumber: string, tenantId: string): Promise<CallSession> {
    const callId = this.generateCallId();

    const callSession: CallSession = {
      id: callId,
      callId,
      fromNumber,
      toNumber,
      fromExtension: this.isInternalNumber(fromNumber) ? fromNumber : undefined,
      toExtension: this.isInternalNumber(toNumber) ? toNumber : undefined,
      direction: this.isInternalNumber(fromNumber) ? 'outbound' : 'inbound',
      status: 'ringing',
      startTime: new Date(),
      tenantId,
      recordingEnabled: this.config.recordingEnabled
    };

    this.activeCalls.set(callId, callSession);

    // Initiate call through SIP stack (mock)
    await this.sipInitiateCall(callSession);

    this.emit('call:initiated', callSession);

    return callSession;
  }

  async answerCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    call.status = 'answered';
    call.answerTime = new Date();

    this.activeCalls.set(callId, call);

    this.emit('call:answered', call);
  }

  async endCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    call.status = 'ended';
    call.endTime = new Date();

    // Save call record to database
    await this.saveCallRecord(call);

    this.activeCalls.delete(callId);

    this.emit('call:ended', call);
  }

  async transferCall(callId: string, targetExtension: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    const target = this.extensions.get(targetExtension);
    if (!target) {
      throw new Error(`Target extension ${targetExtension} not found`);
    }

    call.status = 'transfer';

    // Perform transfer through SIP stack (mock)
    await this.sipTransferCall(callId, targetExtension);

    this.emit('call:transferred', { call, targetExtension });
  }

  getActiveCall(callId: string): CallSession | undefined {
    return this.activeCalls.get(callId);
  }

  getActiveCalls(tenantId?: string): CallSession[] {
    const calls = Array.from(this.activeCalls.values());
    return tenantId ? calls.filter(call => call.tenantId === tenantId) : calls;
  }

  // Event Handlers
  private async handleIncomingCall(callData: any): Promise<void> {
    console.log('Incoming call:', callData);
    // Handle incoming call routing
  }

  private async handleCallAnswered(call: CallSession): Promise<void> {
    console.log('Call answered:', call.callId);

    // Update extension status
    if (call.toExtension) {
      await this.updateExtensionStatus(call.toExtension, 'busy');
    }
  }

  private async handleCallEnded(call: CallSession): Promise<void> {
    console.log('Call ended:', call.callId);

    // Update extension status
    if (call.toExtension) {
      await this.updateExtensionStatus(call.toExtension, 'available');
    }
  }

  // Utility Methods
  private generateSipPassword(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private generateCallId(): string {
    return `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private isInternalNumber(number: string): boolean {
    return this.extensions.has(number);
  }

  private async registerExtension(extension: SipExtension): Promise<void> {
    // Mock SIP extension registration
    console.log(`Registering extension ${extension.number} with SIP stack`);
  }

  private async sipInitiateCall(call: CallSession): Promise<void> {
    // Mock SIP call initiation
    console.log(`Initiating SIP call from ${call.fromNumber} to ${call.toNumber}`);
  }

  private async sipTransferCall(callId: string, targetExtension: string): Promise<void> {
    // Mock SIP call transfer
    console.log(`Transferring call ${callId} to extension ${targetExtension}`);
  }

  private async saveCallRecord(call: CallSession): Promise<void> {
    try {
      const duration = call.endTime && call.answerTime ?
        Math.round((call.endTime.getTime() - call.answerTime.getTime()) / 1000) : 0;

      await prisma.call.create({
        data: {
          tenantId: call.tenantId,
          fromNumber: call.fromNumber,
          toNumber: call.toNumber,
          direction: call.direction,
          status: call.status === 'ended' ? 'completed' : call.status,
          startTime: call.startTime,
          answerTime: call.answerTime,
          endTime: call.endTime,
          duration: duration > 0 ? duration : null,
          extensionId: call.toExtension ?
            (await prisma.extension.findFirst({
              where: { number: call.toExtension }
            }))?.id : undefined,
          recordingPath: call.recordingPath
        }
      });
    } catch (error) {
      console.error('Failed to save call record:', error);
    }
  }

  // Health Check
  getStatus() {
    return {
      initialized: this.isInitialized,
      domain: this.config.domain,
      sipPort: this.config.sipPort,
      activeExtensions: this.extensions.size,
      activeCalls: this.activeCalls.size,
      maxConcurrentCalls: this.config.maxConcurrentCalls,
      recordingEnabled: this.config.recordingEnabled
    };
  }
}

export const pbxService = new PbxService();