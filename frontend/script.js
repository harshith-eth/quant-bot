function simulateTrading() {
    const balance = parseFloat(document.getElementById('current-balance').textContent);
    const targetBalance = 500;
    const progress = (balance / targetBalance) * 100;
    
    const progressBar = document.querySelector('.header-progress-fill');
    if (progressBar) {
        progressBar.style.width = Math.min(progress, 100) + '%';
    }
    
    if (Math.random() > 0.7) {
        const priceChange = (Math.random() * 20) - 5;
        const newBalance = balance * (1 + (priceChange / 100));
        document.getElementById('current-balance').textContent = newBalance.toFixed(2);
        
        const balanceElement = document.getElementById('current-balance');
        balanceElement.className = priceChange > 0 ? 'profit-target' : 'loss-warning';
        setTimeout(() => balanceElement.className = '', 1000);
    }
}

// Meme Scanner Functions
function updateMemeScanner() {
    // Update token stats
    document.getElementById('new-tokens-hour').textContent = Math.floor(Math.random() * 10) + 15;
    document.getElementById('verified-percent').textContent = Math.floor(Math.random() * 15) + 70;
    
    // Update market stats
    document.getElementById('avg-mc').textContent = (Math.floor(Math.random() * 100) + 150) + 'K';
    document.getElementById('avg-volume').textContent = (Math.floor(Math.random() * 150) + 150) + 'K';
    
    // Generate new opportunities
    const opportunities = generateOpportunities();
    updateOpportunityList(opportunities);
}

function generateOpportunities() {
    const tokenNames = ['$PEPE2', '$WOJAK', '$FOMO', '$MOON', '$DOGE2', '$SHIB2', '$CHAD'];
    const opportunities = [];
    
    for (let i = 0; i < 3; i++) {
        opportunities.push({
            name: tokenNames[Math.floor(Math.random() * tokenNames.length)],
            age: Math.floor(Math.random() * 14) + 1,
            mc: Math.floor(Math.random() * 150000 + 50000),
            liq: Math.floor(Math.random() * 45000 + 5000),
            buyToSell: (Math.random() * 6 + 4).toFixed(1),
            isHot: i === 0
        });
    }
    
    return opportunities;
}

function updateOpportunityList(opportunities) {
    const list = document.getElementById('opportunity-list');
    list.innerHTML = '';
    
    opportunities.forEach(opp => {
        const item = document.createElement('div');
        item.className = `opportunity-item${opp.isHot ? ' hot' : ''}`;
        
        item.innerHTML = `
            <div class="token-info">
                <span class="token-name">${opp.name}</span>
                <span class="token-age">Age: ${opp.age}m</span>
                <span class="token-mc">MC: $${(opp.mc/1000).toFixed(0)}K</span>
            </div>
            <div class="token-metrics">
                <span class="metric">Liq: $${(opp.liq/1000).toFixed(0)}K</span>
                <span class="metric">B/S: ${opp.buyToSell}:1</span>
                <span class="safety-check">✓ SAFU</span>
            </div>
        `;
        
        list.appendChild(item);
    });
}

// Function to load card contents
async function loadCardContents() {
    const cards = [
        'meme-scanner',
        'active-positions',
        'portfolio-status',
        'signal-feed',
        'whale-activity',
        'market-analysis',
        'risk-management',
        'ai-analysis'
    ];

    for (const card of cards) {
        try {
            const response = await fetch(`./card-${card}.html`);
            const content = await response.text();
            document.getElementById(card).innerHTML = content;
        } catch (error) {
            console.error(`Error loading ${card}:`, error);
        }
    }
}

// Load card contents when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadCardContents();
    // Start simulation after cards are loaded
    setInterval(simulateTrading, 2000);
});