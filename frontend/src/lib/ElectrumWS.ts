// src/lib/ElectrumWS.ts
import { Buffer } from 'buffer'; // Import Buffer for Node.js Buffer API in browser

// Define the history type more accurately if possible
export type ElectrumXHistoryTx = {
    tx_hash: string;
    height: number;
    fee?: number; // Optional fee field sometimes included
};

type RPCRequest  = { id: number; method: string; params: any[] };
type RPCResponse = { id: number; result?: any; error?: any; method?: string; params?: any[] }; // Add method/params for subscriptions

export class ElectrumWS {
  private ws: WebSocket | null = null; // Initialize as null
  private reqId = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
  private subscriptions = new Map<string, (params: any) => void>(); // For handling subscription notifications
  private connectionPromise: Promise<void> | null = null; // To avoid race conditions on connect

  constructor(private serverUrl: string) {}

  connect(): Promise<void> {
    // If already connected or connecting, return the existing promise or resolve immediately
    if (this.isConnected()) {
        return Promise.resolve();
    }
    if (this.connectionPromise) {
        return this.connectionPromise;
    }

    console.log(`[ElectrumWS] Attempting to connect to ${this.serverUrl}...`);
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
      } catch (error) {
        console.error('[ElectrumWS] WebSocket constructor failed:', error);
        this.connectionPromise = null;
        reject(error);
        return;
      }

      this.ws.onopen = () => {
        console.log('[ElectrumWS] WebSocket connected.');
        this.ws!.onmessage = ({ data }) => {
          try {
            const msg: RPCResponse = JSON.parse(data);
            // Check if it's a response to a request
            if (msg.id && this.pending.has(msg.id)) {
              const cb = this.pending.get(msg.id)!;
              if (msg.error) {
                console.error('[ElectrumWS] RPC Error:', msg.error);
                cb.reject(new Error(JSON.stringify(msg.error))); // Reject with an Error object
              } else {
                cb.resolve(msg.result);
              }
              this.pending.delete(msg.id);
            }
            // Check if it's a subscription notification
            else if (msg.method && this.subscriptions.has(msg.method)) {
              const subCallback = this.subscriptions.get(msg.method)!;
              subCallback(msg.params);
            } else {
              // console.log('[ElectrumWS] Received unhandled message:', msg); // Can be noisy
            }
          } catch (parseError) {
              console.error('[ElectrumWS] Failed to parse message:', data, parseError);
          }
        };
        this.ws!.onclose = (event) => {
            console.warn('[ElectrumWS] WebSocket closed:', event.code, event.reason);
            this.ws = null; // Reset ws state
            this.connectionPromise = null; // Allow reconnect attempts
            this.pending.forEach(p => p.reject(new Error(`WebSocket closed: ${event.reason}`))); // Reject pending requests
            this.pending.clear();
            // Optionally notify listeners about disconnection
        };
        this.ws!.onerror = (event) => {
            console.error('[ElectrumWS] WebSocket error:', event);
            // Don't reject the main connection promise here if it's already open,
            // let onclose handle the state reset.
        };
        resolve(); // Connection successful
      };

