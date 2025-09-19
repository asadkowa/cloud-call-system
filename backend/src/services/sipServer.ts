import * as dgram from 'dgram';
import { ExtensionManager } from './extensionManager';

export class SipServer {
  private server: dgram.Socket;
  private port: number = 5060;
  private registrations: Map<string, any> = new Map();

  constructor() {
    this.server = dgram.createSocket('udp4');
    this.setupServer();
  }

  private setupServer() {
    this.server.on('message', async (msg, rinfo) => {
      try {
        const message = msg.toString();
        console.log(`📞 SIP Message from ${rinfo.address}:${rinfo.port}:\n${message}`);

        // Parse basic SIP message
        const lines = message.split('\n');
        const firstLine = lines[0];

        if (firstLine.includes('REGISTER')) {
          await this.handleRegister(message, rinfo);
        } else if (firstLine.includes('INVITE')) {
          await this.handleInvite(message, rinfo);
        } else if (firstLine.includes('BYE')) {
          await this.handleBye(message, rinfo);
        } else {
          // Send 200 OK for other messages
          this.sendResponse(message, rinfo, '200 OK');
        }
      } catch (error) {
        console.error('SIP Server Error:', error);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`🎙️ SIP Server listening on ${address?.address}:${address?.port}`);
    });

    this.server.on('error', (err) => {
      console.error('SIP Server Error:', err);
    });
  }

  private async handleRegister(message: string, rinfo: dgram.RemoteInfo) {
    console.log('📝 Handling REGISTER request');

    // Extract basic info
    const username = this.extractField(message, 'From:')?.match(/sip:(\w+)@/)?.[1];
    const authorization = this.extractField(message, 'Authorization:');

    if (!username) {
      this.sendResponse(message, rinfo, '400 Bad Request');
      return;
    }

    // Check if this is a registration request
    if (!authorization) {
      // Send 401 Unauthorized to request authentication
      this.send401Challenge(message, rinfo);
      return;
    }

    // Validate credentials (simplified)
    try {
      const isValid = await this.validateCredentials(username, authorization);
      if (isValid) {
        // Store registration
        this.registrations.set(username, {
          address: rinfo.address,
          port: rinfo.port,
          timestamp: new Date()
        });

        // Update database
        await ExtensionManager.registerExtension(username, 'SIP-Phone', `${rinfo.address}:${rinfo.port}`);

        this.sendResponse(message, rinfo, '200 OK', {
          'Contact': `<sip:${username}@${rinfo.address}:${rinfo.port}>`,
          'Expires': '3600'
        });
        console.log(`✅ Extension ${username} registered successfully`);
      } else {
        this.sendResponse(message, rinfo, '403 Forbidden');
        console.log(`❌ Extension ${username} registration failed - invalid credentials`);
      }
    } catch (error) {
      console.error('Registration validation error:', error);
      this.sendResponse(message, rinfo, '500 Server Internal Error');
    }
  }

  private async handleInvite(message: string, rinfo: dgram.RemoteInfo) {
    console.log('📞 Handling INVITE request');

    const fromUser = this.extractField(message, 'From:')?.match(/sip:(\w+)@/)?.[1];
    const toUser = this.extractField(message, 'To:')?.match(/sip:(\w+)@/)?.[1];

    if (!fromUser || !toUser) {
      this.sendResponse(message, rinfo, '400 Bad Request');
      return;
    }

    // Check if destination is registered
    const toRegistration = this.registrations.get(toUser);
    if (!toRegistration) {
      this.sendResponse(message, rinfo, '404 Not Found');
      console.log(`❌ Call from ${fromUser} to ${toUser} failed - destination not registered`);
      return;
    }

    // Log call attempt
    console.log(`📞 Call from ${fromUser} to ${toUser}`);

    // For now, just respond with 200 OK (simplified)
    this.sendResponse(message, rinfo, '200 OK', {
      'Contact': `<sip:${toUser}@${toRegistration.address}:${toRegistration.port}>`,
      'Content-Type': 'application/sdp'
    });

    // Forward INVITE to destination (simplified)
    // In a real implementation, you'd forward the full SIP message
    console.log(`📤 Forwarding call to ${toUser} at ${toRegistration.address}:${toRegistration.port}`);
  }

  private async handleBye(message: string, rinfo: dgram.RemoteInfo) {
    console.log('📴 Handling BYE request');
    this.sendResponse(message, rinfo, '200 OK');
  }

  private async validateCredentials(username: string, authorization: string): Promise<boolean> {
    try {
      // Extract nonce, response, etc. from authorization header
      // This is a simplified validation - in production, use proper digest authentication
      const usernameMatch = authorization.match(/username="([^"]+)"/);
      const responseMatch = authorization.match(/response="([^"]+)"/);

      if (!usernameMatch || !responseMatch) {
        return false;
      }

      // For now, just check if extension exists (simplified)
      // In production, validate the digest response
      return true; // Simplified - always allow for testing
    } catch (error) {
      console.error('Credential validation error:', error);
      return false;
    }
  }

  private extractField(message: string, field: string): string | undefined {
    const lines = message.split('\n');
    const line = lines.find(l => l.trim().startsWith(field));
    return line?.substring(field.length).trim();
  }

  private send401Challenge(message: string, rinfo: dgram.RemoteInfo) {
    const callId = this.extractField(message, 'Call-ID:') || 'unknown';
    const cseq = this.extractField(message, 'CSeq:') || '1 REGISTER';
    const via = this.extractField(message, 'Via:') || `SIP/2.0/UDP ${rinfo.address}:${rinfo.port}`;
    const from = this.extractField(message, 'From:') || '';
    const to = this.extractField(message, 'To:') || '';

    const nonce = Math.random().toString(36).substring(2);
    const realm = 'cloud-call-system.local';

    const response = [
      'SIP/2.0 401 Unauthorized',
      `Via: ${via}`,
      `From: ${from}`,
      `To: ${to}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq}`,
      `WWW-Authenticate: Digest realm="${realm}", nonce="${nonce}"`,
      'Content-Length: 0',
      '',
      ''
    ].join('\n');

    this.server.send(response, rinfo.port, rinfo.address);
  }

  private sendResponse(message: string, rinfo: dgram.RemoteInfo, status: string, headers: Record<string, string> = {}) {
    const callId = this.extractField(message, 'Call-ID:') || 'unknown';
    const cseq = this.extractField(message, 'CSeq:') || '1 REGISTER';
    const via = this.extractField(message, 'Via:') || `SIP/2.0/UDP ${rinfo.address}:${rinfo.port}`;
    const from = this.extractField(message, 'From:') || '';
    const to = this.extractField(message, 'To:') || '';

    const responseLines = [
      `SIP/2.0 ${status}`,
      `Via: ${via}`,
      `From: ${from}`,
      `To: ${to}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq}`
    ];

    // Add custom headers
    Object.entries(headers).forEach(([key, value]) => {
      responseLines.push(`${key}: ${value}`);
    });

    responseLines.push('Content-Length: 0');
    responseLines.push('');
    responseLines.push('');

    const response = responseLines.join('\n');
    this.server.send(response, rinfo.port, rinfo.address);
  }

  start() {
    this.server.bind(this.port, '0.0.0.0');
  }

  stop() {
    this.server.close();
  }

  getRegistrations() {
    return Array.from(this.registrations.entries()).map(([username, info]) => ({
      username,
      address: info.address,
      port: info.port,
      timestamp: info.timestamp
    }));
  }
}

// Export singleton instance
export const sipServer = new SipServer();