// WebSocket Client Test Script for Quantum Degen Trading AI Swarm

// Configuration
const serverUrl = 'ws://localhost:8000/ws';

// WebSocket connection
let ws = null;
let connected = false;

// Colors for console output
const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Logging function
function log(message, color = colors.reset) {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function connectWebSocket() {
    log(`Connecting to ${serverUrl}...`, colors.yellow);
    
    try {
        ws = new WebSocket(serverUrl);
        
        ws.onopen = () => {
            connected = true;
            log('WebSocket connection established! 🚀', colors.green);
            
            // Subscribe to all channels
            subscribeToChannels();
            
            // Start heartbeat
            startHeartbeat();
        };
        
        ws.onclose = () => {
            connected = false;
            log('WebSocket connection closed 🛑', colors.red);
            
            // Try to reconnect after 5 seconds
            setTimeout(() => {
                log('Attempting to reconnect...', colors.yellow);
                connectWebSocket();
            }, 5000);
        };
        
        ws.onerror = (error) => {
            log(`WebSocket error: ${error}`, colors.red);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (error) {
                log(`Error parsing message: ${error}`, colors.red);
            }
        };
        
    } catch (error) {
        log(`Failed to connect: ${error}`, colors.red);
    }
}

function subscribeToChannels() {
    if (!connected) return;
    
    const channels = [
        'portfolio_status',
        'active_positions',
        'ai_analysis',
        'market_analysis',
        'meme_scanner',
        'risk_management',
        'signal_feed',
        'whale_activity'
    ];
    
    const subscriptionMessage = {
        action: 'subscribe',
        channels: channels
    };
    
    ws.send(JSON.stringify(subscriptionMessage));
    log(`Subscribed to channels: ${channels.join(', ')}`, colors.cyan);
}

function startHeartbeat() {
    // Send heartbeat every 30 seconds
    setInterval(() => {
        if (connected) {
            ws.send(JSON.stringify({
                action: 'ping',
                timestamp: new Date().toISOString()
            }));
            log('Heartbeat sent 💓', colors.yellow);
        }
    }, 30000);
}

function handleMessage(data) {
    const type = data.type;
    
    switch (type) {
        case 'connection_established':
            log(`Connection established with server. Available channels: ${data.available_channels.join(', ')}`, colors.green);
            break;
            
        case 'subscription_confirmed':
            log(`Subscription confirmed for channels: ${data.channels.join(', ')}`, colors.green);
            break;
            
        case 'data_update':
            log(`Data update received for channel: ${data.channel}`, colors.cyan);
            log(`Data preview: ${JSON.stringify(data.data).substring(0, 100)}...`, colors.cyan);
            break;
            
        case 'broadcast':
            log(`Broadcast message received: ${data.data.type}`, colors.yellow);
            break;
            
        case 'alert':
            log(`Alert received: ${data.alert_type} - ${data.message}`, colors.red);
            break;
            
        case 'pong':
            log('Heartbeat response received 💓', colors.yellow);
            break;
            
        default:
            log(`Unknown message type: ${type}`, colors.red);
            log(`Message data: ${JSON.stringify(data)}`, colors.red);
    }
}

// Start the WebSocket connection
log('Starting WebSocket test client...', colors.green);
connectWebSocket();

// Handle process termination
process.on('SIGINT', () => {
    log('Test client shutting down...', colors.yellow);
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Display help message
console.log(`
${colors.yellow}====================================${colors.reset}
${colors.green}WebSocket Test Client for Quantum Degen AI Swarm${colors.reset}
${colors.yellow}====================================${colors.reset}

This client connects to the WebSocket server at ${serverUrl}
and subscribes to all available data channels.

It will automatically attempt to reconnect if the connection is lost.
Press Ctrl+C to exit.

`);