      // Handle initial connection error separately
      this.ws.onerror = (event) => {
          console.error('[ElectrumWS] WebSocket initial connection error:', event);
          this.ws = null; // Ensure ws is null if connection fails
          this.connectionPromise = null;
          reject(new Error('WebSocket initial connection error')); // Reject the connect promise
      };
    });

    return this.connectionPromise;
  }

  isConnected(): boolean {
      return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private request(method: string, params: any[]): Promise<any> {
    if (!this.isConnected()) {
      // Attempt to reconnect if not connected
      console.warn(`[ElectrumWS] Not connected. Attempting reconnect before request: ${method}`);
      return this.connect().then(() => this.request(method, params));
      // return Promise.reject(new Error('ElectrumWS not connected')); // Old behavior
    }

    const id = ++this.reqId;
    const payload: RPCRequest = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
          this.ws!.send(JSON.stringify(payload));
          // Optional: Add timeout for requests
          // setTimeout(() => {
          //   if (this.pending.has(id)) {
          //     this.pending.get(id)?.reject(new Error(`Request timeout for ${method} (${id})`));
          //     this.pending.delete(id);
          //   }
          // }, 30000); // 30 second timeout
      } catch (sendError) {
          console.error('[ElectrumWS] Error sending request:', sendError);
          this.pending.delete(id);
          reject(sendError);
      }
    });
  }

  // Subscribe method (example for headers)
  subscribe(method: string, params: any[], callback: (params: any) => void): Promise<any> {
      this.subscriptions.set(method, callback);
      return this.request(method, params);
  }

  // --- Standard ElectrumX Methods ---
  async getBalance(scripthash: string): Promise<{ confirmed: number; unconfirmed: number }> {
      const result = await this.request('blockchain.scripthash.get_balance', [scripthash]);
      // Ensure result has the expected shape, default to 0 if not
      return {
          confirmed: result?.confirmed ?? 0,
          unconfirmed: result?.unconfirmed ?? 0,
      };
  }

  async getHistory(scripthash: string): Promise<ElectrumXHistoryTx[]> {
      const result = await this.request('blockchain.scripthash.get_history', [scripthash]);
      return Array.isArray(result) ? result : []; // Ensure it returns an array
  }

  async getTransaction(txid: string, verbose = false): Promise<string | object> {
      return this.request('blockchain.transaction.get', [txid, verbose]);
  }

  async getLastBlockHeader(): Promise<{ height: number; hex: string } | null> {
      // Subscribe to headers, get the first result, then potentially unsubscribe (or just use the result)
      return new Promise((resolve, reject) => {
          const method = 'blockchain.headers.subscribe';
          const callback = (params: any[]) => {
              if (params && params[0] && typeof params[0].height === 'number') {
                  resolve(params[0] as { height: number; hex: string });
                  // Optional: Unsubscribe if you only need it once
                  // this.request('blockchain.headers.unsubscribe', []); // Method might vary
                  this.subscriptions.delete(method); // Stop listening
              } else {
                  // Don't reject here, maybe just log, as other headers might come.
                  // If it never resolves, the caller might time out.
                  console.warn('[ElectrumWS] Received invalid header subscription response:', params);
              }
          };

          // Add a timeout for getting the header
          const timeoutId = setTimeout(() => {
              this.subscriptions.delete(method); // Clean up listener
              reject(new Error('Timeout waiting for block header'));
          }, 15000); // 15 seconds timeout

          this.subscribe(method, [], callback)
              .then(initialHeader => { // The subscription request itself returns the current header
                  if (initialHeader && typeof initialHeader.height === 'number') {
                      clearTimeout(timeoutId);
                      this.subscriptions.delete(method); // Got it, no need to listen further
                      resolve(initialHeader as { height: number; hex: string });
                  }
                  // else, wait for the callback to resolve/reject via timeout
              })
              .catch(err => {
                  clearTimeout(timeoutId);
                  reject(err); // Handle potential errors during the initial subscription request
              });
      });
  }

  async serverVersion(clientName = 'KashyWebApp', protocolVersion = '1.4'): Promise<string[]> {
      // Returns array: [server_software_version, protocol_version]
      return this.request('server.version', [clientName, protocolVersion]);
  }

  close(): void {
    if (this.ws) {
      console.log('[ElectrumWS] Closing WebSocket connection.');
      // Remove listeners to prevent errors after close
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
      }
      this.ws = null;
      this.connectionPromise = null;
      this.pending.forEach(p => p.reject(new Error('WebSocket closed by client')));
      this.pending.clear();
      this.subscriptions.clear();
    }
  }
}

// Helper function to convert address to Electrum script hash
// Equivalent to bchjs.Address.hash160ToElectrumScriptHash(bchjs.Address.toHash160(addr))
export function addressToElectrumScriptHash(address: string, bitcore: any): string {
    try {
        const addr = bitcore.Address(address);
        const script = bitcore.Script.buildPublicKeyHashOut(addr);
        // SHA256 hash of the script
        const scriptHash = bitcore.crypto.Hash.sha256(script.toBuffer());
        // Reverse the byte order for ElectrumX
        return Buffer.from(scriptHash).reverse().toString('hex');
    } catch (error) {
        console.error(`Failed to convert address ${address} to scripthash:`, error);
        throw new Error(`Invalid address format: ${address}`);
    }
}
