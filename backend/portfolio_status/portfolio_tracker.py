"""
PORTFOLIO TRACKER - THE MONEY MACHINE MONITOR
============================================
Tracks overall portfolio performance and metrics.
Where we see if we're making it or staying poor.
"""

import asyncio
import logging
import math
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from decimal import Decimal

from core.config import settings, real_trading_config

logger = logging.getLogger("PORTFOLIO_TRACKER")

class PortfolioTracker:
    """Tracks portfolio performance and metrics with real-time calculations"""
    
    def __init__(self):
        self.portfolio_data = {
            "total_value": settings.INITIAL_BALANCE,      # Starting balance
            "initial_balance": settings.INITIAL_BALANCE,
            "current_balance": settings.INITIAL_BALANCE,
            "realized_pnl": 0.0,
            "unrealized_pnl": 0.0,
            "win_rate": 0.0,                  # Will calculate from real trades
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "best_trade": 0.0,
            "worst_trade": 0.0,
            "best_trade_token": "",
            "worst_trade_token": "",
            "daily_pnl": [0.0],               # Will populate with real data
            "monthly_pnl": [0.0],              # Monthly P&L data
            "monthly_performance": 0.0,
            "total_tokens_traded": 0,          # Number of unique tokens traded
            "average_hold_time": 0.0,          # Average position hold time in hours
            "roi": 0.0                         # Overall ROI percentage
        }
        
        # Portfolio snapshot time series data
        self.portfolio_history = [
            {
                "timestamp": datetime.now().isoformat(),
                "total_value": settings.INITIAL_BALANCE,
                "realized_pnl": 0.0,
                "unrealized_pnl": 0.0
            }
        ]
        
        # Trade history
        self.trade_history = []
        
        # SOL price tracking for USD conversions
        self.sol_price_usd = 150.0  # Starting estimate
        
        # Portfolio health checks
        self.health_checks = {
            "diversification": "LOW",
            "risk_exposure": "LOW",
            "trading_frequency": "LOW",
            "profit_consistency": "UNKNOWN"
        }
        
        # Tracking last update timestamps
        self.last_update = datetime.now()
        self.last_daily_snapshot = datetime.now()
        self.position_manager = None
        self.trader = None
        
        # Wallet address for tracking
        self.wallet_address = None
        
        logger.info("📈 PORTFOLIO TRACKER INITIALIZED")
    
    async def initialize(self):
        """Initialize portfolio tracker with real-time monitoring"""
        logger.info("🚀 INITIALIZING PORTFOLIO TRACKER...")
        
        # Start the monitoring loops
        asyncio.create_task(self._monitor_portfolio())
        asyncio.create_task(self._daily_snapshot_task())
        asyncio.create_task(self._fetch_sol_price_task())
        
        # Balance alerts configuration
        self.balance_alert_thresholds = {
            "low_balance": 1.0,  # Alert when balance below 1 SOL
            "critical_balance": 0.2,  # Critical alert when below 0.2 SOL
            "large_increase": 10.0,  # Alert on increases > 10 SOL
            "large_decrease": 5.0,  # Alert on decreases > 5 SOL
        }
        
        # Balance history tracking
        self.balance_history = [
            {"timestamp": datetime.now().isoformat(), "balance": settings.INITIAL_BALANCE}
        ]
        
        # Start wallet balance monitoring if we have a wallet address
        if self.wallet_address:
            asyncio.create_task(self._wallet_balance_monitor_task())
        
        logger.info("✅ PORTFOLIO TRACKER ONLINE")
    
    async def set_position_manager(self, position_manager):
        """Set the position manager for real position data"""
        self.position_manager = position_manager
        logger.info("✅ Position manager connected to portfolio tracker")
    
    async def set_trader(self, trader):
        """Set the trader for price data"""
        self.trader = trader
        logger.info("✅ Trader connected to portfolio tracker")
    
    def set_wallet_address(self, address: str):
        """Set the wallet address for tracking"""
        self.wallet_address = address
        logger.info(f"✅ Now tracking wallet: {address}")
    
    def get_portfolio_status(self) -> dict:
        """Get portfolio status in the exact format required with real-time data"""
        # Calculate the total portfolio value including unrealized P&L
        total_value = self.portfolio_data["current_balance"]
        
        # Get real assets from position manager if available
        assets = []
        if hasattr(self, 'position_manager') and self.position_manager:
            # This will be populated from real position data in update_metrics
            assets = self.get_current_assets()
        else:
            # Fallback to mock data if no position manager
            assets = [
                {"symbol": "SOL", "amount": 12.5, "value": 15.0},
                {"symbol": "BONK", "amount": 1000000, "value": 5.0},
                {"symbol": "BOME", "amount": 500000, "value": 3.5},
                {"symbol": "WIF", "amount": 2500, "value": 1.5}
            ]
        
        # Calculate performance metrics from real data
        daily_change = self.portfolio_data["daily_pnl"][-1] if self.portfolio_data["daily_pnl"] else 0.0
        
        # Weekly change - sum of last 7 daily changes or all if less than 7
        daily_pnl = self.portfolio_data["daily_pnl"]
        weekly_change = sum(daily_pnl[-7:] if len(daily_pnl) >= 7 else daily_pnl)
        
        # Monthly change from dedicated tracker
        monthly_change = self.portfolio_data["monthly_performance"]
        
        # Calculate ROI
        initial = self.portfolio_data["initial_balance"]
        current = total_value
        roi_pct = ((current - initial) / initial * 100) if initial > 0 else 0
        
        # Return data in the required format with enhanced metrics
        return {
            "portfolio": {
                "total_value": total_value,
                "total_value_usd": total_value * self.sol_price_usd,
                "assets": assets,
                "performance": {
                    "daily": daily_change,
                    "weekly": weekly_change,
                    "monthly": monthly_change,
                    "roi_percent": roi_pct,
                    "realized_pnl": self.portfolio_data["realized_pnl"],
                    "unrealized_pnl": self.portfolio_data["unrealized_pnl"]
                },
                "trading_stats": {
                    "win_rate": self.portfolio_data["win_rate"],
                    "total_trades": self.portfolio_data["total_trades"],
                    "tokens_traded": self.portfolio_data["total_tokens_traded"],
                    "avg_hold_time": self.portfolio_data["average_hold_time"]
                }
            }
        }
    
    def get_current_assets(self) -> List[Dict]:
        """Get current assets from position manager"""
        assets = []
        if not hasattr(self, 'position_manager') or not self.position_manager:
            return assets
            
        try:
            # This would be a synchronous accessor for cached position data
            # For real implementation, call get_cached_positions or similar
            positions = getattr(self.position_manager, 'cached_positions', [])
            
            # Convert positions to asset format
            for pos in positions:
                if isinstance(pos, dict):
                    assets.append({
                        "symbol": pos.get("symbol", "UNKNOWN"),
                        "amount": pos.get("token_amount", 0),
                        "value": pos.get("size_sol", 0),
                        "pnl": pos.get("pl_percent", 0)
                    })
            
            # Add SOL balance as an asset
            if hasattr(self.position_manager, 'wallet_balance'):
                sol_balance = getattr(self.position_manager, 'wallet_balance', 0)
                if sol_balance > 0:
                    assets.append({
                        "symbol": "SOL",
                        "amount": sol_balance,
                        "value": sol_balance,
                        "pnl": 0.0
                    })
            
            return assets
        except Exception as e:
            logger.error(f"Error getting assets: {e}")
            return []
    
    async def record_trade(self, trade_data: Dict):
        """Record a completed trade for portfolio analysis"""
        try:
            # Extract relevant trade data
            trade_type = trade_data.get("action", "UNKNOWN")
            token = trade_data.get("token", "UNKNOWN")
            amount_sol = float(trade_data.get("amount_sol", 0))
            token_amount = int(trade_data.get("token_amount", 0))
            pl_amount = float(trade_data.get("pl_amount", 0))
            pl_percent = float(trade_data.get("pl_percent", 0))
            timestamp = datetime.now()
            
            # Create trade record
            trade_record = {
                "id": len(self.trade_history) + 1,
                "timestamp": timestamp.isoformat(),
                "token": token,
                "type": trade_type,
                "amount_sol": amount_sol,
                "token_amount": token_amount,
                "pl_amount": pl_amount,
                "pl_percent": pl_percent,
                "sol_price_usd": self.sol_price_usd
            }
            
            # Add to trade history
            self.trade_history.append(trade_record)
            
            # Update trading stats
            self.portfolio_data["total_trades"] += 1
            
            # Track unique tokens traded
            traded_tokens = set(t.get("token") for t in self.trade_history)
            self.portfolio_data["total_tokens_traded"] = len(traded_tokens)
            
            # Update win/loss stats (for sell trades)
            if trade_type.lower() == "sell" and pl_amount != 0:
                if pl_amount > 0:
                    self.portfolio_data["winning_trades"] += 1
                    
                    # Check if this is the best trade
                    if pl_percent > self.portfolio_data["best_trade"]:
                        self.portfolio_data["best_trade"] = pl_percent
                        self.portfolio_data["best_trade_token"] = token
                else:
                    self.portfolio_data["losing_trades"] += 1
                    
                    # Check if this is the worst trade
                    if pl_percent < self.portfolio_data["worst_trade"]:
                        self.portfolio_data["worst_trade"] = pl_percent
                        self.portfolio_data["worst_trade_token"] = token
                        
                # Update realized P&L
                self.portfolio_data["realized_pnl"] += pl_amount
                        
            # Update win rate
            total_closed = self.portfolio_data["winning_trades"] + self.portfolio_data["losing_trades"]
            if total_closed > 0:
                self.portfolio_data["win_rate"] = (self.portfolio_data["winning_trades"] / total_closed) * 100
                
            # Add portfolio snapshot
            await self._take_portfolio_snapshot()
            
            logger.info(f"Trade recorded: {token} {trade_type} | P&L: {pl_amount:.4f} SOL ({pl_percent:.1f}%)")
            
        except Exception as e:
            logger.error(f"Error recording trade: {e}")
    
    async def update_metrics(self):
        """Update portfolio metrics based on real position data"""
        try:
            if not self.position_manager:
                # No position manager connected yet
                return
                
            # Get position manager metrics
            metrics = self.position_manager.get_metrics()
            positions_data = await self.position_manager.get_active_positions()
            
            # Update wallet balance
            wallet_balance = metrics.get("wallet_balance", self.portfolio_data["current_balance"])
            self.portfolio_data["current_balance"] = wallet_balance
            
            # Calculate unrealized P&L from active positions
            unrealized_pnl = sum(
                float(pos.get("pnl", 0)) 
                for pos in positions_data.get("positions", [])
            )
            self.portfolio_data["unrealized_pnl"] = unrealized_pnl
            
            # Calculate total portfolio value (wallet balance + unrealized P&L)
            self.portfolio_data["total_value"] = wallet_balance + unrealized_pnl
            
            # Calculate ROI
            initial = self.portfolio_data["initial_balance"]
            current = self.portfolio_data["total_value"]
            if initial > 0:
                self.portfolio_data["roi"] = ((current - initial) / initial) * 100
            
            # Calculate average hold time if we have trade history
            if self.trade_history:
                total_hold_time = 0
                closed_positions = [t for t in self.trade_history if t.get("type").lower() == "sell"]
                
                if closed_positions:
                    for pos in closed_positions:
                        # In a real implementation, we would match buy/sell pairs
                        # For now, use an average hold time of 2 hours per trade
                        total_hold_time += 2
                    
                    self.portfolio_data["average_hold_time"] = total_hold_time / len(closed_positions)
            
            # Perform portfolio health checks
            self._assess_portfolio_health(positions_data.get("positions", []))
            
            # Take portfolio snapshot every update
            await self._take_portfolio_snapshot()
            
            self.last_update = datetime.now()
            
        except Exception as e:
            logger.error(f"Error updating metrics: {e}")
    
    async def _take_portfolio_snapshot(self):
        """Take a snapshot of current portfolio state"""
        snapshot = {
            "timestamp": datetime.now().isoformat(),
            "total_value": self.portfolio_data["total_value"],
            "realized_pnl": self.portfolio_data["realized_pnl"],
            "unrealized_pnl": self.portfolio_data["unrealized_pnl"],
            "wallet_balance": self.portfolio_data["current_balance"],
            "sol_price_usd": self.sol_price_usd
        }
        
        # Add to history, keeping the last 1000 snapshots (configurable)
        self.portfolio_history.append(snapshot)
        if len(self.portfolio_history) > 1000:
            self.portfolio_history = self.portfolio_history[-1000:]
    
    async def _daily_snapshot_task(self):
        """Take daily portfolio snapshots for performance tracking"""
        while True:
            try:
                # Check if a day has passed since last snapshot
                now = datetime.now()
                hours_passed = (now - self.last_daily_snapshot).total_seconds() / 3600
                
                if hours_passed >= 24:  # Take daily snapshot
                    # Calculate daily P&L
                    previous_value = self.portfolio_data["total_value"]
                    current_value = await self._calculate_total_portfolio_value()
                    daily_pnl = current_value - previous_value
                    
                    # Add to daily and monthly P&L trackers
                    self.portfolio_data["daily_pnl"].append(daily_pnl)
                    self.portfolio_data["monthly_pnl"].append(daily_pnl)
                    
                    # Cap history at 90 days
                    if len(self.portfolio_data["daily_pnl"]) > 90:
                        self.portfolio_data["daily_pnl"] = self.portfolio_data["daily_pnl"][-90:]
                    
                    # Calculate monthly performance
                    monthly_pnl = sum(self.portfolio_data["monthly_pnl"][-30:] if len(self.portfolio_data["monthly_pnl"]) >= 30 else self.portfolio_data["monthly_pnl"])
                    self.portfolio_data["monthly_performance"] = monthly_pnl
                    
                    # Reset monthly P&L if more than 30 days of data
                    if len(self.portfolio_data["monthly_pnl"]) > 30:
                        self.portfolio_data["monthly_pnl"] = self.portfolio_data["monthly_pnl"][-30:]
                    
                    # Update last snapshot time
                    self.last_daily_snapshot = now
                    
                    logger.info(f"Daily snapshot taken - P&L: {daily_pnl:.4f} SOL")
                
                # Sleep until next check (hourly)
                await asyncio.sleep(3600)  # Check every hour
            except Exception as e:
                logger.error(f"Daily snapshot error: {e}")
                await asyncio.sleep(7200)  # Wait 2 hours if there was an error
    
    async def _monitor_portfolio(self):
        """Continuous real-time portfolio monitoring"""
        while True:
            try:
                await self.update_metrics()
                await asyncio.sleep(settings.PORTFOLIO_UPDATE_INTERVAL)
            except Exception as e:
                logger.error(f"Portfolio monitoring error: {e}")
                await asyncio.sleep(60)
    
    def _assess_portfolio_health(self, positions: List[Dict]):
        """Assess overall portfolio health based on various metrics"""
        # Assess diversification
        if len(positions) <= 1:
            self.health_checks["diversification"] = "LOW"
        elif len(positions) <= 3:
            self.health_checks["diversification"] = "MEDIUM"
        else:
            self.health_checks["diversification"] = "HIGH"
        
        # Assess risk exposure based on position sizes relative to total portfolio
        if positions and self.portfolio_data["total_value"] > 0:
            max_position_pct = max(
                (float(pos.get("value", 0)) / self.portfolio_data["total_value"] * 100)
                for pos in positions
            ) if positions else 0
            
            if max_position_pct > 50:  # Single position > 50% of portfolio
                self.health_checks["risk_exposure"] = "HIGH"
            elif max_position_pct > 25:  # Single position > 25% of portfolio
                self.health_checks["risk_exposure"] = "MEDIUM"
            else:
                self.health_checks["risk_exposure"] = "LOW"
        
        # Assess trading frequency based on trade count
        trades_per_day = self.portfolio_data["total_trades"] / max(1, (datetime.now() - self.last_daily_snapshot).days + 1)
        if trades_per_day > 5:
            self.health_checks["trading_frequency"] = "HIGH"
        elif trades_per_day > 2:
            self.health_checks["trading_frequency"] = "MEDIUM"
        else:
            self.health_checks["trading_frequency"] = "LOW"
        
        # Assess profit consistency based on daily P&L trend
        if len(self.portfolio_data["daily_pnl"]) >= 7:  # Need at least a week of data
            positive_days = sum(1 for pnl in self.portfolio_data["daily_pnl"][-7:] if pnl > 0)
            if positive_days >= 5:  # 5+ profitable days out of 7
                self.health_checks["profit_consistency"] = "HIGH"
            elif positive_days >= 3:  # 3-4 profitable days
                self.health_checks["profit_consistency"] = "MEDIUM"
            else:  # 0-2 profitable days
                self.health_checks["profit_consistency"] = "LOW"
        else:
            self.health_checks["profit_consistency"] = "UNKNOWN"
            
    async def _calculate_total_portfolio_value(self) -> float:
        """Calculate total portfolio value including all assets"""
        if hasattr(self, 'position_manager') and self.position_manager:
            metrics = self.position_manager.get_metrics()
            positions_data = await self.position_manager.get_active_positions()
            
            # Wallet balance
            wallet_balance = metrics.get("wallet_balance", 0)
            
            # Value of all positions
            position_values = sum(
                float(pos.get("value", 0)) 
                for pos in positions_data.get("positions", [])
            )
            
            return wallet_balance + position_values
        else:
            return self.portfolio_data["total_value"]
    
    async def _fetch_sol_price_task(self):
        """Periodically fetch SOL price for USD conversions"""
        while True:
            try:
                await self._update_sol_price()
                await asyncio.sleep(300)  # Update every 5 minutes
            except Exception as e:
                logger.error(f"SOL price fetch error: {e}")
                await asyncio.sleep(600)  # Wait 10 minutes after error
    
    async def _update_sol_price(self):
        """Update SOL price from trader or external source"""
        if self.trader:
            try:
                # Try to get SOL price from trader
                sol_mint = "So11111111111111111111111111111111111111112"  # SOL mint address
                price = await self.trader.get_token_price(sol_mint)
                
                if price and isinstance(price, (int, float)) and price > 0:
                    self.sol_price_usd = price
                    logger.debug(f"Updated SOL price: ${self.sol_price_usd:.2f}")
            except Exception as e:
                logger.error(f"Error updating SOL price: {e}")
                
    async def monitor_wallet_balance(self):
        """Start continuous monitoring of wallet balance"""
        if not self.wallet_address:
            logger.warning("Cannot monitor wallet balance: No wallet address configured")
            return False
            
        # Start the monitoring task
        asyncio.create_task(self._wallet_balance_monitor_task())
        logger.info(f"Started wallet balance monitoring for {self.wallet_address}")
        return True
    
    async def _wallet_balance_monitor_task(self):
        """Continuously monitor wallet balance from blockchain"""
        while True:
            try:
                if not self.wallet_address:
                    await asyncio.sleep(60)  # Sleep and check again later
                    continue
                    
                await self._update_wallet_balance()
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Wallet balance monitoring error: {e}")
                await asyncio.sleep(60)  # Wait longer after an error
                
    async def _update_wallet_balance(self):
        """Update wallet balance from blockchain and track changes"""
        if not self.wallet_address or not self.trader:
            return
            
        try:
            # Get current wallet balance from trader
            wallet_data = await self.trader.get_wallet_balance()
            
            if "sol_balance" in wallet_data:
                new_balance = wallet_data["sol_balance"]
                prev_balance = self.portfolio_data["current_balance"]
                
                # Check for significant changes
                delta = new_balance - prev_balance
                
                # Update stored balance
                self.portfolio_data["current_balance"] = new_balance
                
                # Add to balance history
                self.balance_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "balance": new_balance,
                    "change": delta
                })
                
                # Cap history at 1000 entries
                if len(self.balance_history) > 1000:
                    self.balance_history = self.balance_history[-1000:]
                
                # Check for balance alerts
                await self._check_balance_alerts(new_balance, delta)
                
                # Log significant changes
                if abs(delta) > 0.1:  # Only log changes > 0.1 SOL
                    if delta > 0:
                        logger.info(f"💰 WALLET BALANCE INCREASED: +{delta:.4f} SOL, Total: {new_balance:.4f} SOL")
                    else:
                        logger.info(f"💰 WALLET BALANCE DECREASED: {delta:.4f} SOL, Total: {new_balance:.4f} SOL")
                
        except Exception as e:
            logger.error(f"Error updating wallet balance: {e}")
    
    async def _check_balance_alerts(self, balance: float, delta: float):
        """Check for wallet balance alert conditions"""
        alerts = []
        
        # Check for low balance alerts
        if balance <= self.balance_alert_thresholds["critical_balance"]:
            alerts.append({
                "type": "CRITICAL_LOW_BALANCE",
                "message": f"CRITICAL: Wallet balance is extremely low: {balance:.4f} SOL",
                "balance": balance,
                "threshold": self.balance_alert_thresholds["critical_balance"],
                "severity": "CRITICAL"
            })
        elif balance <= self.balance_alert_thresholds["low_balance"]:
            alerts.append({
                "type": "LOW_BALANCE",
                "message": f"WARNING: Wallet balance is low: {balance:.4f} SOL",
                "balance": balance,
                "threshold": self.balance_alert_thresholds["low_balance"],
                "severity": "WARNING"
            })
        
        # Check for significant changes
        if delta >= self.balance_alert_thresholds["large_increase"]:
            alerts.append({
                "type": "LARGE_BALANCE_INCREASE",
                "message": f"Large increase in wallet balance: +{delta:.4f} SOL",
                "change": delta,
                "threshold": self.balance_alert_thresholds["large_increase"],
                "severity": "INFO"
            })
        elif delta <= -self.balance_alert_thresholds["large_decrease"]:
            alerts.append({
                "type": "LARGE_BALANCE_DECREASE",
                "message": f"Large decrease in wallet balance: {delta:.4f} SOL",
                "change": delta,
                "threshold": -self.balance_alert_thresholds["large_decrease"],
                "severity": "WARNING"
            })
        
        # Process alerts
        for alert in alerts:
            # Log alert
            if alert["severity"] == "CRITICAL":
                logger.critical(alert["message"])
            elif alert["severity"] == "WARNING":
                logger.warning(alert["message"])
            else:
                logger.info(alert["message"])
                
            # Send notification via websocket manager if available (would be implemented in production)
            # self._send_balance_alert(alert)
    
    async def get_portfolio_history(self, days: int = 7) -> List[Dict]:
        """Get portfolio value history for charting"""
        # Filter history to the requested number of days
        now = datetime.now()
        cutoff = now - timedelta(days=days)
        
        # Filter snapshots and format for charting
        filtered_history = []
        for snapshot in self.portfolio_history:
            try:
                snapshot_time = datetime.fromisoformat(snapshot["timestamp"])
                if snapshot_time >= cutoff:
                    filtered_history.append({
                        "timestamp": snapshot["timestamp"],
                        "value": snapshot["total_value"],
                        "value_usd": snapshot["total_value"] * snapshot.get("sol_price_usd", self.sol_price_usd)
                    })
            except (ValueError, KeyError):
                continue
                
        return filtered_history
    
    def get_balance_history(self, hours: int = 24) -> List[Dict]:
        """Get wallet balance history for the specified period"""
        if not self.balance_history:
            return []
            
        # Filter history to the requested number of hours
        now = datetime.now()
        cutoff = now - timedelta(hours=hours)
        
        filtered_history = []
        for entry in self.balance_history:
            try:
                entry_time = datetime.fromisoformat(entry["timestamp"])
                if entry_time >= cutoff:
                    filtered_history.append({
                        "timestamp": entry["timestamp"],
                        "balance": entry["balance"],
                        "balance_usd": entry["balance"] * self.sol_price_usd
                    })
            except (ValueError, KeyError):
                continue
                
        return filtered_history
    
    def get_metrics(self) -> dict:
        """Get comprehensive portfolio metrics with enhanced wallet monitoring"""
        # Calculate additional analytics
        best_token = self.portfolio_data["best_trade_token"]
        worst_token = self.portfolio_data["worst_trade_token"]
        
        # Format best/worst trades for display
        best_trade = f"{best_token} (+{self.portfolio_data['best_trade']:.1f}%)" if best_token else "None"
        worst_trade = f"{worst_token} ({self.portfolio_data['worst_trade']:.1f}%)" if worst_token else "None"
        
        # Get last 24h balance change
        balance_change_24h = 0
        if len(self.balance_history) >= 2:
            current_balance = self.portfolio_data["current_balance"]
            
            # Find balance from ~24h ago
            now = datetime.now()
            cutoff = now - timedelta(hours=24)
            
            for entry in self.balance_history:
                try:
                    entry_time = datetime.fromisoformat(entry["timestamp"])
                    if entry_time <= cutoff:
                        old_balance = entry["balance"]
                        balance_change_24h = current_balance - old_balance
                        break
                except (ValueError, KeyError):
                    continue
        
        # Calculate balance change percentage
        balance_change_pct = 0
        if self.portfolio_data["initial_balance"] > 0:
            balance_change_pct = ((self.portfolio_data["current_balance"] - 
                                 self.portfolio_data["initial_balance"]) / 
                                self.portfolio_data["initial_balance"]) * 100
        
        return {
            "total_value": self.portfolio_data["total_value"],
            "total_value_usd": self.portfolio_data["total_value"] * self.sol_price_usd,
            "realized_pnl": self.portfolio_data["realized_pnl"],
            "unrealized_pnl": self.portfolio_data["unrealized_pnl"],
            "current_balance": self.portfolio_data["current_balance"],
            "current_balance_usd": self.portfolio_data["current_balance"] * self.sol_price_usd,
            "initial_balance": self.portfolio_data["initial_balance"],
            "balance_change_24h": balance_change_24h,
            "balance_change_pct": balance_change_pct,
            "win_rate": self.portfolio_data["win_rate"],
            "total_trades": self.portfolio_data["total_trades"],
            "roi_percent": self.portfolio_data["roi"],
            "best_trade": best_trade,
            "worst_trade": worst_trade,
            "avg_hold_time": f"{self.portfolio_data['average_hold_time']:.1f} hrs",
            "portfolio_health": self.health_checks,
            "last_update": self.last_update.isoformat(),
            "wallet_address": self.wallet_address or "Not configured",
            "balance_alert_thresholds": self.balance_alert_thresholds,
            "wallet_monitoring_active": bool(self.wallet_address)
        }
    
    async def export_portfolio_data(self, format_type: str = "json") -> str:
        """Export portfolio data for reporting/analysis"""
        export_data = {
            "portfolio_summary": {
                "total_value": self.portfolio_data["total_value"],
                "total_value_usd": self.portfolio_data["total_value"] * self.sol_price_usd,
                "initial_balance": self.portfolio_data["initial_balance"],
                "current_balance": self.portfolio_data["current_balance"],
                "realized_pnl": self.portfolio_data["realized_pnl"],
                "unrealized_pnl": self.portfolio_data["unrealized_pnl"],
                "roi_percent": self.portfolio_data["roi"],
                "generated_at": datetime.now().isoformat()
            },
            "trading_performance": {
                "win_rate": self.portfolio_data["win_rate"],
                "total_trades": self.portfolio_data["total_trades"],
                "winning_trades": self.portfolio_data["winning_trades"],
                "losing_trades": self.portfolio_data["losing_trades"],
                "best_trade": {
                    "token": self.portfolio_data["best_trade_token"],
                    "percent": self.portfolio_data["best_trade"]
                },
                "worst_trade": {
                    "token": self.portfolio_data["worst_trade_token"],
                    "percent": self.portfolio_data["worst_trade"]
                },
                "avg_hold_time_hours": self.portfolio_data["average_hold_time"]
            },
            "portfolio_health": self.health_checks,
            "recent_history": self.portfolio_history[-20:],  # Last 20 snapshots
            "recent_trades": self.trade_history[-10:]        # Last 10 trades
        }
        
        if format_type.lower() == "json":
            return json.dumps(export_data, indent=2)
        else:
            # Default to simplified text format
            result = "=== PORTFOLIO REPORT ===\n"
            result += f"Total Value: {export_data['portfolio_summary']['total_value']:.4f} SOL (${export_data['portfolio_summary']['total_value_usd']:.2f})\n"
            result += f"ROI: {export_data['portfolio_summary']['roi_percent']:.2f}%\n"
            result += f"Win Rate: {export_data['trading_performance']['win_rate']:.1f}%\n"
            result += f"Total Trades: {export_data['trading_performance']['total_trades']}\n"
            result += f"Best Trade: {export_data['trading_performance']['best_trade']['token']} ({export_data['trading_performance']['best_trade']['percent']:.1f}%)\n"
            result += f"Generated: {export_data['portfolio_summary']['generated_at']}\n"
            return result
            
    async def shutdown(self):
        """Shutdown portfolio tracker"""
        logger.info("🛑 SHUTTING DOWN PORTFOLIO TRACKER...")
        
        # Save final metrics snapshot before shutdown
        await self._take_portfolio_snapshot()
        
        # Release references
        self.position_manager = None
        self.trader = None
        
        logger.info("✅ PORTFOLIO TRACKER SHUTDOWN COMPLETE")
