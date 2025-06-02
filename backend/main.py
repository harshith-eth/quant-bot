#!/usr/bin/env python3
"""
🚀 QUANTUM DEGEN TRADING AI SWARM - MAIN SERVER
Advanced Multi-Agent Trading System Backend
"""

import asyncio
import json
import time
import httpx
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Import our AI agents
from core.ai_swarm_orchestrator import AISwarmOrchestrator
from core.websocket_manager import WebSocketManager
from core.config import settings

# Import real data modules
from active_positions.position_manager import PositionManager, RealPositionManager
from ai_analysis.neural_analyzer import NeuralAnalyzer
from market_analysis.market_intelligence import MarketIntelligence
from meme_scanner.token_hunter import TokenHunter
from portfolio_status.portfolio_tracker import PortfolioTracker
from risk_management.risk_engine import RiskEngine
from signal_feed.signal_aggregator import SignalAggregator
from whale_activity.whale_tracker import WhaleTracker

# Import REAL trading components
from trading.jupiter_trader import RealJupiterTrader

# Global variables
ai_swarm: Optional[AISwarmOrchestrator] = None
websocket_manager = WebSocketManager()

# Initialize AI agents
position_manager = PositionManager()
neural_analyzer = NeuralAnalyzer()
market_intelligence = MarketIntelligence()
token_hunter = TokenHunter()
portfolio_tracker = PortfolioTracker()
risk_engine = RiskEngine()
signal_aggregator = SignalAggregator()
whale_tracker = WhaleTracker()

# HTTP client for API calls
http_client = httpx.AsyncClient()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global ai_swarm
    
    print("🚀 Starting Quantum Degen Trading AI Swarm...")
    
    # Initialize AI Swarm with real agents
    try:
        agents = {
            'position_manager': position_manager,
            'neural_analyzer': neural_analyzer,
            'market_intelligence': market_intelligence,
            'token_hunter': token_hunter,
            'portfolio_tracker': portfolio_tracker,
            'risk_engine': risk_engine,
            'signal_aggregator': signal_aggregator,
            'whale_tracker': whale_tracker
        }
        
        ai_swarm = AISwarmOrchestrator(**agents)
        await ai_swarm.initialize()
        print("✅ AI Swarm initialized successfully")
        
        # Start background tasks for real data
        asyncio.create_task(real_data_monitor())
        asyncio.create_task(broadcast_updates())
        
    except Exception as e:
        print(f"❌ Failed to initialize AI Swarm: {e}")
        ai_swarm = None
    
    yield
    
    # Cleanup
    if ai_swarm:
        await ai_swarm.shutdown()
    await http_client.aclose()
    print("🛑 AI Swarm shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Quantum Degen Trading AI Swarm",
    description="Advanced Multi-Agent Trading System",
    version="2.4.7",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "🤖 Quantum Degen Trading AI Swarm v2.4.7",
        "status": "ONLINE",
        "agents": 8,
        "uptime": "24/7"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "ai_swarm": "online" if ai_swarm else "offline",
        "timestamp": datetime.now().isoformat(),
        "version": "2.4.7"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

@app.get("/api/portfolio-status")
async def get_portfolio_status():
    """Get current portfolio status"""
    data = await portfolio_tracker.get_status()
    return JSONResponse(content=data)

@app.get("/api/active-positions")
async def get_active_positions():
    """Get active trading positions"""
    data = await position_manager.get_active_positions()
    return JSONResponse(content=data)

@app.get("/api/whale-activity")
async def get_whale_activity():
    """Get whale movement data"""
    data = await whale_tracker.get_activity()
    return JSONResponse(content=data)

@app.get("/api/meme-scanner")
async def get_meme_scanner():
    """Get meme token scanner data"""
    data = await token_hunter.get_scanner_data()
    return JSONResponse(content=data)

@app.get("/api/signal-feed")
async def get_signal_feed():
    """Get trading signals"""
    data = await signal_aggregator.get_signals()
    return JSONResponse(content=data)

@app.get("/api/market-analysis")
async def get_market_analysis():
    """Get market analysis data"""
    data = await market_intelligence.get_analysis()
    return JSONResponse(content=data)

@app.get("/api/ai-analysis")
async def get_ai_analysis():
    """Get AI analysis data"""
    data = await neural_analyzer.get_analysis()
    return JSONResponse(content=data)

@app.get("/api/risk-management")
async def get_risk_management():
    """Get risk management data"""
    data = await risk_engine.get_risk_analysis()
    return JSONResponse(content=data)

@app.post("/api/execute-trade")
async def execute_trade(trade_data: dict):
    """Execute a real trade"""
    try:
        result = await ai_swarm.execute_trade(trade_data)
        
        # Broadcast update to connected clients
        if result.get("success"):
            await websocket_manager.broadcast_to_all({
                "type": "trade_executed",
                "data": result
            })
        
        return result
    except Exception as e:
        return {"error": str(e), "success": False}

@app.post("/api/update-position")
async def update_position(position_data: dict):
    """Update a trading position"""
    try:
        result = await ai_swarm.update_position(position_data)
        
        # Broadcast update
        if result.get("success"):
            await websocket_manager.broadcast_to_all({
                "type": "position_updated",
                "data": result
            })
        
        return result
    except Exception as e:
        return {"error": str(e), "success": False}

# Background task to monitor real data
async def real_data_monitor():
    """Monitor real market data and update systems"""
    print("🔄 Starting real data monitoring...")
    
    while True:
        try:
            # Run AI swarm processing
            if ai_swarm and ai_swarm.is_running:
                await ai_swarm.run_swarm()
            
            await asyncio.sleep(settings.PRICE_UPDATE_INTERVAL)
            
        except Exception as e:
            print(f"Error in real data monitoring: {e}")
            await asyncio.sleep(10)

# Background task to broadcast updates
async def broadcast_updates():
    """Broadcast real-time updates to connected WebSocket clients"""
    while True:
        try:
            # Broadcast portfolio update
            portfolio_data = await portfolio_tracker.get_status()
            await websocket_manager.broadcast_to_all({
                "type": "portfolio_update",
                "data": portfolio_data
            })
            
            # Broadcast latest signals
            signal_data = await signal_aggregator.get_signals()
            if signal_data.get("live_signals"):
                await websocket_manager.broadcast_to_all({
                    "type": "signal_update",
                    "data": signal_data["live_signals"][:5]  # Latest 5 signals
                })
            
            # Broadcast whale activity
            whale_data = await whale_tracker.get_activity()
            if whale_data.get("recent_activity"):
                await websocket_manager.broadcast_to_all({
                    "type": "whale_update",
                    "data": whale_data["recent_activity"][:3]  # Latest 3 activities
                })
            
            await asyncio.sleep(5)  # Broadcast every 5 seconds
            
        except Exception as e:
            print(f"Error in broadcast: {e}")
            await asyncio.sleep(10)

async def fetch_solana_price():
    """Fetch current Solana price from CoinGecko"""
    try:
        response = await http_client.get(
            f"{settings.COINGECKO_API_URL}/simple/price?ids=solana&vs_currencies=usd"
        )
        data = response.json()
        return data.get("solana", {}).get("usd", 150.0)  # Default fallback
    except Exception as e:
        print(f"Error fetching SOL price: {e}")
        return 150.0  # Fallback price

async def fetch_dex_tokens():
    """Fetch trending tokens from DexScreener"""
    try:
        response = await http_client.get(
            f"{settings.DEXSCREENER_API_URL}/dex/tokens/trending"
        )
        return response.json()
    except Exception as e:
        print(f"Error fetching DEX tokens: {e}")
        return []

async def fetch_whale_transactions():
    """Fetch large SOL transactions"""
    try:
        # This would use Solana RPC to get recent large transactions
        # For now, this is a placeholder for real implementation
        response = await http_client.post(
            settings.SOLANA_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getRecentBlockhash"
            }
        )
        # Process real whale data here
        return []
    except Exception as e:
        print(f"Error fetching whale transactions: {e}")
        return []

