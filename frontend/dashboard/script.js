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
        case 'portfolio_status':
            updatePortfolioStatusCard(data.data);
            break;
        case 'active_positions':
            updateActivePositionsCard(data.data);
            break;
        case 'whale_activity':
            updateWhaleActivityCard(data.data);
            break;
        case 'market_analysis':
            updateMarketAnalysisCard(data.data);
            break;
        case 'ai_analysis':
            updateAIAnalysisCard(data.data);
            break;
        case 'meme_scanner':
            updateMemeScannerCard(data.data);
            break;
        case 'signal_feed':
            updateSignalFeedCard(data.data);
            break;
        case 'risk_management':
            updateRiskManagementCard(data.data);
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
                
                // Evaluate scripts within the loaded content
                const scripts = cardElement.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    Array.from(script.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    newScript.textContent = script.textContent;
                    script.parentNode.replaceChild(newScript, script);
                });
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
        // Convert card-name to api-name format (e.g., active-positions to /api/active-positions)
        const apiEndpoint = `/api/${cardName}`;
        console.log(`Fetching data from: ${apiEndpoint}`);
        
        const response = await fetch(apiEndpoint);
        if (response.ok) {
            const data = await response.json();
            console.log(`Data received for ${cardName}:`, data);
            updateCardWithData(cardName, data);
        } else {
            console.warn(`Backend error for ${cardName}: ${response.status} ${response.statusText}`);
            generateDemoData(cardName);
        }
    } catch (error) {
        console.warn(`Failed to fetch ${cardName} data:`, error);
        generateDemoData(cardName);
    }
}

// Implement specific fetch functions for each card as requested
async function fetchActivePositions() {
    try {
        const response = await fetch('/api/active-positions');
        const data = await response.json();
        updateActivePositionsCard(data);
    } catch (error) {
        console.error('Failed to fetch active positions:', error);
        showErrorInCard('active-positions-card', 'Failed to load positions');
    }
}

async function fetchAIAnalysis() {
    try {
        const response = await fetch('/api/ai-analysis');
        const data = await response.json();
        updateAIAnalysisCard(data);
    } catch (error) {
        console.error('Failed to fetch AI analysis:', error);
        showErrorInCard('ai-analysis-card', 'Failed to load AI analysis');
    }
}

async function fetchMarketAnalysis() {
    try {
        const response = await fetch('/api/market-analysis');
        const data = await response.json();
        updateMarketAnalysisCard(data);
    } catch (error) {
        console.error('Failed to fetch market analysis:', error);
        showErrorInCard('market-analysis-card', 'Failed to load market data');
    }
}

async function fetchMemeScanner() {
    try {
        const response = await fetch('/api/meme-scanner');
        const data = await response.json();
        updateMemeScannerCard(data);
    } catch (error) {
        console.error('Failed to fetch meme scanner data:', error);
        showErrorInCard('meme-scanner-card', 'Failed to load token data');
    }
}

async function fetchPortfolioStatus() {
    try {
        const response = await fetch('/api/portfolio-status');
        const data = await response.json();
        updatePortfolioStatusCard(data);
    } catch (error) {
        console.error('Failed to fetch portfolio status:', error);
        showErrorInCard('portfolio-status-card', 'Failed to load portfolio data');
    }
}

async function fetchRiskManagement() {
    try {
        const response = await fetch('/api/risk-management');
        const data = await response.json();
        updateRiskManagementCard(data);
    } catch (error) {
        console.error('Failed to fetch risk management data:', error);
        showErrorInCard('risk-management-card', 'Failed to load risk data');
    }
}

async function fetchSignalFeed() {
    try {
        const response = await fetch('/api/signal-feed');
        const data = await response.json();
        updateSignalFeedCard(data);
    } catch (error) {
        console.error('Failed to fetch signal feed:', error);
        showErrorInCard('signal-feed-card', 'Failed to load signals');
    }
}

