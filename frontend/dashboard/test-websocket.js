/**
 * WebSocket Integration Test Script
 * 
 * This script tests the WebSocket connection between the frontend and backend.
 * It can be run in the browser console to verify that the real-time updates
 * are working correctly.
 */

class WebSocketTester {
    constructor(wsUrl = 'ws://localhost:8000/ws') {
        this.wsUrl = wsUrl;
        this.websocket = null;
        this.isConnected = false;
        this.messageLog = [];
        this.subscriptions = new Set();
        
        console.log(`🧪 WebSocket Tester initialized with URL: ${wsUrl}`);
    }
    
    // Connect to WebSocket server
    connect() {
        console.log(`🔄 Connecting to WebSocket at ${this.wsUrl}...`);
        
        try {
            this.websocket = new WebSocket(this.wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ WebSocket connection established');
                this.isConnected = true;
                this.logEvent('Connected to server');
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📥 Message received:', data);
                    this.messageLog.push({
                        timestamp: new Date().toISOString(),
                        type: 'received',
                        data
                    });
                    this.logEvent(`Received: ${data.type || 'unknown type'}`);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.websocket.onclose = (event) => {
                console.log(`❌ WebSocket disconnected (Code: ${event.code}, Reason: ${event.reason || 'No reason'})`);
                this.isConnected = false;
                this.logEvent(`Disconnected: ${event.code} ${event.reason || ''}`);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.logEvent('Error: Connection failed');
            };
            
            return true;
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.logEvent(`Error: ${error.message}`);
            return false;
        }
    }
    
    // Disconnect from server
    disconnect() {
        if (!this.websocket) {
            console.warn('No active WebSocket connection');
            return false;
        }
        
        try {
            this.websocket.close(1000, 'Test completed');
            console.log('🔌 WebSocket disconnected by user');
            this.logEvent('User disconnected');
            return true;
        } catch (error) {
            console.error('Error closing WebSocket:', error);
            this.logEvent(`Close error: ${error.message}`);
            return false;
        }
    }
    
    // Subscribe to channels
    subscribe(channels) {
        if (!this.isConnected || !this.websocket) {
            console.warn('Cannot subscribe: Not connected');
            return false;
        }
        
        const channelsArray = Array.isArray(channels) ? channels : [channels];
        
        try {
            const message = {
                action: 'subscribe',
                channels: channelsArray
            };
            
            this.websocket.send(JSON.stringify(message));
            console.log(`📝 Subscribed to channels: ${channelsArray.join(', ')}`);
            channelsArray.forEach(channel => this.subscriptions.add(channel));
            this.logEvent(`Subscribed to: ${channelsArray.join(', ')}`);
            return true;
        } catch (error) {
            console.error('Error subscribing to channels:', error);
            this.logEvent(`Subscribe error: ${error.message}`);
            return false;
        }
    }
    
    // Send a message to the server
    sendMessage(message) {
        if (!this.isConnected || !this.websocket) {
            console.warn('Cannot send message: Not connected');
            return false;
        }
        
        try {
            const serialized = typeof message === 'string' ? message : JSON.stringify(message);
            this.websocket.send(serialized);
            console.log('📤 Message sent:', message);
            this.messageLog.push({
                timestamp: new Date().toISOString(),
                type: 'sent',
                data: message
            });
            this.logEvent(`Sent: ${typeof message === 'string' ? message : JSON.stringify(message).substring(0, 30)}`);
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            this.logEvent(`Send error: ${error.message}`);
            return false;
        }
    }
    
    // Send a ping to keep connection alive
    ping() {
        return this.sendMessage({
            action: 'ping',
            timestamp: new Date().toISOString()
        });
    }
    
    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            url: this.wsUrl,
            messageCount: this.messageLog.length,
            subscriptions: Array.from(this.subscriptions)
        };
    }
    
    // Clear message log
    clearLog() {
        const count = this.messageLog.length;
        this.messageLog = [];
        console.log(`🧹 Cleared ${count} messages from log`);
        return count;
    }
    
    // Get message log
    getLog() {
        return this.messageLog;
    }
    
    // Log an event with timestamp
    logEvent(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }
    
    // Run automated test sequence
    async runTest() {
        console.log('🧪 Starting WebSocket test sequence');
        
        // Step 1: Connect
        if (!this.connect()) {
            console.error('❌ Test failed: Could not connect');
            return false;
        }
        
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.isConnected) {
            console.error('❌ Test failed: Connection timeout');
            return false;
        }
        
        console.log('✅ Connection test passed');
        
        // Step 2: Subscribe to channels
        const testChannels = [
            'portfolio_status',
            'active_positions',
            'market_analysis'
        ];
        
        if (!this.subscribe(testChannels)) {
            console.error('❌ Test failed: Could not subscribe to channels');
            return false;
        }
        
        console.log('✅ Subscription test passed');
        
        // Step 3: Send ping
        if (!this.ping()) {
            console.error('❌ Test failed: Could not send ping');
            return false;
        }
        
        console.log('✅ Ping test passed');
        
        // Wait for messages
        console.log('⏳ Waiting for messages (5 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we received any messages
        if (this.messageLog.filter(m => m.type === 'received').length === 0) {
            console.warn('⚠️ No messages received during test period');
        } else {
            console.log(`✅ Received ${this.messageLog.filter(m => m.type === 'received').length} messages`);
        }
        
        // Final status
        console.log('📊 Test completed. Final status:', this.getStatus());
        
        return true;
    }
}

// Create global instance for testing in console
window.wsTest = new WebSocketTester();

// Provide usage instructions
console.log(`
🧪 WebSocket Tester loaded!

To test the WebSocket connection, run the following commands in the console:

1. Start test sequence:
   wsTest.runTest()

2. Or test manually:
   wsTest.connect()                     // Connect to WebSocket server
   wsTest.subscribe(['channel_name'])   // Subscribe to channels
   wsTest.ping()                        // Send a ping
   wsTest.getStatus()                   // Check connection status
   wsTest.getLog()                      // Get message log

3. When done:
   wsTest.disconnect()                  // Disconnect from server
`);