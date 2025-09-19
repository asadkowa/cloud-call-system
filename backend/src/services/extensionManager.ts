import { prisma } from '../config/database';
import crypto from 'crypto';

export interface SipCredentials {
  username: string;
  password: string;
  domain: string;
  proxy: string;
  port: number;
}

export interface ExtensionRegistration {
  extensionId: string;
  sipUsername: string;
  sipPassword: string;
  domain: string;
  registered: boolean;
  lastSeen?: Date;
  userAgent?: string;
  contact?: string;
}

export class ExtensionManager {
  private static registrations: Map<string, ExtensionRegistration> = new Map();

  // Generate secure SIP password
  static generateSipPassword(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Create extension with SIP credentials
  static async createExtensionWithSip(extensionData: {
    tenantId: string;
    number: string;
    displayName: string;
    type: string;
    userId?: string;
  }) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: extensionData.tenantId }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Check if extension number already exists
    const existingExtension = await prisma.extension.findUnique({
      where: {
        tenantId_number: {
          tenantId: extensionData.tenantId,
          number: extensionData.number
        }
      }
    });

    if (existingExtension) {
      throw new Error(`Extension ${extensionData.number} already exists`);
    }

    // Generate SIP credentials
    const sipPassword = this.generateSipPassword();
    const sipDomain = process.env.PBX_DOMAIN || `${tenant.domain}.pbx.local`;

    // Create extension in database
    const extension = await prisma.extension.create({
      data: {
        tenantId: extensionData.tenantId,
        number: extensionData.number,
        displayName: extensionData.displayName,
        type: extensionData.type,
        sipPassword,
        sipDomain,
        sipEnabled: true,
        registrationStatus: 'unregistered'
      },
      include: {
        user: true,
        tenant: true
      }
    });

    // If userId provided, assign the extension
    if (extensionData.userId) {
      await prisma.user.update({
        where: { id: extensionData.userId },
        data: { extensionId: extension.id }
      });
    }

    // Create SIP account in PBX (simulated)
    await this.createSipAccount(extension.number, sipPassword, sipDomain);