async function fetchWhaleActivity() {
    try {
        const response = await fetch('/api/whale-activity');
        const data = await response.json();
        updateWhaleActivityCard(data);
    } catch (error) {
        console.error('Failed to fetch whale activity:', error);
        showErrorInCard('whale-activity-card', 'Failed to load whale data');
    }
}

// Helper function to show error in a card
function showErrorInCard(cardId, errorMessage) {
    const cardElement = document.getElementById(cardId);
    if (cardElement) {
        cardElement.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    }
}

// Update card with real data from backend
function updateCardWithData(cardName, data) {
    console.log(`Updating ${cardName} with data:`, data);
    switch(cardName) {
        case 'portfolio-status':
            updatePortfolioStatusCard(data);
            break;
        case 'active-positions':
            updateActivePositionsCard(data);
            break;
        case 'whale-activity':
            updateWhaleActivityCard(data);
            break;
        case 'meme-scanner':
            updateMemeScannerCard(data);
            break;
        case 'signal-feed':
            updateSignalFeedCard(data);
            break;
        case 'market-analysis':
            updateMarketAnalysisCard(data);
            break;
        case 'ai-analysis':
            updateAIAnalysisCard(data);
            break;
        case 'risk-management':
            updateRiskManagementCard(data);
            break;
        default:
            console.warn(`No update function for card: ${cardName}`);
    }
}

// Update active positions card with data from the API
function updateActivePositionsCard(data) {
    console.log('Updating active positions with data:', data);
    const positionsContainer = document.getElementById('active-trades');
    const positionCount = document.getElementById('position-count');
    
    // Check if we have the container and positions data
    if (!positionsContainer) {
        console.warn('Active trades container not found');
        return;
    }
    
    if (!data || !data.positions || !Array.isArray(data.positions)) {
        console.warn('No positions data or invalid format');
        positionsContainer.innerHTML = `
            <div class="trade-item" style="text-align: center; color: #888; padding: 40px;">
                🎯 NO ACTIVE POSITIONS<br>
                <span style="font-size: 0.9em;">AI SCANNING FOR OPPORTUNITIES...</span>
            </div>
        `;
        return;
    }
    
    // Update position count if available
    if (positionCount) {
        positionCount.textContent = `${data.positions.length}/5`;
    }
    
    // Clear the container
    positionsContainer.innerHTML = '';
    
    // If we have positions, add them to the container
    if (data.positions.length > 0) {
        data.positions.forEach(position => {
            const positionElement = document.createElement('div');
            positionElement.className = 'trade-item active-trade';
            
            // Determine the profit class
            const pnl = position.pnl || 0;
            const profitClass = pnl >= 0 ? 'profit' : 'loss';
            const pnlPercent = pnl >= 0 ? `+${pnl}%` : `${pnl}%`;
            
            // Format timestamps
            const timestamp = new Date(position.timestamp);
            const now = new Date();
            const minutesDiff = Math.floor((now - timestamp) / (60 * 1000));
            const timeElapsed = `${minutesDiff}m`;
            
            positionElement.innerHTML = `
                <div class="token-cell"><span class="token-name">${position.symbol}</span></div>
                <div class="mc-cell">-</div>
                <div class="entry-cell">$${position.entry_price.toFixed(6)}</div>
                <div class="size-cell">${position.size} SOL</div>
                <div class="${profitClass} pl-cell">${pnlPercent}</div>
                <div class="time-cell"><span class="time-elapsed" style="font-size: 1.24vh;">${timeElapsed}</span></div>
                <div class="action-cell" style="text-align: left; display: flex; justify-content: flex-start; padding-left: 0;">
                    <button class="action-btn" style="background: rgba(0,150,136,0.2); border: 1px solid #009688; color: #00e676; padding: 0.3vh 1vh; cursor: pointer; font-size: 1.24vh; text-shadow: 0 0 3px rgba(0,230,118,0.5);">
                        MON
                    </button>
                </div>
            `;
            
            positionsContainer.appendChild(positionElement);
        });
    } else {
        // Show empty state
        positionsContainer.innerHTML = `
            <div class="trade-item" style="text-align: center; color: #888; padding: 40px;">
                🎯 NO ACTIVE POSITIONS<br>
                <span style="font-size: 0.9em;">AI SCANNING FOR OPPORTUNITIES...</span>
            </div>
        `;
    }
}

