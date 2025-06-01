// Global variables for real-time updates
let websocket = null;
let isConnected = false;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Quantum Degen AI Dashboard Initializing...');
    
    // Load all card contents
    loadCardContents();
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();
    
    // Start periodic updates
    startPeriodicUpdates();
    
    // Update connection status
    updateConnectionStatus();
});

// Connect to WebSocket for real-time data
function connectWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws`;
        
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function(event) {
            console.log('✅ WebSocket connected');
            isConnected = true;
            updateConnectionStatus();
        };
        
        websocket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        websocket.onclose = function(event) {
            console.log('❌ WebSocket disconnected');
            isConnected = false;
            updateConnectionStatus();
            
            // Reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            isConnected = false;
            updateConnectionStatus();
        };
        
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        isConnected = false;
        updateConnectionStatus();
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'portfolio_update':
            updatePortfolioStatus(data.data);
            break;
        case 'new_signal':
            addNewSignal(data.data);
            break;
        case 'whale_movement':
            addWhaleMovement(data.data);
            break;
        case 'market_update':
            updateMarketData(data.data);
            break;
        case 'position_update':
            updateActivePositions(data.data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Update connection status indicator
function updateConnectionStatus() {
    const statusElement = document.querySelector('.status-indicator');
    if (statusElement) {
        if (isConnected) {
            statusElement.className = 'status-indicator status-green';
            statusElement.title = 'Connected to AI Swarm';
        } else {
            statusElement.className = 'status-indicator status-red';
            statusElement.title = 'Disconnected - Attempting to reconnect...';
        }
    }
}

// Load all card contents from backend
async function loadCardContents() {
    const cards = [
        'active-positions',
        'ai-analysis', 
        'market-analysis',
        'meme-scanner',
        'portfolio-status',
        'risk-management',
        'signal-feed',
        'whale-activity'
    ];
    
    for (const cardName of cards) {
        try {
            // First load the HTML template
            const htmlResponse = await fetch(`card-${cardName}.html`);
            const htmlContent = await htmlResponse.text();
            
            const cardElement = document.getElementById(cardName);
            if (cardElement) {
                cardElement.innerHTML = htmlContent;
            }
            
            // Then fetch real data from backend
            await loadCardData(cardName);
            
        } catch (error) {
            console.error(`Failed to load ${cardName}:`, error);
            // Fallback to static content if backend is not available
        }
    }
}

// Load real data for each card
async function loadCardData(cardName) {
    try {
        const response = await fetch(`http://localhost:8000/api/${cardName}`);
        if (response.ok) {
            const data = await response.json();
            updateCardWithData(cardName, data);
        } else {
            console.warn(`Backend not available for ${cardName}, using demo data`);
            generateDemoData(cardName);
        }
    } catch (error) {
        console.warn(`Failed to fetch ${cardName} data:`, error);
        generateDemoData(cardName);
    }
}

// Update card with real data from backend
function updateCardWithData(cardName, data) {
    switch(cardName) {
        case 'portfolio-status':
            updatePortfolioStatus(data);
            break;
        case 'active-positions':
            updateActivePositions(data);
            break;
        case 'whale-activity':
            updateWhaleActivity(data);
            break;
        case 'meme-scanner':
            updateMemeScanner(data);
            break;
        case 'signal-feed':
            updateSignalFeed(data);
            break;
        case 'market-analysis':
            updateMarketAnalysis(data);
            break;
        case 'ai-analysis':
            updateAIAnalysis(data);
            break;
        case 'risk-management':
            updateRiskManagement(data);
            break;
    }
}

// Generate demo data when backend is not available
function generateDemoData(cardName) {
    const demoData = {
        'portfolio-status': {
            current_balance: 25.00,
            target_balance: 20000.00,
            daily_pl: 0.00,
            total_roi: 0.00,
            win_rate: "0/0",
            best_trade: 0.00,
            worst_trade: 0.00
        },
        'active-positions': {
            positions: [
                { token: '$MOON', mc: '$156K', entry: '$0.00002145', size: '$8.00', pl: '+85%', time: '8m', action: 'TP1' },
                { token: '$DOGE2', mc: '$178K', entry: '$0.00000567', size: '$12.00', pl: '-8%', time: '15m', action: 'MON' }
            ]
        },
        'whale-activity': {
            movements: [
                { wallet: '0x7a2...3f9b', action: 'Buy', amount: '1,250 SOL', impact: 'High' },
                { wallet: '0x9c4...8e2d', action: 'Transfer', amount: '890 SOL', impact: 'Medium' }
            ]
        }
    };
    
    if (demoData[cardName]) {
        updateCardWithData(cardName, demoData[cardName]);
    }
}

// Update portfolio status
function updatePortfolioStatus(data) {
    const currentBalance = document.getElementById('current-balance');
    const gainNeeded = document.getElementById('gain-needed');
    const dailyPL = document.getElementById('daily-pl');
    const totalROI = document.getElementById('total-roi');
    const winRate = document.getElementById('win-rate');
    const bestTrade = document.getElementById('best-trade');
    const worstTrade = document.getElementById('worst-trade');
    
    if (currentBalance) currentBalance.textContent = `$${data.current_balance.toFixed(2)}`;
    if (gainNeeded) {
        const needed = ((data.target_balance - data.current_balance) / data.current_balance * 100);
        gainNeeded.textContent = `${needed.toFixed(0)}%`;
    }
    if (dailyPL) dailyPL.textContent = `${data.daily_pl.toFixed(2)}%`;
    if (totalROI) totalROI.textContent = `${data.total_roi.toFixed(2)}%`;
    if (winRate) winRate.textContent = data.win_rate;
    if (bestTrade) bestTrade.textContent = `${data.best_trade.toFixed(2)}%`;
    if (worstTrade) worstTrade.textContent = `${data.worst_trade.toFixed(2)}%`;
}

