"""
AI SWARM ORCHESTRATOR - THE BRAIN COORDINATOR FOR REAL TRADING
==============================================================
Coordinates all AI agents in the trading swarm with REAL execution.
NO MORE SIMULATION - THIS CONTROLS REAL MONEY.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List

# Import REAL trading components
from active_positions.position_manager import RealPositionManager
from trading.jupiter_trader import RealJupiterTrader
from core.config import settings, real_trading_config

logger = logging.getLogger("AI_SWARM")

class AISwarmOrchestrator:
    """AI Swarm coordination for REAL trading execution"""
    
    def __init__(self, **agents):
        self.agents = agents
        self.active = False
        self.is_running = False
        self.trading_signals = []
        self.market_data = {}
        self.websocket_manager = None
        
        # REAL TRADING COMPONENTS
        self.position_manager = RealPositionManager()
        self.trader = RealJupiterTrader()
        self.auto_trading_enabled = False
        self.wallet_configured = False
        self.last_coordination = datetime.now()
        
        logger.info("🤖 AI SWARM ORCHESTRATOR INITIALIZED FOR REAL TRADING")
    
    async def initialize(self):
        """Initialize all AI components and REAL trading systems"""
        logger.info("🚀 INITIALIZING AI SWARM WITH REAL TRADING...")
        
        try:
            # Initialize REAL trading systems first
            await self.trader.initialize()
            await self.position_manager.initialize()
            
            # Initialize all AI modules
            for name, agent in self.agents.items():
                try:
                    await agent.initialize()
                    logger.info(f"✅ {name} initialized")
                except Exception as e:
                    logger.error(f"❌ Failed to initialize {name}: {e}")
            
            self.active = True
            self.is_running = True
            
            # Start the orchestration loop
            asyncio.create_task(self._orchestration_loop())
            
            logger.info("✅ AI SWARM ONLINE - READY FOR REAL TRADING")
            
        except Exception as e:
            logger.error(f"❌ AI SWARM INITIALIZATION FAILED: {e}")
            raise
    
    async def configure_wallet(self, private_key: str) -> dict:
        """Configure wallet for REAL trading"""
        try:
            logger.info("🔐 CONFIGURING WALLET FOR REAL TRADING...")
            
            # Configure wallet in both trader and position manager
            trader_success = self.trader.set_wallet(private_key)
            pm_success = await self.position_manager.configure_wallet(private_key)
            
            if trader_success and pm_success:
                self.wallet_configured = True
                real_trading_config.WALLET_PRIVATE_KEY = private_key
                
                # Get wallet info
                wallet_info = await self.trader.get_wallet_balance()
                
                logger.info(f"✅ WALLET CONFIGURED: {wallet_info.get('wallet', 'Unknown')}")
                logger.info(f"💰 BALANCE: {wallet_info.get('sol_balance', 0):.4f} SOL")
                
                return {
                    "success": True,
                    "wallet_address": wallet_info.get('wallet'),
                    "balance": wallet_info.get('sol_balance', 0),
                    "message": "Wallet configured for REAL trading"
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to configure wallet"
                }
                
        except Exception as e:
            logger.error(f"Wallet configuration error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def enable_auto_trading(self, enable: bool = True) -> dict:
        """Enable/disable automatic trading execution"""
        try:
            if enable and not self.wallet_configured:
                return {
                    "success": False,
                    "error": "Wallet must be configured before enabling auto trading"
                }
            
            self.auto_trading_enabled = enable
            real_trading_config.ENABLE_AUTO_TRADING = enable
            
            status = "ENABLED" if enable else "DISABLED"
            logger.info(f"🤖 AUTO TRADING {status}")
            
            return {
                "success": True,
                "auto_trading_enabled": enable,
                "message": f"Auto trading {status.lower()}"
            }
            
        except Exception as e:
            logger.error(f"Auto trading toggle error: {e}")
            return {"success": False, "error": str(e)}

    async def _orchestration_loop(self):
        """Main orchestration loop for REAL trading"""
        logger.info("🔄 STARTING REAL TRADING ORCHESTRATION LOOP")
        
        while self.is_running:
            try:
                # 1. Gather market intelligence
                market_signals = await self._gather_market_signals()
                
                # 2. Process AI analysis
                trading_opportunities = await self._process_ai_analysis(market_signals)
                
                # 3. Execute REAL trades if auto trading enabled
                if self.auto_trading_enabled and self.wallet_configured:
                    await self._execute_real_trades(trading_opportunities)
                
                # 4. Monitor existing positions
                await self._monitor_real_positions()
                
                # 5. Risk management
                await self._execute_risk_management()
                
                # 6. Update coordination timestamp
                self.last_coordination = datetime.now()
                
                await asyncio.sleep(30)  # Run every 30 seconds
                
            except Exception as e:
                logger.error(f"Orchestration loop error: {e}")
                await asyncio.sleep(60)
    
    async def _gather_market_signals(self) -> List[dict]:
        """Gather signals from all AI agents"""
        signals = []
        
        try:
            # Collect signals from meme scanner
            if 'meme_scanner' in self.agents:
                meme_signals = await self.agents['meme_scanner'].get_latest_signals()
                signals.extend(meme_signals)
            
            # Collect signals from market analysis
            if 'market_intelligence' in self.agents:
                market_signals = await self.agents['market_intelligence'].get_market_signals()
                signals.extend(market_signals)
            
            # Collect signals from whale activity
            if 'whale_tracker' in self.agents:
                whale_signals = await self.agents['whale_tracker'].get_whale_signals()
                signals.extend(whale_signals)
                
        except Exception as e:
            logger.error(f"Signal gathering error: {e}")
        
        return signals
    
    async def _process_ai_analysis(self, signals: List[dict]) -> List[dict]:
        """Process signals through AI analysis"""
        opportunities = []
        
        try:
            # Use neural analyzer if available
            if 'neural_analyzer' in self.agents and signals:
                analyzed = await self.agents['neural_analyzer'].analyze_signals(signals)
                opportunities.extend(analyzed)
            
            # Filter by confidence and other criteria
            high_confidence_opportunities = [
                opp for opp in opportunities 
                if opp.get("confidence", 0) >= 0.75  # 75%+ confidence
            ]
            
            return high_confidence_opportunities
            
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return []
    
    async def _execute_real_trades(self, opportunities: List[dict]):
        """Execute REAL trades based on AI opportunities"""
        for opportunity in opportunities:
            try:
                if opportunity.get("confidence", 0) < 0.8:  # Minimum 80% confidence
                    continue
                
                token_mint = opportunity.get("token_mint")
                token_symbol = opportunity.get("token")
                trade_size = min(
                    opportunity.get("suggested_size", 1.0),
                    real_trading_config.MAX_POSITION_SIZE
                )
                
                logger.info(f"🎯 EXECUTING REAL TRADE: {token_symbol} | Size: {trade_size} SOL")
                
                # Execute through position manager
                result = await self.position_manager.execute_buy_trade(
                    token_mint=token_mint,
                    token_symbol=token_symbol,
                    sol_amount=trade_size,
                    market_cap=opportunity.get("market_cap", "Unknown")
                )
                
                if result.get("success"):
                    logger.info(f"✅ REAL TRADE EXECUTED: {token_symbol}")
                    
                    # Store trade record
                    self.trading_signals.append({
                        "timestamp": datetime.now(),
                        "action": "BUY",
                        "token": token_symbol,
                        "result": result,
                        "opportunity": opportunity
                    })
                else:
                    logger.error(f"❌ REAL TRADE FAILED: {token_symbol} - {result.get('error')}")
                
            except Exception as e:
                logger.error(f"Real trade execution error: {e}")
    
    async def _monitor_real_positions(self):
        """Monitor and manage REAL positions"""
        try:
            # Check for automatic exit conditions
            await self.position_manager.execute_auto_actions()
            
            # Emergency exit if portfolio is down too much
            metrics = self.position_manager.get_metrics()
            total_pl_percent = (metrics.get("total_pl", 0) / max(metrics.get("wallet_balance", 1), 1)) * 100
            
            if total_pl_percent < real_trading_config.EMERGENCY_EXIT_THRESHOLD:
                logger.warning(f"🚨 EMERGENCY EXIT TRIGGERED: Portfolio down {total_pl_percent:.1f}%")
                await self.position_manager.emergency_exit_all()
                
                # Disable auto trading after emergency exit
                self.auto_trading_enabled = False
                
        except Exception as e:
            logger.error(f"Position monitoring error: {e}")
    
    async def _execute_risk_management(self):
        """Execute risk management protocols"""
        try:
            if not self.wallet_configured:
                return
            
            # Get current portfolio metrics
            wallet_balance = await self.trader.get_wallet_balance()
            positions_data = await self.position_manager.get_active_positions()
            
            total_at_risk = sum(
                float(pos.get("size", "0").replace(" SOL", ""))
                for pos in positions_data.get("positions", [])
            )
            
            risk_percentage = total_at_risk / max(wallet_balance.get("sol_balance", 1), 1)
            
            # Risk management actions
            if risk_percentage > real_trading_config.MAX_PORTFOLIO_RISK:
                logger.warning(f"⚠️ PORTFOLIO RISK TOO HIGH: {risk_percentage:.1%}")
                # Reduce position sizes or disable new trades
                self.auto_trading_enabled = False
            
            # Hot wallet protection
            if wallet_balance.get("sol_balance", 0) > real_trading_config.MAX_HOT_WALLET_BALANCE:
                logger.info(f"💰 HOT WALLET LIMIT EXCEEDED - Consider moving funds to cold storage")
            
        except Exception as e:
            logger.error(f"Risk management error: {e}")
    
    async def manual_trade_execution(self, trade_params: dict) -> dict:
        """Execute manual trade with approval"""
        try:
            if not self.wallet_configured:
                return {"success": False, "error": "Wallet not configured"}
            
            token_mint = trade_params.get("token_mint")
            token_symbol = trade_params.get("token_symbol")
            sol_amount = trade_params.get("sol_amount")
            action = trade_params.get("action", "buy")
            
            if action == "buy":
                result = await self.position_manager.execute_buy_trade(
                    token_mint=token_mint,
                    token_symbol=token_symbol,
                    sol_amount=sol_amount
                )
            elif action == "sell":
                position_id = trade_params.get("position_id")
                sell_percentage = trade_params.get("sell_percentage", 100.0)
                result = await self.position_manager.execute_sell_trade(
                    position_id=position_id,
                    sell_percentage=sell_percentage
                )
            else:
                return {"success": False, "error": "Invalid action"}
            
            return result
            
        except Exception as e:
            logger.error(f"Manual trade execution error: {e}")
            return {"success": False, "error": str(e)}
    
    async def execute_trade(self, trade_data: dict) -> dict:
        """Execute a trade through the REAL position manager"""
        try:
            # Use the new real trading system
            token_mint = trade_data.get("token_mint")
            token_symbol = trade_data.get("token", "$UNKNOWN")
            sol_amount = trade_data.get("size", 1.0)
            
            return await self.position_manager.execute_buy_trade(
                token_mint=token_mint,
                token_symbol=token_symbol,
                sol_amount=sol_amount
            )
            
        except Exception as e:
            logger.error(f"Trade execution error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_trading_status(self) -> dict:
        """Get current trading system status"""
        try:
            wallet_balance = {}
            if self.wallet_configured:
                wallet_balance = await self.trader.get_wallet_balance()
            
            positions_data = await self.position_manager.get_active_positions()
            trading_limits = real_trading_config.get_trading_limits()
            
            return {
                "wallet_configured": self.wallet_configured,
                "auto_trading_enabled": self.auto_trading_enabled,
                "wallet_address": wallet_balance.get("wallet"),
                "sol_balance": wallet_balance.get("sol_balance", 0),
                "total_value_usd": wallet_balance.get("total_value_usd", 0),
                "active_positions": positions_data.get("active_count", "0/0"),
                "total_pl": positions_data.get("total_pl", 0),
                "trading_limits": trading_limits,
                "last_update": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Trading status error: {e}")
            return {"error": str(e)}
    
    async def get_swarm_status(self) -> dict:
        """Get overall swarm status"""
        trading_status = await self.get_trading_status()
        
        return {
            "active": self.active,
            "is_running": self.is_running,
            "agents_count": len(self.agents),
            "agents": list(self.agents.keys()),
            "last_coordination": self.last_coordination.isoformat(),
            "trading_status": trading_status
        }
    
    async def shutdown(self):
        """Shutdown all agents and trading systems"""
        logger.info("🛑 SHUTTING DOWN AI SWARM...")
        
        self.is_running = False
        
        # Shutdown REAL trading systems
        try:
            await self.position_manager.shutdown()
            await self.trader.shutdown()
            logger.info("✅ Real trading systems shutdown")
        except Exception as e:
            logger.error(f"❌ Error shutting down trading systems: {e}")
        
        # Shutdown AI agents
        for name, agent in self.agents.items():
            try:
                await agent.shutdown()
                logger.info(f"✅ {name} shutdown")
            except Exception as e:
                logger.error(f"❌ Error shutting down {name}: {e}")
        
        self.active = False
        logger.info("✅ AI SWARM SHUTDOWN COMPLETE") 