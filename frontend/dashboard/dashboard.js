// QUANTUM DEGEN TRADING AI SWARM - DASHBOARD CONTROLLER
// Real-time data coordinator for all dashboard components

class DashboardController {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15;
        this.reconnectDelay = 3000;
        
        // Heartbeat and connection monitoring
        this.heartbeatInterval = null;
        this.connectionCheckInterval = null;
        this.lastPingSent = null;
        this.lastPong = null;
        this.lastMessageTime = null;
        
        // Client identification
        this.clientId = 'dashboard_' + Math.random().toString(36).substring(2, 10);
        
        // Custom event handlers
        this.eventHandlers = {};
        
        // Available and subscribed channels
        this.availableChannels = [];
        this.subscribedChannels = [];
        
        // Data refresh intervals
        this.refreshIntervals = {
            positions: 5000,      // 5 seconds
            aiAnalysis: 10000,    // 10 seconds
            marketAnalysis: 15000, // 15 seconds
            whaleActivity: 8000,   // 8 seconds
            memeScanner: 12000,    // 12 seconds
            signalFeed: 6000,      // 6 seconds
            portfolio: 30000       // 30 seconds
        };
        
        this.lastUpdate = {};
        this.errorCounts = {};
        
        console.log('🚀 Dashboard Controller Initialized');
    }
    
    async initialize() {
        console.log('🎯 Starting Dashboard Controller...');
        
        // Connect WebSocket for real-time updates
        this.connectWebSocket();
        
        // Start periodic data refreshes
        this.startDataRefresh();
        
        // Initialize all dashboard components
        await this.loadAllData();
        
        console.log('✅ Dashboard Controller Online');
    }
    
    connectWebSocket() {
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws`; // Use explicit port 8000
            
            console.log(`Connecting to WebSocket at: ${wsUrl}`);
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔗 WebSocket Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                
                // Subscribe to all data channels after connection
                this.subscribeToChannels();
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data.type);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };
            
            this.websocket.onclose = () => {
                console.log('📡 WebSocket Disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.attemptReconnect();
        }
    }
    
    // Subscribe to all data channels
    subscribeToChannels() {
        if (!this.isConnected || !this.websocket) {
            console.warn('Cannot subscribe: WebSocket not connected');
            return;
        }
        
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
        
        // Send subscription request
        this.websocket.send(JSON.stringify({
            action: 'subscribe',
            channels: channels
        }));
        
        console.log('Subscribed to channels:', channels);
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay);
        } else {
            console.error('❌ Max reconnection attempts reached');
        }
    }
    
    handleWebSocketMessage(data) {
        console.log('📨 WebSocket Message:', data.type);
        
        switch (data.type) {
            case 'connection_established':
                console.log('Connection established with server, available channels:', data.available_channels);
                // Store available channels for UI display
                this.availableChannels = data.available_channels || [];
                this.dispatchEvent('channels_available', {channels: this.availableChannels});
                break;
                
            case 'subscription_confirmed':
                console.log('Subscription confirmed for channels:', data.channels);
                // Store subscribed channels
                this.subscribedChannels = data.channels || [];
                this.dispatchEvent('subscriptions_confirmed', {channels: this.subscribedChannels});
                break;
                
            case 'data_update':
                console.log(`Data update received for channel: ${data.channel}`);
                this.handleDataUpdate(data.channel, data.data);
                break;
            
            case 'broadcast':
                console.log('Broadcast message received');
                this.handleBroadcast(data.data);
                break;
                
            case 'alert':
                console.log(`Alert received: ${data.alert_type} - ${data.message}`);
                this.showAlert(data.alert_type, data.message, data.severity);
                break;
                
            case 'trade_execution':
                console.log(`Trade execution update: ${data.status}`);
                this.handleTradeExecution(data);
                break;
                
            case 'pong':
                // Handle heartbeat response
                this.lastPong = Date.now();
                // Check the round-trip time
                if (this.lastPingSent) {
                    const rtt = this.lastPong - this.lastPingSent;
                    // If RTT is too high, log warning
                    if (rtt > 5000) {
                        console.warn(`⚠️ High WebSocket latency: ${rtt}ms`);
                    }
                }
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
        
        // Dispatch raw message event for plugins or extensions
        this.dispatchEvent('websocket_message', {data});
    }
    
    // Handle data updates for specific channels
    handleDataUpdate(channel, data) {
        switch(channel) {
            case 'portfolio_status':
                window.loadPortfolioStatus && window.loadPortfolioStatus(data);
                break;
            case 'active_positions':
                window.loadActivePositions && window.loadActivePositions(data);
                break;
            case 'ai_analysis':
                window.loadAIAnalysis && window.loadAIAnalysis(data);
                break;
            case 'market_analysis':
                window.loadMarketAnalysis && window.loadMarketAnalysis(data);
                break;
            case 'whale_activity':
                window.loadWhaleActivity && window.loadWhaleActivity(data);
                break;
            case 'signal_feed':
                window.loadSignalFeed && window.loadSignalFeed(data);
                break;
            case 'meme_scanner':
                window.loadMemeScanner && window.loadMemeScanner(data);
                break;
            case 'risk_management':
                window.loadRiskManagement && window.loadRiskManagement(data);
                break;
            default:
                console.log(`No handler for channel: ${channel}`);
        }
    }
    
    // Handle broadcast messages
    handleBroadcast(data) {
        const type = data?.type;
        
        switch(type) {
            case 'portfolio_update':
                window.loadPortfolioStatus && window.loadPortfolioStatus(data.data);
                break;
            case 'position_updated':
            case 'trade_executed':
                window.loadActivePositions && window.loadActivePositions();
                break;
            case 'signal_update':
                window.loadSignalFeed && window.loadSignalFeed();
                break;
            case 'whale_update':
                window.loadWhaleActivity && window.loadWhaleActivity();
                break;
            default:
                console.log('Unknown broadcast type:', type);
        }
    }
    
    // Show alerts from the server
    showAlert(alertType, message, severity = 'info') {
        console.log(`[${severity.toUpperCase()}] ${alertType}: ${message}`);
        
        // Create alert element
        const alertElement = document.createElement('div');
        alertElement.className = `dashboard-alert alert-${severity.toLowerCase()}`;
        
        // Create alert content
        alertElement.innerHTML = `
            <div class="alert-icon">${this.getAlertIcon(severity)}</div>
            <div class="alert-content">
                <div class="alert-type">${alertType}</div>
                <div class="alert-message">${message}</div>
            </div>
            <div class="alert-close">×</div>
        `;
        
        // Add to alerts container or create one
        let alertsContainer = document.getElementById('dashboard-alerts');
        if (!alertsContainer) {
            alertsContainer = document.createElement('div');
            alertsContainer.id = 'dashboard-alerts';
            document.body.appendChild(alertsContainer);
        }
        
        // Add the alert to the container
        alertsContainer.appendChild(alertElement);
        
        // Add click handler to close button
        const closeBtn = alertElement.querySelector('.alert-close');
        closeBtn.addEventListener('click', () => {
            alertElement.classList.add('closing');
            setTimeout(() => {
                alertsContainer.removeChild(alertElement);
                // Remove container if empty
                if (alertsContainer.children.length === 0) {
                    document.body.removeChild(alertsContainer);
                }
            }, 300);
        });
        
        // Auto-dismiss after a delay based on severity
        let timeout = 5000; // Default 5 seconds
        if (severity === 'critical') timeout = 0; // No auto-dismiss for critical
        else if (severity === 'warning') timeout = 10000; // 10 seconds for warnings
        
        if (timeout > 0) {
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.classList.add('closing');
                    setTimeout(() => {
                        if (alertElement.parentNode) {
                            alertsContainer.removeChild(alertElement);
                            // Remove container if empty
                            if (alertsContainer.children.length === 0 && alertsContainer.parentNode) {
                                document.body.removeChild(alertsContainer);
                            }
                        }
                    }, 300);
                }
            }, timeout);
        }
        
        // Play alert sound based on severity
        this.playAlertSound(severity);
        
        // Dispatch alert event
        this.dispatchEvent('alert', {type: alertType, message, severity});
        
        return alertElement;
    }
    
    // Get appropriate icon for alert severity
    getAlertIcon(severity) {
        switch(severity.toLowerCase()) {
            case 'critical':
                return '🔴'; // Red circle
            case 'warning':
                return '⚠️'; // Warning sign
            case 'success':
                return '✅'; // Check mark
            case 'info':
            default:
                return 'ℹ️'; // Info symbol
        }
    }
    
    // Play sound notification for alerts
    playAlertSound(severity) {
        // Only play sounds if enabled in settings
        if (localStorage.getItem('dashboard_sound_enabled') !== 'true') {
            return;
        }
        
        // Different sound for different severity levels
        // This could be implemented with actual sound files
        console.log(`Would play ${severity} sound if audio files were available`);
    }
    
    startDataRefresh() {
        // Set up intervals for each component
        Object.keys(this.refreshIntervals).forEach(component => {
            const interval = this.refreshIntervals[component];
            
            setInterval(() => {
                this.refreshComponent(component);
            }, interval);
        });
    }
    
    async refreshComponent(component) {
        try {
            switch (component) {
                case 'positions':
                    window.loadActivePositions && await window.loadActivePositions();
                    break;
                case 'aiAnalysis':
                    window.loadAIAnalysis && await window.loadAIAnalysis();
                    break;
                case 'marketAnalysis':
                    window.loadMarketAnalysis && await window.loadMarketAnalysis();
                    break;
                case 'whaleActivity':
                    window.loadWhaleActivity && await window.loadWhaleActivity();
                    break;
                case 'memeScanner':
                    window.loadMemeScanner && await window.loadMemeScanner();
                    break;
                case 'signalFeed':
                    window.loadSignalFeed && await window.loadSignalFeed();
                    break;
                case 'portfolio':
                    window.loadPortfolioStatus && await window.loadPortfolioStatus();
                    break;
            }
            
            this.lastUpdate[component] = Date.now();
            this.errorCounts[component] = 0;
            
        } catch (error) {
            console.error(`Error refreshing ${component}:`, error);
            this.errorCounts[component] = (this.errorCounts[component] || 0) + 1;
            
            // If too many errors, increase refresh interval
            if (this.errorCounts[component] > 3) {
                this.refreshIntervals[component] *= 1.5;
                console.warn(`Increased refresh interval for ${component} due to errors`);
            }
        }
    }
    
    async loadAllData() {
        console.log('📊 Loading all dashboard data...');
        
        const loadPromises = [
            this.safeLoad('positions', window.loadActivePositions),
            this.safeLoad('aiAnalysis', window.loadAIAnalysis),
            this.safeLoad('marketAnalysis', window.loadMarketAnalysis),
            this.safeLoad('whaleActivity', window.loadWhaleActivity),
            this.safeLoad('memeScanner', window.loadMemeScanner),
            this.safeLoad('signalFeed', window.loadSignalFeed),
            this.safeLoad('portfolio', window.loadPortfolioStatus)
        ];
        
        await Promise.allSettled(loadPromises);
        console.log('✅ Initial data load complete');
    }
    
    async safeLoad(componentName, loadFunction) {
        try {
            if (loadFunction) {
                await loadFunction();
                console.log(`✅ ${componentName} loaded`);
            }
        } catch (error) {
            console.error(`❌ Failed to load ${componentName}:`, error);
        }
    }
    
    updateConnectionStatus(connected, reconnecting = false, failed = false) {
        // Update connection indicator in the header
        const indicator = document.getElementById('connection-status');
        if (indicator) {
            if (connected) {
                indicator.textContent = '🟢 ONLINE';
                indicator.style.color = '#00ff00';
            } else if (reconnecting) {
                indicator.textContent = '🟠 RECONNECTING';
                indicator.style.color = '#ffaa00';
            } else if (failed) {
                indicator.textContent = '🔴 FAILED';
                indicator.style.color = '#ff0000';
            } else {
                indicator.textContent = '🔴 OFFLINE';
                indicator.style.color = '#ff0000';
            }
        }
        
        // Update all status displays with detailed connection status
        const statusElements = document.querySelectorAll('.connection-status');
        statusElements.forEach(element => {
            if (connected) {
                element.textContent = 'ONLINE';
                element.style.color = '#00ff00';
                element.classList.remove('offline', 'reconnecting', 'failed');
                element.classList.add('online');
            } else if (reconnecting) {
                element.textContent = 'RECONNECTING';
                element.style.color = '#ffaa00';
                element.classList.remove('online', 'offline', 'failed');
                element.classList.add('reconnecting');
            } else if (failed) {
                element.textContent = 'CONNECTION FAILED';
                element.style.color = '#ff0000';
                element.classList.remove('online', 'offline', 'reconnecting');
                element.classList.add('failed');
            } else {
                element.textContent = 'OFFLINE';
                element.style.color = '#ff0000';
                element.classList.remove('online', 'reconnecting', 'failed');
                element.classList.add('offline');
            }
        });
        
        // Dispatch connection status event
        this.dispatchEvent('connection_status_changed', {
            connected,
            reconnecting,
            failed
        });
    }
    
    // Utility method for API calls with error handling
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`API call failed: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    }
    
    // Send message via WebSocket if connected
    sendMessage(message) {
        if (this.websocket && this.isConnected) {
            try {
                this.websocket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                return false;
            }
        } else {
            console.warn('⚠️ Cannot send message: WebSocket not connected');
            return false;
        }
    }
    
    // Start heartbeat to keep connection alive
    startHeartbeat() {
        // Clear any existing heartbeat
        this.stopHeartbeat();
        
        // Send heartbeat every 15 seconds
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 15000);
        
        // Check for stale connection every 45 seconds
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, 45000);
        
        console.log('💓 Heartbeat monitoring started');
    }
    
    // Stop heartbeat monitoring
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }
    
    // Send a heartbeat ping
    sendHeartbeat() {
        if (this.sendMessage({
            action: 'ping',
            timestamp: new Date().toISOString(),
            client_id: this.clientId || 'dashboard'
        })) {
            console.debug('💓 Heartbeat sent');
            this.lastPingSent = Date.now();
        }
    }
    
    // Check if connection is stale
    checkConnectionStatus() {
        const now = Date.now();
        
        // No message received for 60 seconds
        if (this.isConnected && this.lastMessageTime && (now - this.lastMessageTime > 60000)) {
            console.warn('⚠️ No messages received for 60 seconds, connection may be stale');
            
            // No pong received for 30 seconds after ping
            if (this.lastPingSent && (now - this.lastPingSent > 30000) && 
                (!this.lastPong || this.lastPingSent > this.lastPong)) {
                console.error('❌ Connection appears to be dead - no pong response');
                this.terminateConnection();
            } else {
                // Send an urgent ping
                this.sendHeartbeat();
            }
        }
    }
    
    // Force close a stale connection to trigger reconnect
    terminateConnection() {
        console.log('🔄 Terminating stale connection to force reconnect');
        
        try {
            if (this.websocket) {
                this.websocket.close(3000, 'Connection terminated due to inactivity');
            }
        } catch (e) {
            console.error('Error closing websocket:', e);
        }
        
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.attemptReconnect();
    }
    
    // Send heartbeat to keep connection alive
    sendHeartbeat() {
        if (this.sendMessage({
            action: 'ping',
            timestamp: new Date().toISOString()
        })) {
            console.debug('Heartbeat sent');
        }
    }
    
    // Get dashboard health status
    getHealthStatus() {
        return {
            connected: this.isConnected,
            lastUpdates: this.lastUpdate,
            errorCounts: this.errorCounts,
            reconnectAttempts: this.reconnectAttempts
        };
    }
    
    // Force refresh all components
    async forceRefreshAll() {
        console.log('🔄 Force refreshing all components...');
        await this.loadAllData();
    }
    
    // Custom event system
    addEventListener(eventName, handler) {
        if (!this.eventHandlers[eventName]) {
            this.eventHandlers[eventName] = [];
        }
        this.eventHandlers[eventName].push(handler);
    }
    
    removeEventListener(eventName, handler) {
        if (this.eventHandlers[eventName]) {
            this.eventHandlers[eventName] = this.eventHandlers[eventName]
                .filter(h => h !== handler);
        }
    }
    
    dispatchEvent(eventName, data = {}) {
        if (this.eventHandlers[eventName]) {
            this.eventHandlers[eventName].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${eventName} event handler:`, error);
                }
            });
        }
    }
    
    // Handle trade execution updates
    handleTradeExecution(data) {
        // Dispatch trade execution event
        this.dispatchEvent('trade_execution', data);
        
        // Show alert for trade execution
        let alertType = 'Trade';
        let severity = 'info';
        let message = 'Trade executed';
        
        if (data.status === 'completed') {
            alertType = 'Trade Completed';
            severity = 'success';
            message = `${data.side || ''} ${data.symbol || ''} @ ${data.price || ''} - ${data.status}`;
        } else if (data.status === 'failed') {
            alertType = 'Trade Failed';
            severity = 'critical';
            message = `${data.error || 'Unknown error'}`;
        } else if (data.status === 'pending') {
            alertType = 'Trade Pending';
            severity = 'info';
            message = `${data.side || ''} ${data.symbol || ''} - Awaiting execution`;
        }
        
        this.showAlert(alertType, message, severity);
        
        // Update relevant data
        if (data.status === 'completed' || data.status === 'failed') {
            this.refreshComponent('positions');
            this.refreshComponent('portfolio');
        }
    }
    
    // Execute a trade
    async executeTrade(tradeData) {
        try {
            // Show pending alert
            this.showAlert('Trade Processing', `Executing ${tradeData.side} order for ${tradeData.symbol}...`, 'info');
            
            // Make API call to execute trade
            const response = await this.apiCall('/api/execute-trade', {
                method: 'POST',
                body: JSON.stringify(tradeData)
            });
            
            // Handle the response
            if (response.success) {
                this.showAlert('Trade Executed', `Successfully executed ${tradeData.side} order for ${tradeData.symbol}`, 'success');
                
                // Refresh positions and portfolio
                this.refreshComponent('positions');
                this.refreshComponent('portfolio');
                
                return response;
            } else {
                this.showAlert('Trade Failed', response.error || 'Unknown error', 'critical');
                return response;
            }
        } catch (error) {
            console.error('Error executing trade:', error);
            this.showAlert('Trade Error', error.message || 'Failed to execute trade', 'critical');
            return { success: false, error: error.message || 'Failed to execute trade' };
        }
    }
    
    // Close a trade position
    async closePosition(positionId) {
        try {
            // Show pending alert
            this.showAlert('Position Closing', `Closing position ID: ${positionId}...`, 'info');
            
            // Make API call to close position
            const response = await this.apiCall('/api/update-position', {
                method: 'POST',
                body: JSON.stringify({
                    position_id: positionId,
                    action: 'close'
                })
            });
            
            // Handle the response
            if (response.success) {
                this.showAlert('Position Closed', `Successfully closed position ID: ${positionId}`, 'success');
                
                // Refresh positions and portfolio
                this.refreshComponent('positions');
                this.refreshComponent('portfolio');
                
                return response;
            } else {
                this.showAlert('Close Failed', response.error || 'Unknown error', 'critical');
                return response;
            }
        } catch (error) {
            console.error('Error closing position:', error);
            this.showAlert('Close Error', error.message || 'Failed to close position', 'critical');
            return { success: false, error: error.message || 'Failed to close position' };
        }
    }
    
    // Update a trade position (e.g. change stop loss or take profit)
    async updatePosition(positionId, updateData) {
        try {
            // Make API call to update position
            const response = await this.apiCall('/api/update-position', {
                method: 'POST',
                body: JSON.stringify({
                    position_id: positionId,
                    ...updateData
                })
            });
            
            // Handle the response
            if (response.success) {
                this.showAlert('Position Updated', `Successfully updated position ID: ${positionId}`, 'success');
                
                // Refresh positions
                this.refreshComponent('positions');
                
                return response;
            } else {
                this.showAlert('Update Failed', response.error || 'Unknown error', 'warning');
                return response;
            }
        } catch (error) {
            console.error('Error updating position:', error);
            this.showAlert('Update Error', error.message || 'Failed to update position', 'warning');
            return { success: false, error: error.message || 'Failed to update position' };
        }
    }
    
    // Emergency stop - close all positions
    async emergencyStop() {
        try {
            // Show critical alert
            this.showAlert('EMERGENCY STOP', 'Closing all positions immediately!', 'critical');
            
            // Make API call to emergency exit
            const response = await this.apiCall('/api/emergency-exit', {
                method: 'POST'
            });
            
            // Handle the response
            if (response.success) {
                this.showAlert('Emergency Stop Complete', 'Successfully closed all positions', 'success');
                
                // Refresh positions and portfolio
                this.refreshComponent('positions');
                this.refreshComponent('portfolio');
                
                return response;
            } else {
                this.showAlert('Emergency Stop Failed', response.error || 'Unknown error', 'critical');
                return response;
            }
        } catch (error) {
            console.error('Error in emergency stop:', error);
            this.showAlert('Emergency Stop Error', error.message || 'Failed to execute emergency stop', 'critical');
            return { success: false, error: error.message || 'Failed to execute emergency stop' };
        }
    }
}

// Global dashboard controller instance
let dashboard = null;

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DashboardController();
    dashboard.initialize();
    
    // Make dashboard globally available
    window.dashboard = dashboard;
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Ctrl+R or F5 - Force refresh
        if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
            event.preventDefault();
            dashboard.forceRefreshAll();
        }
        
        // Ctrl+D - Show dashboard health
        if (event.ctrlKey && event.key === 'd') {
            console.log('🏥 Dashboard Health:', dashboard.getHealthStatus());
        }
    });
    
    console.log('🎯 Dashboard ready for real trading data!');
});

// Export for use in other modules
window.DashboardController = DashboardController; 