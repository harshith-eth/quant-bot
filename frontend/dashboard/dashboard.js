// QUANTUM DEGEN TRADING AI SWARM - DASHBOARD CONTROLLER
// Real-time data coordinator for all dashboard components

class DashboardController {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        
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
            const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔗 WebSocket Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
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
            case 'position_update':
                window.loadActivePositions && window.loadActivePositions();
                break;
            case 'ai_update':
                window.loadAIAnalysis && window.loadAIAnalysis();
                break;
            case 'market_update':
                window.loadMarketAnalysis && window.loadMarketAnalysis();
                break;
            case 'whale_update':
                window.loadWhaleActivity && window.loadWhaleActivity();
                break;
            case 'signal_update':
                window.loadSignalFeed && window.loadSignalFeed();
                break;
            case 'scanner_update':
                window.loadMemeScanner && window.loadMemeScanner();
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
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
    
    updateConnectionStatus(connected) {
        // Update connection indicator if it exists
        const indicator = document.getElementById('connection-status');
        if (indicator) {
            indicator.textContent = connected ? '🟢 ONLINE' : '🔴 OFFLINE';
            indicator.style.color = connected ? '#00ff00' : '#ff0000';
        }
        
        // Update any status displays
        const statusElements = document.querySelectorAll('.connection-status');
        statusElements.forEach(element => {
            element.textContent = connected ? 'ONLINE' : 'OFFLINE';
            element.style.color = connected ? '#00ff00' : '#ff0000';
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
            this.websocket.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message: WebSocket not connected');
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