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
            
            # Store reference to websocket manager if exists
            websocket_manager = self.agents.get('websocket_manager')
            
            # Initialize all AI modules
            for name, agent in self.agents.items():
                try:
                    await agent.initialize()
                    logger.info(f"✅ {name} initialized")
                    
                    # Connect risk engine to other components
                    if name == 'risk_engine':
                        # Connect to position manager
                        await agent.set_position_manager(self.position_manager)
                        logger.info("✅ Risk engine connected to position manager")
                        
                        # Connect to websocket manager if available
                        if websocket_manager and hasattr(agent, 'set_websocket_manager'):
                            await agent.set_websocket_manager(websocket_manager)
                            logger.info("✅ Risk engine connected to websocket manager")
                            
                    # Connect portfolio tracker to other components        
                    elif name == 'portfolio_tracker':
                        # Connect to position manager
                        if hasattr(agent, 'set_position_manager'):
                            await agent.set_position_manager(self.position_manager)
                            logger.info("✅ Portfolio tracker connected to position manager")
                            
                        # Connect to trader for price data
                        if hasattr(agent, 'set_trader'):
                            await agent.set_trader(self.trader)
                            logger.info("✅ Portfolio tracker connected to trader")
                            
                        # Set wallet address if configured
                        if self.wallet_configured and hasattr(agent, 'set_wallet_address'):
                            wallet_data = await self.trader.get_wallet_balance()
                            if wallet_data.get("wallet"):
                                agent.set_wallet_address(wallet_data["wallet"])
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
                wallet_address = wallet_info.get('wallet', 'Unknown')
                
                logger.info(f"✅ WALLET CONFIGURED: {wallet_address}")
                logger.info(f"💰 BALANCE: {wallet_info.get('sol_balance', 0):.4f} SOL")
                
                # Configure wallet address in portfolio tracker if available
                if 'portfolio_tracker' in self.agents and hasattr(self.agents['portfolio_tracker'], 'set_wallet_address'):
                    self.agents['portfolio_tracker'].set_wallet_address(wallet_address)
                    logger.info("✅ Portfolio tracker configured with wallet address")
                
                return {
                    "success": True,
                    "wallet_address": wallet_address,
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
        """Execute REAL trades based on AI opportunities with dynamic position sizing"""
        for opportunity in opportunities:
            try:
                if opportunity.get("confidence", 0) < 0.8:  # Minimum 80% confidence
                    continue
                
                token_mint = opportunity.get("token_mint")
                token_symbol = opportunity.get("token")
                
                # Get wallet balance
                wallet_data = await self.trader.get_wallet_balance()
                wallet_balance = wallet_data.get("sol_balance", 0)
                
                # Calculate optimal position size based on volatility if risk engine available
                if 'risk_engine' in self.agents and token_symbol:
                    # Use volatility-based position sizing from risk engine
                    trade_size = self.agents['risk_engine'].calculate_position_size_for_token(
                        token_symbol, wallet_balance
                    )
                    logger.info(f"📊 VOLATILITY-BASED POSITION SIZING: {token_symbol} | {trade_size} SOL")
                else:
                    # Fallback to basic position sizing
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
        """Monitor and manage REAL positions with enhanced emergency protocols"""
        try:
            # Check for automatic exit conditions
            await self.position_manager.execute_auto_actions()
            
            # Use risk engine for advanced emergency detection if available
            if 'risk_engine' in self.agents:
                # Emergency monitoring is now handled by the risk engine's advanced systems
                risk_analysis = await self.agents['risk_engine'].analyze_portfolio_risk()
                
                if risk_analysis.get("emergency_exit") and not risk_analysis.get("emergency_triggered"):
                    # Emergency condition detected but not yet triggered
                    logger.warning(f"🚨 EMERGENCY CONDITION DETECTED: {risk_analysis.get('emergency_reason')}")
                    await self.agents['risk_engine'].trigger_emergency_stop(risk_analysis.get("emergency_reason", "Critical risk level"))
                    
                    # Disable auto trading after emergency exit
                    self.auto_trading_enabled = False
                    real_trading_config.ENABLE_AUTO_TRADING = False
                    
            else:
                # Fallback to basic emergency detection if risk engine not available
                metrics = self.position_manager.get_metrics()
                total_pl_percent = (metrics.get("total_pl", 0) / max(metrics.get("wallet_balance", 1), 1)) * 100
                
                if total_pl_percent < real_trading_config.EMERGENCY_EXIT_THRESHOLD:
                    logger.warning(f"🚨 EMERGENCY EXIT TRIGGERED: Portfolio down {total_pl_percent:.1f}%")
                    await self.position_manager.emergency_exit_all()
                    
                    # Disable auto trading after emergency exit
                    self.auto_trading_enabled = False
                    real_trading_config.ENABLE_AUTO_TRADING = False
                
        except Exception as e:
            logger.error(f"Position monitoring error: {e}")
    
    async def _execute_risk_management(self):
        """Execute enhanced risk management protocols with exposure limits"""
        try:
            if not self.wallet_configured:
                return
            
            # Get current portfolio metrics
            wallet_balance = await self.trader.get_wallet_balance()
            positions_data = await self.position_manager.get_active_positions()
            
            total_at_risk = sum(
                float(pos.get("size", "0").replace(" SOL", "") if isinstance(pos.get("size"), str) else pos.get("size", 0))
                for pos in positions_data.get("positions", [])
            )
            
            sol_balance = wallet_balance.get("sol_balance", 1)
            risk_percentage = total_at_risk / max(sol_balance, 1)
            
            # Use risk engine for advanced risk evaluation
            if 'risk_engine' in self.agents:
                # Connect position manager to risk engine if needed
                if not hasattr(self.agents['risk_engine'], 'position_manager') or not self.agents['risk_engine'].position_manager:
                    await self.agents['risk_engine'].set_position_manager(self.position_manager)
                
                # Execute risk analysis
                risk_analysis = await self.agents['risk_engine'].analyze_portfolio_risk()
                
                # Handle emergency exit conditions
                if risk_analysis.get("emergency_exit"):
                    logger.warning(f"🚨 EMERGENCY RISK CONDITION DETECTED: {risk_analysis.get('risk_level')}")
                    await self.agents['risk_engine'].trigger_emergency_stop("Critical risk level detected")
                    self.auto_trading_enabled = False
                    return
                
                # Apply position sizing recommendations
                position_limits = risk_analysis.get("position_limits", {})
                if position_limits:
                    # Update trading limits based on risk analysis
                    new_max_position = position_limits.get("max_position_size")
                    if new_max_position:
                        real_trading_config.MAX_POSITION_SIZE = new_max_position
                        logger.info(f"📊 DYNAMIC POSITION SIZING APPLIED: Max {new_max_position:.2f} SOL")
            
            # Direct portfolio exposure control
            if risk_percentage > real_trading_config.MAX_PORTFOLIO_RISK:
                logger.warning(f"⚠️ PORTFOLIO EXPOSURE TOO HIGH: {risk_percentage:.1%}")
                # Scale down position sizes or disable new trades
                self.auto_trading_enabled = False
                
                # Apply exposure limits
                if total_at_risk > sol_balance * real_trading_config.MAX_PORTFOLIO_RISK:
                    logger.warning(f"⚠️ REBALANCING PORTFOLIO TO REDUCE EXPOSURE")
                    # Calculate target exposure
                    target_exposure = sol_balance * real_trading_config.MAX_PORTFOLIO_RISK * 0.9  # 90% of max allowed
                    excess_exposure = total_at_risk - target_exposure
                    
                    # Find candidates for reduction
                    if excess_exposure > 0.01 and 'risk_engine' in self.agents:  # At least 0.01 SOL excess
                        await self._reduce_portfolio_exposure(positions_data.get("positions", []), excess_exposure)
            
            # Hot wallet protection
            if sol_balance > real_trading_config.MAX_HOT_WALLET_BALANCE:
                logger.info(f"💰 HOT WALLET LIMIT EXCEEDED - Consider moving funds to cold storage")
            
        except Exception as e:
            logger.error(f"Risk management error: {e}")
            
    async def _reduce_portfolio_exposure(self, positions: List[dict], excess_amount: float):
        """Reduce portfolio exposure by closing or reducing positions"""
        if not positions:
            return
        
        logger.warning(f"🔄 REDUCING PORTFOLIO EXPOSURE BY {excess_amount:.2f} SOL")
        
        # Sort positions by priority for reduction
        # Typically reduce most liquid, least profitable positions first
        sorted_positions = sorted(
            positions, 
            key=lambda p: float(p.get("pnl", 0) if isinstance(p.get("pnl"), (int, float)) else -999)
        )
        
        amount_reduced = 0
        for position in sorted_positions:
            if amount_reduced >= excess_amount:
                break
                
            position_id = position.get("id")
            if not position_id:
                continue
                
            position_size = float(position.get("size", 0) 
                                if isinstance(position.get("size"), (int, float)) 
                                else float(position.get("size", "0").replace(" SOL", "")))
            
            symbol = position.get("symbol", "Unknown")
            
            # Calculate what percentage to sell
            remaining_needed = excess_amount - amount_reduced
            
            if remaining_needed >= position_size * 0.9:  # Close most or all of position
                sell_percentage = 100.0  # Close entire position
                amount_to_reduce = position_size
            else:
                # Sell partial position
                sell_percentage = (remaining_needed / position_size) * 100
                sell_percentage = min(90, max(20, sell_percentage))  # Between 20-90%
                amount_to_reduce = position_size * (sell_percentage / 100)
            
            logger.info(f"📉 REDUCING POSITION {symbol} BY {sell_percentage:.1f}% ({amount_to_reduce:.2f} SOL)")
            
            try:
                result = await self.position_manager.execute_sell_trade(
                    position_id=position_id,
                    sell_percentage=sell_percentage
                )
                
                if result.get("success"):
                    logger.info(f"✅ POSITION REDUCED: {symbol}")
                    amount_reduced += amount_to_reduce
                else:
                    logger.error(f"❌ POSITION REDUCTION FAILED: {symbol} - {result.get('error')}")
                    
            except Exception as e:
                logger.error(f"Position reduction error: {e}")
        
        logger.info(f"🔄 PORTFOLIO EXPOSURE REDUCED BY {amount_reduced:.2f} SOL")
        
        # Update wallet balance after reductions
        await self.position_manager.update_wallet_balance()
    
    async def manual_trade_execution(self, trade_params: dict) -> dict:
        """Execute manual trade with approval and portfolio tracking"""
        try:
            if not self.wallet_configured:
                return {"success": False, "error": "Wallet not configured"}
            
            token_mint = trade_params.get("token_mint")
            token_symbol = trade_params.get("token_symbol")
            sol_amount = trade_params.get("sol_amount")
            action = trade_params.get("action", "buy")
            
            if action == "buy":
                # Get additional risk parameters if provided
                stop_loss_pct = trade_params.get("stop_loss_pct", 30.0)
                take_profit_pct = trade_params.get("take_profit_pct", 100.0)
                max_slippage = trade_params.get("max_slippage")
                
                result = await self.position_manager.execute_buy_trade(
                    token_mint=token_mint,
                    token_symbol=token_symbol,
                    sol_amount=sol_amount,
                    stop_loss_pct=stop_loss_pct,
                    take_profit_pct=take_profit_pct,
                    max_slippage=max_slippage
                )
                
                # Record the trade in portfolio tracker
                if result.get("success") and 'portfolio_tracker' in self.agents:
                    try:
                        await self.agents['portfolio_tracker'].record_trade({
                            "action": "BUY",
                            "token": token_symbol,
                            "amount_sol": sol_amount,
                            "token_amount": result.get("token_amount", 0),
                            "timestamp": datetime.now().isoformat()
                        })
                    except Exception as e:
                        logger.error(f"Error recording trade in portfolio tracker: {e}")
                
            elif action == "sell":
                position_id = trade_params.get("position_id")
                sell_percentage = trade_params.get("sell_percentage", 100.0)
                reason = trade_params.get("reason", "Manual sell")
                
                # Get position data before selling for P&L calculation
                position_data = None
                if 'portfolio_tracker' in self.agents and hasattr(self.position_manager, 'positions'):
                    position_data = self.position_manager.positions.get(position_id)
                
                result = await self.position_manager.execute_sell_trade(
                    position_id=position_id,
                    sell_percentage=sell_percentage,
                    reason=reason
                )
                
                # Record the trade in portfolio tracker
                if result.get("success") and 'portfolio_tracker' in self.agents and position_data:
                    try:
                        # Calculate P&L
                        pl_amount = position_data.pl_dollar
                        pl_percent = position_data.pl_percent
                        
                        await self.agents['portfolio_tracker'].record_trade({
                            "action": "SELL",
                            "token": position_data.token,
                            "amount_sol": position_data.size_sol * (sell_percentage / 100),
                            "token_amount": int(position_data.token_amount * (sell_percentage / 100)),
                            "pl_amount": pl_amount * (sell_percentage / 100),
                            "pl_percent": pl_percent,
                            "timestamp": datetime.now().isoformat()
                        })
                    except Exception as e:
                        logger.error(f"Error recording sell in portfolio tracker: {e}")
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
        """Get current trading system status with enhanced risk metrics"""
        try:
            wallet_balance = {}
            if self.wallet_configured:
                wallet_balance = await self.trader.get_wallet_balance()
            
            positions_data = await self.position_manager.get_active_positions()
            trading_limits = real_trading_config.get_trading_limits()
            
            # Get risk engine metrics if available
            risk_metrics = {}
            emergency_status = False
            emergency_reason = None
            
            if 'risk_engine' in self.agents:
                risk_metrics = self.agents['risk_engine'].get_metrics()
                emergency_status = risk_metrics.get('emergency_stop', False)
                emergency_reason = risk_metrics.get('emergency_reason')
            
            return {
                "wallet_configured": self.wallet_configured,
                "auto_trading_enabled": self.auto_trading_enabled,
                "emergency_stop": emergency_status,
                "emergency_reason": emergency_reason,
                "wallet_address": wallet_balance.get("wallet"),
                "sol_balance": wallet_balance.get("sol_balance", 0),
                "total_value_usd": wallet_balance.get("total_value_usd", 0),
                "active_positions": positions_data.get("active_count", "0/0"),
                "total_pl": positions_data.get("total_pl", 0),
                "trading_limits": trading_limits,
                "risk_metrics": risk_metrics,
                "last_update": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Trading status error: {e}")
            return {"error": str(e)}
    
    async def reset_emergency_stop(self, admin_id: str = None) -> dict:
        """Reset emergency stop condition after manual review"""
        try:
            # Use risk engine for advanced reset if available
            if 'risk_engine' in self.agents and hasattr(self.agents['risk_engine'], 'reset_emergency_stop'):
                reset_result = await self.agents['risk_engine'].reset_emergency_stop(admin_id)
                
                if reset_result:
                    logger.info(f"✅ Emergency stop reset by admin: {admin_id if admin_id else 'unknown'}")
                    return {
                        "success": True,
                        "message": "Emergency stop reset successfully"
                    }
                else:
                    return {
                        "success": False,
                        "message": "No emergency stop active to reset"
                    }
            else:
                # Basic reset if risk engine not available
                logger.warning("No advanced risk engine available for emergency reset")
                self.auto_trading_enabled = True
                return {
                    "success": True,
                    "message": "Simple emergency stop reset performed"
                }
                
        except Exception as e:
            logger.error(f"Emergency reset error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
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