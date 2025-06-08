/**
 * WebSocket Connection Testing Utility
 * For Quant-Bot Trading Dashboard
 */

// WebSocket connection manager
class WebSocketTester {
    constructor(url = 'ws://localhost:8000/ws') {
        this.url = url;
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000; // 3 seconds
        this.heartbeatInterval = null;
        this.lastPingTime = null;
        this.latency = 0;
        this.messageQueue = [];
        this.autoReconnect = true;
        
        // Event callbacks
        this.onConnectCallbacks = [];
        this.onDisconnectCallbacks = [];
        this.onMessageCallbacks = [];
        this.onErrorCallbacks = [];
    }
    
    // Connect to WebSocket
    connect() {
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            this._triggerEvents('error', { message: 'Socket already exists' });
            return false;
        }
        
        try {
            this._log(`Connecting to ${this.url}...`);
            this.socket = new WebSocket(this.url);
            
            // Set up event handlers
            this.socket.onopen = (event) => this._handleOpen(event);
            this.socket.onclose = (event) => this._handleClose(event);
            this.socket.onmessage = (event) => this._handleMessage(event);
            this.socket.onerror = (event) => this._handleError(event);
            
            return true;
        } catch (error) {
            this._triggerEvents('error', { message: `Connection error: ${error.message}` });
            return false;
        }
    }
    
    // Disconnect from WebSocket
    disconnect() {
        this.autoReconnect = false;
        if (this.socket) {
            this._log('Disconnecting...');
            this.socket.close();
            this.stopHeartbeat();
            return true;
        }
        return false;
    }
    
    // Send a message to the server
    send(message) {
        if (this.isConnected()) {
            const messageString = typeof message === 'string' ? message : JSON.stringify(message);
            this.socket.send(messageString);
            this._log(`Sent: ${messageString}`);
            return true;
        } else {
            // Queue message for sending when connected
            this.messageQueue.push(message);
            this._log('Socket not connected, message queued');
            return false;
        }
    }
    
    // Subscribe to specific channels
    subscribe(channels = []) {
        if (!Array.isArray(channels) || channels.length === 0) {
            this._triggerEvents('error', { message: 'No channels specified for subscription' });
            return false;
        }
        
        const subscriptionMessage = {
            action: 'subscribe',
            channels: channels
        };
        
        return this.send(subscriptionMessage);
    }
    
    // Start sending heartbeat pings
    startHeartbeat(interval = 5000) {
        this.stopHeartbeat();
        
        this._log(`Starting heartbeat (${interval}ms interval)`);
        this.heartbeatInterval = setInterval(() => {
            this.sendPing();
        }, interval);
    }
    
    // Stop heartbeat pings
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            this._log('Heartbeat stopped');
        }
    }
    
    // Send ping message to measure latency
    sendPing() {
        if (this.isConnected()) {
            this.lastPingTime = Date.now();
            this.send({ action: 'ping' });
            return true;
        }
        return false;
    }
    
    // Check if connected
    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }
    
    // Register event handlers
    on(event, callback) {
        if (typeof callback !== 'function') {
            this._log(`Invalid callback for ${event} event`);
            return false;
        }
        
        switch(event) {
            case 'connect':
                this.onConnectCallbacks.push(callback);
                break;
            case 'disconnect':
                this.onDisconnectCallbacks.push(callback);
                break;
            case 'message':
                this.onMessageCallbacks.push(callback);
                break;
            case 'error':
                this.onErrorCallbacks.push(callback);
                break;
            default:
                this._log(`Unknown event: ${event}`);
                return false;
        }
        
        return true;
    }
    
    // Remove event handler
    off(event, callback) {
        let removed = false;
        
        switch(event) {
            case 'connect':
                removed = this._removeCallback(this.onConnectCallbacks, callback);
                break;
            case 'disconnect':
                removed = this._removeCallback(this.onDisconnectCallbacks, callback);
                break;
            case 'message':
                removed = this._removeCallback(this.onMessageCallbacks, callback);
                break;
            case 'error':
                removed = this._removeCallback(this.onErrorCallbacks, callback);
                break;
            default:
                this._log(`Unknown event: ${event}`);
                return false;
        }
        
        return removed;
    }
    
    // Get connection status
    getStatus() {
        let status = {
            connected: this.isConnected(),
            url: this.url,
            reconnectAttempts: this.reconnectAttempts,
            latency: this.latency,
            messageQueueSize: this.messageQueue.length
        };
        
        if (this.socket) {
            switch(this.socket.readyState) {
                case WebSocket.CONNECTING:
                    status.state = 'CONNECTING';
                    break;
                case WebSocket.OPEN:
                    status.state = 'OPEN';
                    break;
                case WebSocket.CLOSING:
                    status.state = 'CLOSING';
                    break;
                case WebSocket.CLOSED:
                    status.state = 'CLOSED';
                    break;
                default:
                    status.state = 'UNKNOWN';
            }
        } else {
            status.state = 'UNINITIALIZED';
        }
        
        return status;
    }
    
    // Handle WebSocket open event
    _handleOpen(event) {
        this.connected = true;
        this.reconnectAttempts = 0;
        this._log('Connection established');
        
        // Send any queued messages
        while (this.messageQueue.length > 0) {
            this.send(this.messageQueue.shift());
        }
        
        this._triggerEvents('connect', { event });
    }
    
    // Handle WebSocket close event
    _handleClose(event) {
        this.connected = false;
        this.stopHeartbeat();
        
        const reason = event.reason ? `: ${event.reason}` : '';
        this._log(`Connection closed (code: ${event.code}${reason})`);
        
        this._triggerEvents('disconnect', { event, code: event.code });
        
        // Attempt reconnect if enabled
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._log(`Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                if (this.autoReconnect) {
                    this.reconnectAttempts++;
                    this.connect();
                }
            }, this.reconnectInterval);
        }
    }
    
    // Handle WebSocket message event
    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Calculate latency if this is a response to a ping
            if (data.type === 'pong' && this.lastPingTime) {
                this.latency = Date.now() - this.lastPingTime;
                this.lastPingTime = null;
                this._log(`Pong received (latency: ${this.latency}ms)`);
            }
            
            this._triggerEvents('message', { data, raw: event.data });
        } catch (error) {
            // Handle non-JSON messages
            this._log(`Received non-JSON message: ${event.data}`);
            this._triggerEvents('message', { data: event.data, raw: event.data });
        }
    }
    
    // Handle WebSocket error event
    _handleError(event) {
        this._log('WebSocket error');
        this._triggerEvents('error', { event });
    }
    
    // Trigger event callbacks
    _triggerEvents(eventName, data) {
        let callbacks;
        
        switch(eventName) {
            case 'connect':
                callbacks = this.onConnectCallbacks;
                break;
            case 'disconnect':
                callbacks = this.onDisconnectCallbacks;
                break;
            case 'message':
                callbacks = this.onMessageCallbacks;
                break;
            case 'error':
                callbacks = this.onErrorCallbacks;
                break;
            default:
                return;
        }
        
        if (callbacks && callbacks.length > 0) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventName} callback:`, error);
                }
            });
        }
    }
    
    // Remove callback from array
    _removeCallback(callbackArray, callbackToRemove) {
        const initialLength = callbackArray.length;
        
        for (let i = callbackArray.length - 1; i >= 0; i--) {
            if (callbackArray[i] === callbackToRemove) {
                callbackArray.splice(i, 1);
            }
        }
        
        return callbackArray.length < initialLength;
    }
    
    // Logging function
    _log(message) {
        console.log(`WebSocketTester: ${message}`);
    }
}

