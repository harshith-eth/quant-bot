"""
REAL POSITION MANAGER - ACTUAL TRADING EXECUTION
=================================================
Manages all active trading positions with REAL trade execution.
NO MORE SIMULATION - THIS IS WHERE REAL MONEY MOVES.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json
from dataclasses import dataclass, asdict
from enum import Enum

# Import the REAL trading engine
from trading.jupiter_trader import RealJupiterTrader

logger = logging.getLogger("POSITION_MANAGER")

class PositionStatus(Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    MONITORING = "monitoring"
    TP_READY = "tp_ready"

class TradeAction(Enum):
    BUY = "buy"
    SELL = "sell"
    TP1 = "tp1"
    TP2 = "tp2"
    STOP_LOSS = "stop_loss"

@dataclass
class RealPosition:
    id: str
    token: str
    token_mint: str  # Real token mint address
    entry_price: float
    size_sol: float  # Size in SOL
    token_amount: int  # Amount of tokens received
    current_price: float
    market_cap: str
    pl_percent: float
    pl_dollar: float
    time_elapsed: str
    status: PositionStatus
    action_button: str
    transaction_id: str  # Real blockchain transaction
    created_at: datetime
    updated_at: datetime

class RealPositionManager:
    """Manages all active trading positions with REAL execution"""
    
    def __init__(self):
        self.positions: Dict[str, RealPosition] = {}
        self.trader = RealJupiterTrader()
        self.wallet_balance = 0.0
        self.active_count = 0
        self.max_positions = 5
        self.last_update = datetime.now()
        self.position_counter = 1
        self.wallet_configured = False
        
        logger.info("🎯 REAL POSITION MANAGER INITIALIZED")
    
    async def initialize(self):
        """Initialize the position manager"""
        logger.info("🚀 INITIALIZING REAL POSITION MANAGER...")
        
        # Initialize the real trader
        await self.trader.initialize()
        
        # Start position monitoring
        asyncio.create_task(self._monitor_positions())
        logger.info("✅ REAL POSITION MANAGER ONLINE")
    
    async def configure_wallet(self, private_key: str) -> bool:
        """Configure trading wallet"""
        success = self.trader.set_wallet(private_key)
        if success:
            self.wallet_configured = True
            await self.update_wallet_balance()
            logger.info("✅ WALLET CONFIGURED FOR REAL TRADING")
        return success
    
    async def update_wallet_balance(self):
        """Update wallet balance from blockchain"""
        if not self.wallet_configured:
            return
            
        try:
            balance_data = await self.trader.get_wallet_balance()
            if "sol_balance" in balance_data:
                self.wallet_balance = balance_data["sol_balance"]
                logger.info(f"💰 WALLET BALANCE: {self.wallet_balance:.4f} SOL")
        except Exception as e:
            logger.error(f"Error updating wallet balance: {e}")
    
    async def get_active_positions(self) -> dict:
        """Get all active positions data for frontend"""
        positions_data = []
        
        for position in self.positions.values():
            # Update time elapsed
            time_diff = datetime.now() - position.created_at
            minutes = int(time_diff.total_seconds() / 60)
            position.time_elapsed = f"{minutes}m"
            
            # Update with real price data
            await self._update_real_price(position)
            
            positions_data.append({
                "id": position.id,
                "token": position.token,
                "market_cap": position.market_cap,
                "entry_price": f"${position.entry_price:.8f}",
                "size": f"{position.size_sol:.4f} SOL",
                "pl_percent": f"{position.pl_percent:+.0f}%",
                "pl_dollar": f"${position.pl_dollar:+.2f}",
                "time_elapsed": position.time_elapsed,
                "action_button": position.action_button,
                "status": position.status.value,
                "current_price": position.current_price,
                "profit_class": "profit" if position.pl_percent > 0 else "loss",
                "transaction_id": position.transaction_id,
                "token_amount": position.token_amount
            })
        
        return {
            "positions": positions_data,
            "active_count": f"{self.active_count}/{self.max_positions}",
            "total_pl": sum(pos.pl_dollar for pos in self.positions.values()),
            "winning_positions": len([p for p in self.positions.values() if p.pl_percent > 0]),
            "losing_positions": len([p for p in self.positions.values() if p.pl_percent < 0]),
            "wallet_balance": f"{self.wallet_balance:.4f} SOL",
            "wallet_configured": self.wallet_configured,
            "last_update": self.last_update.isoformat()
        }
    
    async def _update_real_price(self, position: RealPosition):
        """Update position with real market price data"""
        try:
            # Get real current price from Jupiter
            current_price = await self.trader.get_token_price(position.token_mint)
            
            if current_price and current_price > 0:
                position.current_price = current_price
                
                # Calculate real P/L
                price_change_percent = ((current_price - position.entry_price) / position.entry_price) * 100
                position.pl_percent = price_change_percent
                
                # Calculate dollar P/L based on SOL value
                sol_price = await self.trader.get_token_price("So11111111111111111111111111111111111111112")
                if sol_price:
                    position.pl_dollar = position.size_sol * (price_change_percent / 100) * sol_price
                else:
                    position.pl_dollar = position.size_sol * (price_change_percent / 100) * 150  # Fallback SOL price
                
                # Update action button based on P/L
                if position.pl_percent > 100:  # 100%+ gains
                    position.action_button = "TP2"
                    position.status = PositionStatus.TP_READY
                elif position.pl_percent > 50:   # 50%+ gains
                    position.action_button = "TP1"
                    position.status = PositionStatus.TP_READY
                elif position.pl_percent < -50:  # -50% loss
                    position.action_button = "SL"
                    position.status = PositionStatus.MONITORING
                else:
                    position.action_button = "MON"
                    position.status = PositionStatus.MONITORING
                
                position.updated_at = datetime.now()
                
        except Exception as e:
            logger.error(f"Error updating price for {position.token}: {e}")
    
    async def _monitor_positions(self):
        """Continuously monitor positions"""
        while True:
            try:
                await self.update_positions()
                await self.update_wallet_balance()
                await asyncio.sleep(10)  # Update every 10 seconds
            except Exception as e:
                logger.error(f"Position monitoring error: {e}")
                await asyncio.sleep(30)
    
    async def update_positions(self):
        """Update all position data with real market prices"""
        for position in self.positions.values():
            await self._update_real_price(position)
        
        self.last_update = datetime.now()
    
    async def execute_buy_trade(self, token_mint: str, token_symbol: str, sol_amount: float, market_cap: str = "Unknown") -> dict:
        """Execute REAL buy trade"""
        try:
            if not self.wallet_configured:
                return {"success": False, "error": "Wallet not configured"}
            
            if self.active_count >= self.max_positions:
                return {"success": False, "error": "Maximum positions reached"}
            
            if sol_amount > self.wallet_balance * 0.8:  # Max 80% of balance
                return {"success": False, "error": "Insufficient balance"}
            
            logger.info(f"🚀 EXECUTING REAL BUY: {token_symbol} with {sol_amount} SOL")
            
            # Get current price before trade
            entry_price = await self.trader.get_token_price(token_mint)
            if not entry_price:
                return {"success": False, "error": "Could not fetch token price"}
            
            # Execute REAL trade through Jupiter
            trade_result = await self.trader.buy_token(token_mint, sol_amount)
            
            if not trade_result.get("success"):
                logger.error(f"Trade failed: {trade_result.get('error')}")
                return trade_result
            
            # Create position record
            position_id = f"pos_{self.position_counter}"
            self.position_counter += 1
            
            # Calculate token amount received
            token_amount = int(trade_result.get("output_amount", 0))
            
            position = RealPosition(
                id=position_id,
                token=token_symbol,
                token_mint=token_mint,
                entry_price=entry_price,
                size_sol=sol_amount,
                token_amount=token_amount,
                current_price=entry_price,
                market_cap=market_cap,
                pl_percent=0.0,
                pl_dollar=0.0,
                time_elapsed="0m",
                status=PositionStatus.ACTIVE,
                action_button="MON",
                transaction_id=trade_result.get("transaction_id", ""),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            self.positions[position_id] = position
            self.active_count = len(self.positions)
            
            # Update wallet balance
            await self.update_wallet_balance()
            
            logger.info(f"✅ REAL POSITION OPENED: {token_symbol} | Size: {sol_amount} SOL | TX: {position.transaction_id}")
            
            return {
                "success": True,
                "position_id": position_id,
                "transaction_id": position.transaction_id,
                "token_amount": token_amount,
                "message": f"REAL position opened for {token_symbol}"
            }
            
        except Exception as e:
            logger.error(f"Execute buy trade error: {e}")
            return {"success": False, "error": str(e)}
    
    async def execute_sell_trade(self, position_id: str, sell_percentage: float = 100.0) -> dict:
        """Execute REAL sell trade"""
        try:
            if position_id not in self.positions:
                return {"success": False, "error": "Position not found"}
            
            position = self.positions[position_id]
            tokens_to_sell = int(position.token_amount * (sell_percentage / 100))
            
            logger.info(f"🚀 EXECUTING REAL SELL: {position.token} {tokens_to_sell} tokens ({sell_percentage}%)")
            
            # Execute REAL sell trade through Jupiter
            trade_result = await self.trader.sell_token(position.token_mint, tokens_to_sell)
            
            if not trade_result.get("success"):
                logger.error(f"Sell trade failed: {trade_result.get('error')}")
                return trade_result
            
            # Update position or close it
            if sell_percentage >= 100:
                # Close position completely
                final_pl = position.pl_dollar
                
                logger.info(f"📊 REAL POSITION CLOSED: {position.token} | P/L: ${final_pl:.2f} | TX: {trade_result.get('transaction_id')}")
                
                # Remove position
                del self.positions[position_id]
                self.active_count = len(self.positions)
            else:
                # Partial sell - update position
                position.token_amount = int(position.token_amount * (1 - sell_percentage / 100))
                position.size_sol = position.size_sol * (1 - sell_percentage / 100)
                position.updated_at = datetime.now()
            
            # Update wallet balance
            await self.update_wallet_balance()
            
            return {
                "success": True,
                "transaction_id": trade_result.get("transaction_id"),
                "tokens_sold": tokens_to_sell,
                "sol_received": trade_result.get("output_amount", 0) / 1e9,  # Convert lamports to SOL
                "message": f"REAL sell executed for {position.token}"
            }
            
        except Exception as e:
            logger.error(f"Execute sell trade error: {e}")
            return {"success": False, "error": str(e)}
    
    async def close_position(self, position_id: str, reason: str = "Manual close") -> dict:
        """Close position by selling all tokens"""
        return await self.execute_sell_trade(position_id, 100.0)
    
    async def emergency_exit_all(self):
        """Emergency exit all positions - SELL EVERYTHING"""
        logger.warning("🚨 EMERGENCY EXIT ALL POSITIONS!")
        
        for position_id in list(self.positions.keys()):
            try:
                await self.execute_sell_trade(position_id, 100.0)
            except Exception as e:
                logger.error(f"Emergency exit failed for {position_id}: {e}")
        
        logger.info("💀 ALL POSITIONS CLOSED - PORTFOLIO SAFE")
    
    async def check_exit_conditions(self) -> List[dict]:
        """Check for automatic exit conditions"""
        actions = []
        
        for position in self.positions.values():
            # Check for take profit conditions
            if position.pl_percent > 150:  # 150% TP
                actions.append({
                    "type": "TAKE_PROFIT",
                    "position_id": position.id,
                    "reason": "150% TP target reached",
                    "priority": "HIGH"
                })
            
            # Check for stop loss conditions
            elif position.pl_percent < -30:  # 30% SL
                actions.append({
                    "type": "STOP_LOSS",
                    "position_id": position.id,
                    "reason": "30% SL triggered",
                    "priority": "HIGH"
                })
        
        return actions
    
    async def execute_auto_actions(self):
        """Execute automatic stop loss and take profit actions"""
        actions = await self.check_exit_conditions()
        
        for action in actions:
            try:
                if action["type"] == "TAKE_PROFIT":
                    # Sell 50% on first TP
                    await self.execute_sell_trade(action["position_id"], 50.0)
                    logger.info(f"💰 AUTO TAKE PROFIT: {action['position_id']}")
                    
                elif action["type"] == "STOP_LOSS":
                    # Sell 100% on stop loss
                    await self.execute_sell_trade(action["position_id"], 100.0)
                    logger.warning(f"🛑 AUTO STOP LOSS: {action['position_id']}")
                    
            except Exception as e:
                logger.error(f"Auto action error for {action['position_id']}: {e}")
    
    def get_metrics(self) -> dict:
        """Get position manager metrics"""
        total_pl = sum(pos.pl_dollar for pos in self.positions.values())
        winning_positions = len([p for p in self.positions.values() if p.pl_percent > 0])
        
        return {
            "active_positions": self.active_count,
            "total_pl": total_pl,
            "winning_rate": winning_positions / max(self.active_count, 1) * 100,
            "wallet_balance": self.wallet_balance,
            "wallet_configured": self.wallet_configured,
            "last_update": self.last_update.isoformat()
        }
    
    async def shutdown(self):
        """Shutdown position manager"""
        logger.info("🛑 SHUTTING DOWN REAL POSITION MANAGER...")
        await self.trader.shutdown()
        logger.info("✅ REAL POSITION MANAGER SHUTDOWN COMPLETE") 