// Update AI analysis card with data from the API
function updateAIAnalysisCard(data) {
    console.log('Updating AI analysis with data:', data);
    if (!data || !data.analysis) {
        console.warn('No AI analysis data received');
        return;
    }
    
    const analysis = data.analysis;
    
    // Update AI stats in the header
    const aiStats = document.getElementById('ai-stats');
    if (aiStats) {
        aiStats.textContent = `SENT: ${analysis.sentiment} | CONF: ${(analysis.confidence * 100).toFixed(0)}%`;
    }
    
    // Update the AI analysis content container
    const contentContainer = document.getElementById('ai-analysis-content');
    if (contentContainer) {
        contentContainer.innerHTML = `
            <!-- Market Sentiment -->
            <div class="analysis-section">
                <div class="section-title">
                    🧠 NEURAL MARKET ANALYSIS
                </div>
                <div class="section-content">
                    <div class="consensus-matrix">
                        <div class="consensus-strength">
                            <span>SENTIMENT: <span class="${getSentimentClass(analysis.sentiment)}">${analysis.sentiment || 'ANALYZING'}</span></span>
                            <div class="strength-bar">
                                <div class="fill" style="width: ${analysis.confidence * 100}%"></div>
                            </div>
                        </div>
                        <div class="key-levels">
                            <div class="level-item">
                                <span>SIGNALS</span>
                                <span class="value">${analysis.technical_signals ? analysis.technical_signals.length : 0}</span>
                            </div>
                            <div class="level-item">
                                <span>CONFIDENCE</span>
                                <span class="value">${(analysis.confidence * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI Predictions -->
            <div class="analysis-section">
                <div class="section-title">
                    🎯 AI PREDICTIONS
                </div>
                <div class="section-content">
                    <div class="quantum-matrix">
                        ${analysis.predictions && analysis.predictions.length > 0 ? 
                            analysis.predictions.map(prediction => `
                                <div class="matrix-row">
                                    <span class="time">${prediction.timeframe.toUpperCase()}</span>
                                    <span class="prediction">${prediction.prediction}</span>
                                </div>
                            `).join('') :
                            `<div class="matrix-row">
                                <span class="time">PROCESSING</span>
                                <span class="prediction">ANALYZING MARKET DATA</span>
                            </div>`
                        }
                    </div>
                </div>
            </div>

            <!-- AI Signals -->
            <div class="analysis-section">
                <div class="section-title">
                    📡 NEURAL SIGNALS
                </div>
                <div class="section-content">
                    <div class="signal-list">
                        ${analysis.technical_signals && analysis.technical_signals.length > 0 ? 
                            analysis.technical_signals.map(signal => `
                                <div class="signal-item">
                                    <span class="signal-type">${signal.type}</span>
                                    <span class="signal-value ${signal.direction.toLowerCase()}">${signal.direction}</span>
                                    <span style="font-size: 0.8em; color: #888;">Strength: ${(signal.strength * 100).toFixed(0)}%</span>
                                </div>
                            `).join('') :
                            '<div style="text-align: center; color: #888;">🤖 SCANNING FOR SIGNALS...</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }
}

// Helper function to determine sentiment class based on sentiment value
function getSentimentClass(sentiment) {
    if (!sentiment) return 'neutral';
    
    const sent = sentiment.toLowerCase();
    if (sent.includes('bull') || sent.includes('positive')) return 'positive';
    if (sent.includes('bear') || sent.includes('negative')) return 'negative';
    return 'neutral';
}

// Update market analysis card with data from the API
function updateMarketAnalysisCard(data) {
    console.log('Updating market analysis with data:', data);
    if (!data || !data.market) {
        console.warn('No market analysis data received');
        return;
    }
    
    const market = data.market;
    
    // Update market stats in the header
    const marketStats = document.getElementById('market-stats');
    if (marketStats) {
        marketStats.textContent = `VOL: $${market.volume.toLocaleString()} | TREND: ${market.trend}`;
    }
    
    // Display market data
    const analysisContent = document.getElementById('market-analysis-content');
    if (analysisContent) {
        analysisContent.innerHTML = `
            <div class="analysis-section">
                <div class="section-title">
                    📊 MARKET OVERVIEW
                </div>
                <div class="section-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5vh;">
                        <div>Price: <span class="value">$${market.price.toFixed(6)}</span></div>
                        <div>Volume: <span class="value">$${market.volume.toLocaleString()}</span></div>
                        <div>Trend: <span class="value">${market.trend}</span></div>
                        <div>Volatility: <span class="value">${market.volatility.toFixed(1)}</span></div>
                    </div>
                </div>
            </div>
            
            <div class="analysis-section">
                <div class="section-title">
                    📈 KEY LEVELS
                </div>
                <div class="section-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5vh;">
                        <div>
                            <div class="section-subtitle">SUPPORT:</div>
                            <div class="level-list">
                                ${market.support_levels.map(level => `
                                    <div class="level-item">$${level.toFixed(6)}</div>
                                `).join('')}
                            </div>
                        </div>
                        <div>
                            <div class="section-subtitle">RESISTANCE:</div>
                            <div class="level-list">
                                ${market.resistance_levels.map(level => `
                                    <div class="level-item">$${level.toFixed(6)}</div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Update meme scanner card with data from the API
function updateMemeScannerCard(data) {
    console.log('Updating meme scanner with data:', data);
    if (!data || !data.tokens) {
        console.warn('No meme scanner data received');
        return;
    }
    
    const tokens = data.tokens;
    
    // Get container elements
    const liveTokensContainer = document.getElementById('live-tokens');
    
    if (!liveTokensContainer) {
        console.warn('Meme scanner container not found');
        return;
    }
    
    // Update live tokens list
    liveTokensContainer.innerHTML = '';
    
    if (tokens.length > 0) {
        tokens.forEach(token => {
            const tokenElement = document.createElement('div');
            tokenElement.className = 'token-item';
            
            // Determine risk class
            const riskClass = token.risk_level;
            
            tokenElement.innerHTML = `
                <div class="token-symbol">${token.symbol}</div>
                <div class="token-address">${token.address.substring(0, 8)}...${token.address.substring(token.address.length - 4)}</div>
                <div class="token-price">$${token.price.toFixed(8)}</div>
                <div class="token-volume">$${token.volume.toLocaleString()}</div>
                <div class="token-score ${riskClass}">${token.risk_level.toUpperCase()}</div>
            `;
            
            liveTokensContainer.appendChild(tokenElement);
        });
    } else {
        liveTokensContainer.innerHTML = `
            <div style="text-align: center; color: #888; padding: 10px;">
                No tokens currently being monitored
            </div>
        `;
    }
}

// Update portfolio status card with data from the API
function updatePortfolioStatusCard(data) {
    if (!data || !data.portfolio) {
        console.warn('No portfolio data received');
        return;
    }
    
    console.log('Updating portfolio status with data:', data);
    
    const portfolio = data.portfolio;
    
    // Extract data from the portfolio data object
    // Handle both string and number formats
    const currentBalance = document.getElementById('current-balance');
    const gainNeeded = document.getElementById('gain-needed');
    const availableBalance = document.getElementById('available-balance');
    const allocatedBalance = document.getElementById('allocated-balance');
    const dailyPL = document.getElementById('daily-pl');
    const totalROI = document.getElementById('total-roi');
    
    // Update the progress bar if present
    const progressFill = document.querySelector('.header-progress-fill');
    if (progressFill) {
        const progressPercentage = (portfolio.total_value / 20000) * 100; // Using 20000 as target
        progressFill.style.width = `${progressPercentage}%`;
    }
    
    // Calculate gain needed to reach target
    const targetBalance = 20000;
    const gainNeededPercent = ((targetBalance - portfolio.total_value) / portfolio.total_value) * 100;
    
    // Update all the elements if they exist
    if (currentBalance) currentBalance.textContent = `$${portfolio.total_value.toFixed(2)}`;
    if (gainNeeded) gainNeeded.textContent = `${gainNeededPercent.toFixed(2)}%`;
    
    // Calculate allocated and available balance
    let allocatedValue = 0;
    if (portfolio.assets && Array.isArray(portfolio.assets)) {
        allocatedValue = portfolio.assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
    }
    const availableValue = portfolio.total_value - allocatedValue;
    
    if (availableBalance) availableBalance.textContent = `$${availableValue.toFixed(2)}`;
    if (allocatedBalance) allocatedBalance.textContent = `$${allocatedValue.toFixed(2)}`;
    
    // Performance metrics
    if (dailyPL) dailyPL.textContent = `${portfolio.performance.daily.toFixed(2)}%`;
    if (totalROI) totalROI.textContent = `${portfolio.performance.monthly.toFixed(2)}%`;
}

// Update risk management card with data from the API
function updateRiskManagementCard(data) {
    console.log('Updating risk management with data:', data);
    if (!data || !data.risk) {
        console.warn('No risk management data received');
        return;
    }
    
    const risk = data.risk;
    
    // Update risk header
    const riskHeader = document.querySelector('.risk-management-container h2 span');
    if (riskHeader) {
        riskHeader.textContent = `RISK: ${(risk.risk_score * 10).toFixed(1)}`;
    }
    
    // Update risk management content
    const riskContent = document.querySelector('.risk-content .analysis-container');
    if (riskContent) {
        // Create position limits section
        const limitsHTML = `
            <div class="analysis-section">
                <div class="section-title">
                    🛡️ POSITION LIMITS
                </div>
                <div class="section-content">
                    <div class="risk-indicators">
                        <div class="risk-indicator">
                            <span class="label">MAX POSITION SIZE</span>
                            <span class="risk-value">${risk.position_limits.max_position_size} SOL</span>
                        </div>
                        <div class="risk-indicator">
                            <span class="label">MAX TOKEN EXPOSURE</span>
                            <span class="risk-value">${risk.position_limits.max_token_exposure * 100}%</span>
                        </div>
                        <div class="risk-indicator">
                            <span class="label">MAX PORTFOLIO RISK</span>
                            <span class="risk-value">${risk.position_limits.max_portfolio_risk * 100}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create stop loss section if we have stop losses
        let stopLossHTML = '';
        if (risk.stop_losses && risk.stop_losses.length > 0) {
            stopLossHTML = `
                <div class="analysis-section">
                    <div class="section-title">
                        🔴 STOP LOSSES
                    </div>
                    <div class="section-content">
                        <div class="risk-stop-loss-table">
                            ${risk.stop_losses.map(sl => `
                                <div class="stop-loss-item">
                                    <div class="sl-symbol">${sl.symbol}</div>
                                    <div class="sl-entry">$${sl.entry_price.toFixed(6)}</div>
                                    <div class="sl-current">$${sl.current_price.toFixed(6)}</div>
                                    <div class="sl-level">$${sl.stop_loss.toFixed(6)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Update the content
        riskContent.innerHTML = limitsHTML + stopLossHTML;
    }
}

// Update signal feed card with data from the API
function updateSignalFeedCard(data) {
    console.log('Updating signal feed with data:', data);
    if (!data || !data.signals) {
        console.warn('No signal feed data or invalid format');
        return;
    }
    
    const signals = data.signals;
    
    // Get all signal category containers
    const signalFeed = document.getElementById('signal-feed-container');
    
    if (!signalFeed) {
        console.warn('Signal feed container not found');
        return;
    }
    
    // Clear the container
    signalFeed.innerHTML = '';
    
    // Add each signal
    if (signals.length > 0) {
        signals.forEach(signal => {
            const signalElement = document.createElement('div');
            signalElement.className = 'signal-entry';
            
            // Format timestamp
            const timestamp = new Date(signal.timestamp);
            const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Format signal type class
            const actionClass = signal.action.toLowerCase().includes('buy') ? 'buy' : 
                                signal.action.toLowerCase().includes('sell') ? 'sell' : 'normal';
            
            signalElement.innerHTML = `
                [<span class="timestamp">${formattedTime}</span>] » 
                <span class="signal-${actionClass}">${signal.symbol} ${signal.action}</span>
                <br>• Strength: ${(signal.strength * 100).toFixed(0)}%
                <br>• Source: ${signal.type}
            `;
            
            signalFeed.appendChild(signalElement);
        });
    } else {
        signalFeed.innerHTML = `
            <div class="signal-entry" style="text-align: center; color: #888;">
                No active signals detected
            </div>
        `;
    }
}

// Update whale activity card with data from the API
function updateWhaleActivityCard(data) {
    console.log('Updating whale activity with data:', data);
    const whaleFeed = document.getElementById('whale-feed');
    const buyPressure = document.getElementById('whale-buy-pressure');
    const sellPressure = document.getElementById('whale-sell-pressure');
    const buyPressureFill = document.getElementById('buy-pressure-fill');
    const sellPressureFill = document.getElementById('sell-pressure-fill');
    
    if (!whaleFeed) {
        console.warn('Whale feed container not found');
        return;
    }
    
    if (!data || !data.whales || !Array.isArray(data.whales)) {
        console.warn('No whale activity data or invalid format');
        whaleFeed.innerHTML = `
            <div class="whale-item" style="text-align: center; color: #888; padding: 20px;">
                No recent whale activity detected
            </div>
        `;
        return;
    }
    
    // Clear container
    whaleFeed.innerHTML = '';
    
    // Add all whale activities
    data.whales.forEach(activity => {
        const whaleElement = document.createElement('div');
        const actionClass = activity.transaction.toLowerCase().includes('buy') ? 'buy' : 
                            activity.transaction.toLowerCase().includes('sell') ? 'sell' : 'neutral';
        
        whaleElement.className = `whale-item ${actionClass}`;
        
        // Calculate impact class based on amount
        let impactClass = 'low';
        if (activity.amount > 5000) impactClass = 'critical';
        else if (activity.amount > 2000) impactClass = 'high';
        else if (activity.amount > 1000) impactClass = 'medium';
        
        // Format amount with commas
        const formattedAmount = `${activity.amount.toLocaleString()} ${activity.token}`;
        
        whaleElement.innerHTML = `
            <div class="col wallet">${activity.wallet || '-'}</div>
            <div class="col action">${activity.transaction || '-'}</div>
            <div class="col amount">${formattedAmount || '-'}</div>
            <div class="col impact ${impactClass}">${impactClass.toUpperCase()}</div>
        `;
        
        whaleFeed.appendChild(whaleElement);
    });
    
    // If no activities were added, show empty state
    if (whaleFeed.children.length === 0) {
        whaleFeed.innerHTML = `
            <div class="whale-item" style="text-align: center; color: #888; padding: 20px;">
                No recent whale activity detected
            </div>
        `;
    }
    
    // Set default pressure values
    const buyPercent = '60%';
    const sellPercent = '40%';
    
    // Update pressure indicators
    if (buyPressure) buyPressure.textContent = buyPercent;
    if (sellPressure) sellPressure.textContent = sellPercent;
    
    if (buyPressureFill) buyPressureFill.style.width = buyPercent;
    if (sellPressureFill) sellPressureFill.style.width = sellPercent;
}

// Generate demo data when backend is not available
function generateDemoData(cardName) {
    const demoData = {
        'portfolio-status': {
            portfolio: {
                total_value: 25.00,
                assets: [
                    { symbol: "SOL", amount: 0.2, value: 25.00 }
                ],
                performance: {
                    daily: 0.00,
                    weekly: 0.00,
                    monthly: 0.00
                }
            }
        },
        'active-positions': {
            positions: [
                { symbol: '$MOON', entry_price: 0.000021, size: 0.2, pnl: 8.5, timestamp: new Date().toISOString() }
            ]
        },
        'whale-activity': {
            whales: [
                { wallet: '0x7a2...3f9b', transaction: 'Buy', amount: 1250, token: 'SOL', timestamp: new Date().toISOString() }
            ]
        },
        'meme-scanner': {
            tokens: [
                { symbol: '$DOGE2', address: '93HfSHvLGRvXb1WuGDc96dNkbP8jupR3GDowGj5nVQcL', price: 0.000012, volume: 45000, social_score: 8.5, risk_level: 'low' }
            ]
        },
        'market-analysis': {
            market: {
                price: 0.000045,
                volume: 1250000,
                volatility: 65.3,
                trend: 'BULLISH',
                support_levels: [0.000041, 0.000039, 0.000036],
                resistance_levels: [0.000047, 0.000049, 0.000052]
            }
        },
        'ai-analysis': {
            analysis: {
                sentiment: 'BULLISH',
                technical_signals: [
                    { type: 'TREND', direction: 'BULLISH', strength: 0.85 }
                ],
                predictions: [
                    { timeframe: 'short_term', prediction: 'UPWARD MOMENTUM' }
                ],
                confidence: 0.82
            }
        },
        'risk-management': {
            risk: {
                portfolio_risk: 0.35,
                position_limits: {
                    max_position_size: 5.0,
                    max_token_exposure: 0.20,
                    max_portfolio_risk: 0.35
                },
                stop_losses: [
                    { symbol: '$SOL', entry_price: 125.00, current_price: 150.00, stop_loss: 110.00 }
                ],
                risk_score: 0.65
            }
        },
        'signal-feed': {
            signals: [
                { type: 'MOMENTUM', symbol: '$MOON', action: 'BUY', strength: 0.85, timestamp: new Date().toISOString() }
            ]
        }
    };
    
    if (demoData[cardName]) {
        updateCardWithData(cardName, demoData[cardName]);
    }
}

// Start periodic updates
function startPeriodicUpdates() {
    // Update every 5 seconds
    setInterval(() => {
        if (!isConnected) {
            // If WebSocket is not connected, fetch data via HTTP
            fetchPortfolioStatus();
            fetchActivePositions();
            fetchWhaleActivity();
            fetchMemeScanner();
            fetchAIAnalysis();
            fetchMarketAnalysis();
            fetchSignalFeed();
            fetchRiskManagement();
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

// Helper function to determine button class
function getButtonClass(action) {
    if (!action) return '';
    
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('TP')) return 'tp-btn';
    if (actionUpper.includes('SL')) return 'sl-btn';
    return '';
}

// Helper function to determine button background
function getButtonBackground(action) {
    if (!action) return 'rgba(0,150,136,0.2)';
    
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('TP')) return 'rgba(0,230,118,0.3)';
    if (actionUpper.includes('SL')) return 'rgba(244,67,54,0.3)';
    return 'rgba(0,150,136,0.2)';
}

// Helper function to determine button border
function getButtonBorder(action) {
    if (!action) return '#009688';
    
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('TP')) return '#00e676';
    if (actionUpper.includes('SL')) return '#f44336';
    return '#009688';
}

// Helper function to determine button color
function getButtonColor(action) {
    if (!action) return '#00e676';
    
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('TP')) return '#00e676';
    if (actionUpper.includes('SL')) return '#f44336';
    return '#00e676';
}

// Helper function to determine button shadow
function getButtonShadow(action) {
    if (!action) return 'rgba(0,230,118,0.5)';
    
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('TP')) return 'rgba(0,230,118,0.5)';
    if (actionUpper.includes('SL')) return 'rgba(244,67,54,0.5)';
    return 'rgba(0,230,118,0.5)';
}

console.log('🤖 Quantum Degen AI Dashboard Loaded Successfully!');