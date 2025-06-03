#!/usr/bin/env python3
"""
🚀 QUANTUM DEGEN TRADING AI SWARM - MAIN SERVER
Advanced Multi-Agent Trading System Backend
"""

import asyncio
import json
import time
import httpx
import logging
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
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("trading_bot.log")
        ]
    )
    
    logger = logging.getLogger("MAIN")
    logger.info("🚀 Starting Quantum Degen Trading AI Swarm...")
    
    # Initialize AI Swarm with real agents
    try:
        # First initialize all modules individually with proper error handling
        try:
            logger.info("Initializing Position Manager...")
            await position_manager.initialize()
            logger.info("✅ Position Manager initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Position Manager: {e}")
        
        try:
            logger.info("Initializing Neural Analyzer...")
            await neural_analyzer.initialize()
            logger.info("✅ Neural Analyzer initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Neural Analyzer: {e}")
        
        try:
            logger.info("Initializing Market Intelligence...")
            await market_intelligence.initialize()
            logger.info("✅ Market Intelligence initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Market Intelligence: {e}")
        
        try:
            logger.info("Initializing Token Hunter...")
            await token_hunter.initialize()
            logger.info("✅ Token Hunter initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Token Hunter: {e}")
        
        try:
            logger.info("Initializing Portfolio Tracker...")
            await portfolio_tracker.initialize()
            logger.info("✅ Portfolio Tracker initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Portfolio Tracker: {e}")
        
        try:
            logger.info("Initializing Risk Engine...")
            await risk_engine.initialize()
            logger.info("✅ Risk Engine initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Risk Engine: {e}")
        
        try:
            logger.info("Initializing Signal Aggregator...")
            await signal_aggregator.initialize()
            logger.info("✅ Signal Aggregator initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Signal Aggregator: {e}")
        
        try:
            logger.info("Initializing Whale Tracker...")
            await whale_tracker.initialize()
            logger.info("✅ Whale Tracker initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Whale Tracker: {e}")
        
        # Now initialize the AI Swarm Orchestrator with all modules
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
        logger.info("✅ AI Swarm Orchestrator initialized successfully")
        
        # Configure WebSocket manager with the orchestrator for real-time updates
        websocket_manager.ai_swarm = ai_swarm
        
        # Start background tasks for real data
        logger.info("Starting background tasks for real-time data...")
        asyncio.create_task(real_data_monitor())
        asyncio.create_task(broadcast_updates())
        logger.info("✅ Background tasks started successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize AI Swarm: {e}")
        ai_swarm = None
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down AI Swarm and background tasks...")
    if ai_swarm:
        await ai_swarm.shutdown()
    await http_client.aclose()
    logger.info("✅ AI Swarm shutdown complete")

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
    logger = logging.getLogger("WS_ENDPOINT")
    
    try:
        await websocket_manager.connect(websocket)
        logger.info(f"New WebSocket connection established. Total: {websocket_manager.get_connection_count()}")
        
        # Process subscription messages from client
        while True:
            try:
                message = await websocket.receive_text()
                try:
                    data = json.loads(message)
                    
                    # Handle subscription requests
                    if data.get('action') == 'subscribe' and 'channels' in data:
                        channels = data.get('channels', [])
                        if isinstance(channels, list):
                            websocket_manager.subscribe_channels(websocket, channels)
                            logger.info(f"Client subscribed to channels: {channels}")
                            
                            # Send confirmation
                            await websocket.send_text(json.dumps({
                                "type": "subscription_confirmed",
                                "channels": channels
                            }))
                    
                    # Handle ping/heartbeat
                    elif data.get('action') == 'ping':
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": datetime.now().isoformat()
                        }))
                        
                except json.JSONDecodeError:
                    logger.warning("Received invalid JSON from client")
                    
            except WebSocketDisconnect:
                websocket_manager.disconnect(websocket)
                logger.info(f"WebSocket disconnected. Total: {websocket_manager.get_connection_count()}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket)

@app.get("/api/portfolio-status")
async def get_portfolio_status_api():
    """Get current portfolio status"""
    try:
        tracker = PortfolioTracker()
        return tracker.get_portfolio_status()
    except Exception as e:
        logger.error(f"Portfolio status error: {e}")
        return JSONResponse(
            content={"error": "Failed to load portfolio status"},
            status_code=500
        )

@app.get("/api/active-positions")
async def get_active_positions_api():
    """Get active trading positions"""
    try:
        manager = RealPositionManager()
        return manager.get_active_positions()
    except Exception as e:
        logger.error(f"Active positions error: {e}")
        return JSONResponse(
            content={"error": "Failed to load positions", "positions": []},
            status_code=500
        )

@app.get("/api/whale-activity")
async def get_whale_activity_api():
    """Get whale movement data"""
    try:
        tracker = WhaleTracker()
        return tracker.get_whale_activity()
    except Exception as e:
        logger.error(f"Whale activity error: {e}")
        return JSONResponse(
            content={"error": "Failed to load whale activity", "whales": []},
            status_code=500
        )

@app.get("/api/meme-scanner")
async def get_meme_scanner_api():
    """Get meme token scanner data"""
    try:
        hunter = TokenHunter()
        return hunter.scan_meme_tokens()
    except Exception as e:
        logger.error(f"Meme scanner error: {e}")
        return JSONResponse(
            content={"error": "Failed to load meme scanner data", "tokens": []},
            status_code=500
        )

@app.get("/api/signal-feed")
async def get_signal_feed_api():
    """Get trading signals"""
    try:
        aggregator = SignalAggregator()
        return aggregator.get_trading_signals()
    except Exception as e:
        logger.error(f"Signal feed error: {e}")
        return JSONResponse(
            content={"error": "Failed to load signal feed data", "signals": []},
            status_code=500
        )

@app.get("/api/market-analysis")
async def get_market_analysis_api():
    """Get market analysis data"""
    try:
        intelligence = MarketIntelligence()
        return intelligence.get_market_data()
    except Exception as e:
        logger.error(f"Market analysis error: {e}")
        return JSONResponse(
            content={"error": "Failed to load market analysis data", "market": {"price": 0, "volume": 0, "volatility": 0, "trend": "", "support_levels": [], "resistance_levels": []}},
            status_code=500
        )

@app.get("/api/ai-analysis")
async def get_ai_analysis_api():
    """Get AI analysis data"""
    try:
        analyzer = NeuralAnalyzer()
        return analyzer.get_ai_analysis()
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return JSONResponse(
            content={"error": "AI analysis unavailable", "analysis": {"sentiment": "", "technical_signals": [], "predictions": [], "confidence": 0}},
            status_code=500
        )

@app.get("/api/risk-management")
async def get_risk_management_api():
    """Get risk management data"""
    try:
        engine = RiskEngine()
        return engine.get_risk_metrics()
    except Exception as e:
        logger.error(f"Risk management error: {e}")
        return JSONResponse(
            content={"error": "Failed to load risk management data", "risk": {"portfolio_risk": 0, "position_limits": {}, "stop_losses": [], "risk_score": 0}},
            status_code=500
        )

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
    logger = logging.getLogger("REAL_DATA_MONITOR")
    logger.info("🔄 Starting real data monitoring...")
    
    while True:
        try:
            # Run AI swarm processing
            if ai_swarm and ai_swarm.is_running:
                # This would normally call run_swarm, but we'll check if it exists first
                if hasattr(ai_swarm, 'run_swarm'):
                    await ai_swarm.run_swarm()
                # Use the orchestration loop instead if run_swarm doesn't exist
                else:
                    # The orchestration loop is handled internally by AI swarm initialization
                    pass
            
            # Fetch and update market data
            try:
                sol_price = await fetch_solana_price()
                logger.debug(f"Updated SOL price: ${sol_price}")
            except Exception as e:
                logger.warning(f"Failed to update SOL price: {e}")
            
            # Fetch trending tokens data
            try:
                tokens_data = await fetch_dex_tokens()
                if tokens_data and len(tokens_data) > 0:
                    logger.debug(f"Fetched {len(tokens_data)} trending tokens")
            except Exception as e:
                logger.warning(f"Failed to fetch trending tokens: {e}")
            
            # Update whale transactions data
            try:
                whale_txs = await fetch_whale_transactions()
                if whale_txs and len(whale_txs) > 0:
                    logger.debug(f"Fetched {len(whale_txs)} whale transactions")
            except Exception as e:
                logger.warning(f"Failed to fetch whale transactions: {e}")
            
            await asyncio.sleep(settings.PRICE_UPDATE_INTERVAL)
            
        except Exception as e:
            logger.error(f"Error in real data monitoring: {e}")
            await asyncio.sleep(10)

# Background task to broadcast updates
async def broadcast_updates():
    """Broadcast real-time updates to connected WebSocket clients"""
    logger = logging.getLogger("BROADCAST")
    logger.info("📡 Starting WebSocket broadcaster...")
    
    while True:
        try:
            if websocket_manager.get_connection_count() > 0:
                logger.debug(f"Broadcasting to {websocket_manager.get_connection_count()} clients")
                
                # Broadcast portfolio update with proper error handling
                try:
                    portfolio_data = await portfolio_tracker.get_status()
                    await websocket_manager.broadcast_to_channel('portfolio_status', portfolio_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast portfolio data: {e}")
                
                # Broadcast latest signals with proper error handling
                try:
                    signal_data = await signal_aggregator.get_signals()
                    await websocket_manager.broadcast_to_channel('signal_feed', signal_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast signals: {e}")
                
                # Broadcast whale activity with proper error handling
                try:
                    whale_data = await whale_tracker.get_activity()
                    await websocket_manager.broadcast_to_channel('whale_activity', whale_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast whale activity: {e}")
                
                # Broadcast market analysis with proper error handling
                try:
                    market_data = await market_intelligence.get_analysis()
                    await websocket_manager.broadcast_to_channel('market_analysis', market_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast market analysis: {e}")
                
                # Broadcast AI analysis with proper error handling
                try:
                    ai_data = await neural_analyzer.get_analysis()
                    await websocket_manager.broadcast_to_channel('ai_analysis', ai_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast AI analysis: {e}")
                
                # Broadcast active positions with proper error handling
                try:
                    positions_data = await position_manager.get_active_positions()
                    await websocket_manager.broadcast_to_channel('active_positions', positions_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast active positions: {e}")
                
                # Broadcast risk management data with proper error handling
                try:
                    risk_data = await risk_engine.get_risk_analysis()
                    await websocket_manager.broadcast_to_channel('risk_management', risk_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast risk management data: {e}")
                
                # Broadcast meme scanner data with proper error handling
                try:
                    meme_data = await token_hunter.get_scanner_data()
                    await websocket_manager.broadcast_to_channel('meme_scanner', meme_data)
                except Exception as e:
                    logger.error(f"Failed to broadcast meme scanner data: {e}")
            
            # Update every 5 seconds
            await asyncio.sleep(5)
            
        except Exception as e:
            logger.error(f"Error in broadcast: {e}")
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