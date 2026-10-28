import { Peer, DataConnection } from 'peerjs';

export interface SignatureRelayPayload {
  type: 'SIGNATURE_PAYLOAD';
  dataUrl: string;
  strokes?: any[];
  timestamp: number;
}

export interface DesktopRelaySession {
  peerId: string;
  mobileUrl: string;
  close: () => void;
}

export interface MobileRelayClient {
  sendSignature: (dataUrl: string, strokes?: any[]) => Promise<boolean>;
  close: () => void;
}

/**
 * Initializes a desktop WebRTC peer listener to receive a signature from a remote mobile device.
 */
export function createDesktopRelay(
  onDeviceConnected: () => void,
  onSignatureReceived: (payload: SignatureRelayPayload) => void,
  onError?: (err: any) => void
): Promise<DesktopRelaySession> {
  return new Promise((resolve, reject) => {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const peerId = `esign-${Date.now().toString(36)}-${randomSuffix}`;

    const peer = new Peer(peerId, {
      debug: 1,
    });

    let activeConnection: DataConnection | null = null;

    peer.on('open', (id) => {
      const url = new URL(window.location.href);
      url.searchParams.set('session', id);
      url.searchParams.set('role', 'mobile');

      resolve({
        peerId: id,
        mobileUrl: url.toString(),
        close: () => {
          if (activeConnection) {
            try {
              activeConnection.close();
            } catch {
              // Ignore
            }
          }
          peer.destroy();
        },
      });
    });

    peer.on('connection', (conn) => {
      activeConnection = conn;

      conn.on('open', () => {
        onDeviceConnected();
      });

      conn.on('data', (data: any) => {
        if (data && data.type === 'SIGNATURE_PAYLOAD') {
          onSignatureReceived(data as SignatureRelayPayload);
        }
      });

      conn.on('error', (err) => {
        if (onError) onError(err);
      });
    });

    peer.on('error', (err) => {
      console.warn('PeerJS Desktop error:', err);
      if (onError) onError(err);
      reject(err);
    });
  });
}

/**
 * Connects a mobile device to the waiting desktop peer session over WebRTC.
 */
export function connectMobileToDesktop(
  targetPeerId: string,
  onConnected: () => void,
  onDisconnected?: () => void,
  onError?: (err: any) => void
): MobileRelayClient {
  const mobilePeerId = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const peer = new Peer(mobilePeerId, {
    debug: 1,
  });

  let connection: DataConnection | null = null;

  peer.on('open', () => {
    connection = peer.connect(targetPeerId, {
      reliable: true,
    });

    connection.on('open', () => {
      onConnected();
    });

    connection.on('close', () => {
      if (onDisconnected) onDisconnected();
    });

    connection.on('error', (err) => {
      if (onError) onError(err);
    });
  });

  peer.on('error', (err) => {
    console.warn('PeerJS Mobile error:', err);
    if (onError) onError(err);
  });

  return {
    sendSignature: (dataUrl: string, strokes?: any[]) => {
      return new Promise((res) => {
        if (!connection || !connection.open) {
          res(false);
          return;
        }

        const payload: SignatureRelayPayload = {
          type: 'SIGNATURE_PAYLOAD',
          dataUrl,
          strokes,
          timestamp: Date.now(),
        };

        try {
          connection.send(payload);
          res(true);
        } catch (err) {
          console.error('Failed to send signature payload:', err);
          res(false);
        }
      });
    },
    close: () => {
      if (connection) {
        try {
          connection.close();
        } catch {
          // Ignore
        }
      }
      peer.destroy();
    },
  };
}