// Diagnostic tool for WebSocket connection
class WebSocketDiagnostics {
    constructor(tester) {
        this.tester = tester;
        this.startTime = null;
        this.lastMessageTime = null;
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.errors = 0;
        this.diagnosticsInterval = null;
        this.diagnosticsData = {
            uptime: 0,
            messageRate: 0,
            connectedTime: null,
            lastMessage: null,
            status: 'Disconnected'
        };
        
        // Set up event handlers
        this._registerEvents();
    }
    
    // Start diagnostics
    start(interval = 1000) {
        this.stop();
        
        this.diagnosticsInterval = setInterval(() => {
            this._updateDiagnostics();
        }, interval);
        
        return this.getDiagnostics();
    }
    
    // Stop diagnostics
    stop() {
        if (this.diagnosticsInterval) {
            clearInterval(this.diagnosticsInterval);
            this.diagnosticsInterval = null;
        }
    }
    
    // Get current diagnostics data
    getDiagnostics() {
        return this._updateDiagnostics();
    }
    
    // Reset diagnostics counters
    reset() {
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.errors = 0;
        this.startTime = this.tester.isConnected() ? new Date() : null;
        this.lastMessageTime = null;
        return this._updateDiagnostics();
    }
    
    // Register for WebSocket events
    _registerEvents() {
        this.tester.on('connect', (data) => {
            this.startTime = new Date();
            this.diagnosticsData.status = 'Connected';
            this.diagnosticsData.connectedTime = this.startTime;
        });
        
        this.tester.on('disconnect', (data) => {
            this.diagnosticsData.status = 'Disconnected';
        });
        
        this.tester.on('message', (data) => {
            this.messagesReceived++;
            this.lastMessageTime = new Date();
            this.diagnosticsData.lastMessage = this.lastMessageTime;
        });
        
        this.tester.on('error', (data) => {
            this.errors++;
            this.diagnosticsData.status = 'Error';
        });
        
        // Hook into the send method to count sent messages
        const originalSend = this.tester.send.bind(this.tester);
        this.tester.send = (message) => {
            const result = originalSend(message);
            if (result) this.messagesSent++;
            return result;
        };
    }
    
    // Update diagnostics data
    _updateDiagnostics() {
        const status = this.tester.getStatus();
        const now = new Date();
        
        this.diagnosticsData = {
            ...this.diagnosticsData,
            ...status,
            uptime: this.startTime ? (now - this.startTime) / 1000 : 0,
            messageRate: this._calculateMessageRate(),
            messagesReceived: this.messagesReceived,
            messagesSent: this.messagesSent,
            errors: this.errors,
            timestamp: now
        };
        
        return this.diagnosticsData;
    }
    
    // Calculate message rate (messages per second)
    _calculateMessageRate() {
        if (!this.startTime) return 0;
        
        const totalSeconds = (new Date() - this.startTime) / 1000;
        if (totalSeconds <= 0) return 0;
        
        return (this.messagesReceived / totalSeconds).toFixed(2);
    }
}

// Create and export both classes
window.WebSocketTester = WebSocketTester;
window.WebSocketDiagnostics = WebSocketDiagnostics;