    return extension;
  }

  // Get SIP credentials for extension
  static async getSipCredentials(extensionId: string): Promise<SipCredentials | null> {
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      include: { tenant: true }
    });

    if (!extension || !extension.sipEnabled) {
      return null;
    }

    return {
      username: extension.number,
      password: extension.sipPassword || '',
      domain: extension.sipDomain || extension.tenant.domain,
      proxy: process.env.PBX_PROXY || 'localhost',
      port: parseInt(process.env.PBX_SIP_PORT || '5060')
    };
  }

  // Register extension (called when SIP client registers)
  static async registerExtension(extensionNumber: string, userAgent?: string, contact?: string) {
    const extension = await prisma.extension.findFirst({
      where: {
        number: extensionNumber,
        sipEnabled: true
      }
    });

    if (!extension) {
      throw new Error('Extension not found');
    }

    // Update database
    await prisma.extension.update({
      where: { id: extension.id },
      data: {
        lastRegistered: new Date(),
        registrationStatus: 'registered'
      }
    });

    // Update local registration cache
    this.registrations.set(extension.id, {
      extensionId: extension.id,
      sipUsername: extension.number,
      sipPassword: extension.sipPassword || '',
      domain: extension.sipDomain || '',
      registered: true,
      lastSeen: new Date(),
      userAgent,
      contact
    });

    console.log(`Extension ${extensionNumber} registered successfully`);
    return true;
  }

  // Unregister extension
  static async unregisterExtension(extensionNumber: string) {
    const extension = await prisma.extension.findFirst({
      where: { number: extensionNumber }
    });

    if (extension) {
      await prisma.extension.update({
        where: { id: extension.id },
        data: {
          registrationStatus: 'unregistered'
        }
      });

      this.registrations.delete(extension.id);
      console.log(`Extension ${extensionNumber} unregistered`);
    }
  }

  // Get extension status
  static async getExtensionStatus(extensionId: string) {
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId }
    });

    if (!extension) {
      return null;
    }

    const registration = this.registrations.get(extensionId);

    return {
      id: extension.id,
      number: extension.number,
      displayName: extension.displayName,
      sipEnabled: extension.sipEnabled,
      registrationStatus: extension.registrationStatus,
      lastRegistered: extension.lastRegistered,
      isOnline: registration?.registered || false,
      lastSeen: registration?.lastSeen
    };
  }

  // Get all registered extensions
  static getRegisteredExtensions(): ExtensionRegistration[] {
    return Array.from(this.registrations.values());
  }

  // Authenticate SIP request
  static async authenticateSipRequest(username: string, password: string, domain: string): Promise<boolean> {
    const extension = await prisma.extension.findFirst({
      where: {
        number: username,
        sipPassword: password,
        sipDomain: domain,
        sipEnabled: true
      }
    });

    return !!extension;
  }

  // Create SIP account (simulated PBX integration)
  private static async createSipAccount(username: string, password: string, domain: string) {
    // In a real implementation, this would create the SIP account in FreeSWITCH
    // For now, we'll simulate it
    console.log(`Creating SIP account: ${username}@${domain}`);

    // Example FreeSWITCH XML user configuration
    const sipConfig = {
      username,
      password,
      domain,
      params: {
        'dial-string': '{^^:sip_invite_domain=${dialed_domain}:presence_id=${dialed_user}@${dialed_domain}}${sofia_contact(*/${dialed_user}@${dialed_domain})},${verto_contact(${dialed_user}@${dialed_domain})}',
        'jsonrpc-allowed-methods': 'verto',
        'jsonrpc-allowed-event-channels': 'demo,conference,presence'
      },
      variables: {
        'record_stereo': 'true',
        'default_gateway': '$${default_provider}',
        'default_areacode': '$${default_areacode}',
        'transfer_fallback_extension': 'operator'
      }
    };

    // Store configuration for later use
    return sipConfig;
  }

  // Initiate call from extension
  static async initiateCall(fromExtension: string, toNumber: string, tenantId: string) {
    // Find the extension
    const extension = await prisma.extension.findFirst({
      where: {
        number: fromExtension,
        tenantId,
        sipEnabled: true,
        registrationStatus: 'registered'
      }
    });

    if (!extension) {
      throw new Error('Extension not found or not registered');
    }

    // Create call session in database
    const callSession = await prisma.call.create({
      data: {
        tenantId,
        fromNumber: fromExtension,
        toNumber,
        direction: 'outbound',
        status: 'ringing',
        extensionId: extension.id
      }
    });

    // In a real implementation, this would trigger the actual call through FreeSWITCH
    console.log(`Initiating call from ${fromExtension} to ${toNumber}`);

    // Simulate call establishment
    setTimeout(async () => {
      await prisma.call.update({
        where: { id: callSession.id },
        data: { status: 'answered' }
      });
    }, 2000);

    return callSession;
  }

  // Answer incoming call
  static async answerCall(callId: string, extensionNumber: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'answered',
        extensionId: call.extensionId
      }
    });

    console.log(`Call ${callId} answered by extension ${extensionNumber}`);
    return true;
  }

  // End call
  static async endCall(callId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    const duration = call.startTime ? Math.floor((new Date().getTime() - call.startTime.getTime()) / 1000) : 0;

    await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'completed',
        endTime: new Date(),
        duration
      }
    });

    console.log(`Call ${callId} ended with duration ${duration} seconds`);
    return true;
  }

  // Update extension SIP settings
  static async updateSipSettings(extensionId: string, settings: {
    sipEnabled?: boolean;
    regeneratePassword?: boolean;
  }) {
    const updateData: any = {};

    if (settings.sipEnabled !== undefined) {
      updateData.sipEnabled = settings.sipEnabled;
    }

    if (settings.regeneratePassword) {
      updateData.sipPassword = this.generateSipPassword();
    }

    const extension = await prisma.extension.update({
      where: { id: extensionId },
      data: updateData,
      include: { user: true, tenant: true }
    });

    return extension;
  }

  // Get extension configuration for SIP client
  static async getExtensionConfig(extensionId: string) {
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      include: { user: true, tenant: true }
    });

    if (!extension) {
      throw new Error('Extension not found');
    }

    return {
      extension: {
        number: extension.number,
        displayName: extension.displayName,
        domain: extension.sipDomain || extension.tenant.domain
      },
      sip: {
        username: extension.number,
        password: extension.sipPassword,
        domain: extension.sipDomain || extension.tenant.domain,
        proxy: process.env.PBX_PROXY || 'localhost',
        port: parseInt(process.env.PBX_SIP_PORT || '5060'),
        transport: 'UDP'
      },
      features: {
        voicemail: true,
        callRecording: true,
        callTransfer: true,
        conference: true
      }
    };
  }

  // Monitor extension health (disabled in development)
  static async monitorExtensions() {
    if (process.env.NODE_ENV === 'development') {
      console.log('Extension monitoring skipped in development mode');
      return;
    }

    const registeredExtensions = await prisma.extension.findMany({
      where: {
        sipEnabled: true,
        registrationStatus: 'registered'
      }
    });

    // Check for stale registrations (older than 5 minutes)
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    for (const extension of registeredExtensions) {
      const registration = this.registrations.get(extension.id);

      if (!registration || (registration.lastSeen && registration.lastSeen < staleThreshold)) {
        // Mark as offline
        await this.unregisterExtension(extension.number);
      }
    }
  }
}

// Start monitoring extensions every minute (COMPLETELY DISABLED for development)
let extensionMonitorInterval: NodeJS.Timer | null = null;

// DISABLED: Extension monitoring causing infinite database queries
// if (process.env.NODE_ENV === 'production') {
//   extensionMonitorInterval = setInterval(() => {
//     ExtensionManager.monitorExtensions();
//   }, 60000);
// }

// Cleanup function to stop monitoring
export function stopExtensionMonitoring() {
  if (extensionMonitorInterval) {
    clearInterval(extensionMonitorInterval);
    extensionMonitorInterval = null;
  }
}