async def initialize_real_trading_system():
    """Initialize the REAL trading system"""
    logger.info("🚀 INITIALIZING REAL TRADING SYSTEM...")
    
    # Initialize REAL components
    position_manager = RealPositionManager()
    trader = RealJupiterTrader()
    
    # Initialize AI Swarm with REAL trading
    orchestrator = AISwarmOrchestrator(
        position_manager=position_manager,
        meme_scanner=meme_scanner,
        market_intelligence=market_intelligence,
        neural_analyzer=neural_analyzer,
        portfolio_tracker=portfolio_tracker,
        risk_engine=risk_engine,
        signal_aggregator=signal_aggregator,
        whale_tracker=whale_tracker
    )
    
    await orchestrator.initialize()
    
    logger.info("✅ REAL TRADING SYSTEM ONLINE")
    return orchestrator

# Replace the old initialization
@app.on_event("startup")
async def startup_event():
    """Initialize all systems on startup"""
    logger.info("🚀 STARTING QUANT BOT WITH REAL TRADING...")
    
    try:
        # Initialize REAL trading system
        global ai_orchestrator
        ai_orchestrator = await initialize_real_trading_system()
        
        logger.info("✅ QUANT BOT ONLINE - READY FOR REAL TRADING")
        
    except Exception as e:
        logger.error(f"❌ STARTUP FAILED: {e}")
        raise

# Add real trading API endpoints
@app.post("/api/configure-wallet")
async def configure_wallet(wallet_data: dict):
    """Configure wallet for real trading"""
    try:
        private_key = wallet_data.get("private_key")
        if not private_key:
            return {"success": False, "error": "Private key required"}
        
        result = await ai_orchestrator.configure_wallet(private_key)
        return result
        
    except Exception as e:
        logger.error(f"Wallet configuration error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/enable-auto-trading")
async def enable_auto_trading(trading_data: dict):
    """Enable/disable automatic trading"""
    try:
        enable = trading_data.get("enable", False)
        result = await ai_orchestrator.enable_auto_trading(enable)
        return result
        
    except Exception as e:
        logger.error(f"Auto trading toggle error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/manual-trade")
async def manual_trade(trade_data: dict):
    """Execute manual trade"""
    try:
        result = await ai_orchestrator.manual_trade_execution(trade_data)
        return result
        
    except Exception as e:
        logger.error(f"Manual trade error: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/trading-status")
async def get_trading_status():
    """Get current trading system status"""
    try:
        status = await ai_orchestrator.get_trading_status()
        return status
        
    except Exception as e:
        logger.error(f"Trading status error: {e}")
        return {"error": str(e)}

@app.post("/api/emergency-exit")
async def emergency_exit():
    """Emergency exit all positions"""
    try:
        await ai_orchestrator.position_manager.emergency_exit_all()
        return {"success": True, "message": "Emergency exit executed"}
        
    except Exception as e:
        logger.error(f"Emergency exit error: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("🚀 Starting Quantum Degen Trading AI Swarm Server...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 