// Update active positions
function updateActivePositions(data) {
    const positionsContainer = document.getElementById('active-trades');
    if (!positionsContainer || !data.positions) return;
    
    positionsContainer.innerHTML = '';
    
    data.positions.forEach(position => {
        const positionElement = document.createElement('div');
        positionElement.className = 'trade-item active-trade';
        positionElement.innerHTML = `
            <div class="token-cell"><span class="token-name">${position.token}</span></div>
            <div class="mc-cell">${position.mc}</div>
            <div class="entry-cell">${position.entry}</div>
            <div class="size-cell">${position.size}</div>
            <div class="pl-cell ${position.pl.startsWith('+') ? 'profit' : 'loss'}">${position.pl}</div>
            <div class="time-cell"><span class="time-elapsed">${position.time}</span></div>
            <div class="action-cell">
                <button class="action-btn ${position.action === 'TP1' ? 'tp-ready' : 'monitoring'}">${position.action}</button>
            </div>
        `;
        positionsContainer.appendChild(positionElement);
    });
}

// Start periodic updates
function startPeriodicUpdates() {
    // Update every 5 seconds
    setInterval(() => {
        if (!isConnected) {
            // If WebSocket is not connected, fetch data via HTTP
            loadCardData('portfolio-status');
            loadCardData('active-positions');
            loadCardData('whale-activity');
            loadCardData('meme-scanner');
        }
    }, 5000);
    
    // Update timestamps every second
    setInterval(updateTimestamps, 1000);
}

// Update timestamps
function updateTimestamps() {
    const timeElements = document.querySelectorAll('.time-elapsed, .timestamp');
    timeElements.forEach(element => {
        // Simulate time progression
        const currentText = element.textContent;
        if (currentText.includes('m')) {
            const minutes = parseInt(currentText);
            if (Math.random() > 0.95) { // 5% chance to increment
                element.textContent = `${minutes + 1}m`;
            }
        }
    });
}

// Add new signal to signal feed
function addNewSignal(signalData) {
    const signalFeeds = document.querySelectorAll('.signal-feed');
    signalFeeds.forEach(feed => {
        const signalElement = document.createElement('div');
        signalElement.className = `signal-entry ${signalData.type || 'normal'}`;
        signalElement.innerHTML = `
            [<span class="timestamp">${new Date().toLocaleTimeString()}</span>] » ${signalData.message}
        `;
        
        feed.insertBefore(signalElement, feed.firstChild);
        
        // Keep only last 10 signals
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }
    });
}

// Add whale movement
function addWhaleMovement(whaleData) {
    const whaleFeed = document.getElementById('whale-feed');
    if (!whaleFeed) return;
    
    const whaleElement = document.createElement('div');
    whaleElement.className = `whale-item ${whaleData.action.toLowerCase()}`;
    whaleElement.innerHTML = `
        <div class="col wallet">${whaleData.wallet}</div>
        <div class="col action">${whaleData.action}</div>
        <div class="col amount">${whaleData.amount}</div>
        <div class="col impact ${whaleData.impact.toLowerCase()}">${whaleData.impact}</div>
    `;
    
    whaleFeed.insertBefore(whaleElement, whaleFeed.firstChild);
    
    // Keep only last 20 movements
    while (whaleFeed.children.length > 20) {
        whaleFeed.removeChild(whaleFeed.lastChild);
    }
}

// Simulate trading activity when backend is not available
function simulateTrading() {
    if (isConnected) return; // Don't simulate if real data is available
    
    const tokens = ['$PEPE2', '$WOJAK', '$CHAD', '$MOONBURN', '$SHIBAI', '$DOGE3', '$FLOKI'];
    const actions = ['Buy', 'Sell', 'Transfer'];
    
    // Simulate new signal
    if (Math.random() > 0.7) {
        const token = tokens[Math.floor(Math.random() * tokens.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        addNewSignal({
            type: Math.random() > 0.5 ? 'alert' : 'normal',
            message: `${token} ${action.toUpperCase()}\n• MC: $${Math.floor(Math.random() * 500)}K\n• Volume: +${Math.floor(Math.random() * 200)}%`
        });
    }
    
    // Simulate whale movement
    if (Math.random() > 0.8) {
        const wallet = `0x${Math.random().toString(16).substr(2, 3)}...${Math.random().toString(16).substr(2, 3)}`;
        const action = actions[Math.floor(Math.random() * actions.length)];
        const amount = `${Math.floor(Math.random() * 5000)} SOL`;
        const impacts = ['Low', 'Medium', 'High', 'Critical'];
        const impact = impacts[Math.floor(Math.random() * impacts.length)];
        
        addWhaleMovement({
            wallet,
            action,
            amount,
            impact
        });
    }
}

// Start simulation if backend is not available
setInterval(simulateTrading, 3000);

// Error handling for failed API calls
window.addEventListener('unhandledrejection', function(event) {
    console.warn('API call failed, using demo data:', event.reason);
    event.preventDefault();
});

console.log('🤖 Quantum Degen AI Dashboard Loaded Successfully!');