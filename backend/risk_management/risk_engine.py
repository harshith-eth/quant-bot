"""
RISK ENGINE - THE PORTFOLIO PROTECTOR
====================================
Advanced risk management to protect from rugs and losses.
Because losing money is not based.
"""

import asyncio
import logging
import random
import math
from datetime import datetime
from typing import Dict, List, Optional

from core.config import settings, real_trading_config

logger = logging.getLogger("RISK_ENGINE")

class RiskEngine:
    """Advanced risk management and protection system"""
    
    def __init__(self):
        self.risk_metrics = {
            "portfolio_risk": 23.4,
            "var_1d": 2.7,
            "max_drawdown": 12.4,
            "exposure_ratio": 67.8,
            "correlation_risk": "MEDIUM",
            "liquidity_risk": "LOW",
            "volatility_metrics": {}
        }
        self.risk_alerts = []
        self.last_assessment = datetime.now()
        self.position_manager = None
        self.websocket_manager = None
        self.emergency_stop_triggered = False
        self.emergency_stop_reasons = []
        self.volatility_window = 14  # Days for volatility calculation
        self.max_portfolio_risk = real_trading_config.MAX_PORTFOLIO_RISK
        
        # Emergency stop thresholds
        self.emergency_thresholds = {
            "portfolio_drawdown": real_trading_config.EMERGENCY_EXIT_THRESHOLD,  # Default -50%
            "max_risk_level": 70,        # Max portfolio risk score
            "max_exposure": 90,          # Max portfolio exposure percentage
            "liquidity_crisis": 0.3,     # Min liquidity ratio
            "rapid_value_decline": 25,   # Max % decline in portfolio in 1 hour
        }
        
        logger.info("🛡️ RISK ENGINE INITIALIZED")
    
    async def initialize(self):
        """Initialize risk engine"""
        logger.info("🚀 INITIALIZING RISK ENGINE...")
        asyncio.create_task(self._monitor_risk())
        logger.info("✅ RISK ENGINE ONLINE")
    
    def get_risk_metrics(self) -> dict:
        """Get risk metrics in the exact format required"""
        # Calculate position limits based on risk metrics and volatility
        position_limits = self.calculate_position_limits()
        
        # Generate dynamic stop-loss recommendations
        stop_losses = self.generate_stop_loss_recommendations()
        
        # Calculate overall risk score
        risk_score = self.risk_metrics["portfolio_risk"] / 100
        
        return {
            "risk": {
                "portfolio_risk": risk_score,
                "position_limits": position_limits,
                "stop_losses": stop_losses,
                "risk_score": risk_score,
                "emergency_stop": self.emergency_stop_triggered,
                "portfolio_exposure": self.risk_metrics["exposure_ratio"] / 100
            }
        }
    
    async def _update_risk_metrics(self):
        """Update risk metrics based on real portfolio data"""
        try:
            # If position manager is available, get real portfolio data
            if hasattr(self, 'position_manager') and self.position_manager:
                metrics = self.position_manager.get_metrics()
                positions_data = await self.position_manager.get_active_positions()
                
                # Calculate portfolio exposure
                wallet_balance = metrics.get("wallet_balance", 10.0)  # Default to 10 SOL if not available
                total_invested = sum(
                    float(pos.get("size", 0)) 
                    for pos in positions_data.get("positions", [])
                )
                
                if wallet_balance > 0:
                    exposure_ratio = (total_invested / wallet_balance) * 100
                    self.risk_metrics["exposure_ratio"] = exposure_ratio
                
                # Update volatility metrics for active tokens
                for position in positions_data.get("positions", []):
                    token_symbol = position.get("symbol")
                    if token_symbol:
                        # In a real system, you would fetch historical price data
                        # For now, simulate volatility between 15% and 80%
                        self.risk_metrics["volatility_metrics"][token_symbol] = random.uniform(15, 80)
            else:
                # Simulate risk metric changes for development
                self.risk_metrics["portfolio_risk"] += random.uniform(-2, 2)
                self.risk_metrics["portfolio_risk"] = max(5, min(80, self.risk_metrics["portfolio_risk"]))
                
                self.risk_metrics["var_1d"] = random.uniform(1.5, 4.0)
                self.risk_metrics["exposure_ratio"] += random.uniform(-5, 5)
                self.risk_metrics["exposure_ratio"] = max(20, min(90, self.risk_metrics["exposure_ratio"]))
                
                # Simulate volatility metrics for common tokens
                tokens = ["BONK", "WIF", "BOME", "SOL"]
                for token in tokens:
                    self.risk_metrics["volatility_metrics"][token] = random.uniform(15, 80)
            
            # Update risk alerts
            self._check_risk_alerts()
            
            self.last_assessment = datetime.now()
            
        except Exception as e:
            logger.error(f"Error updating risk metrics: {e}")
    
    def _get_risk_level(self) -> str:
        """Determine overall risk level"""
        risk = self.risk_metrics["portfolio_risk"]
        if risk < 20:
            return "LOW"
        elif risk < 40:
            return "MEDIUM"
        elif risk < 60:
            return "HIGH"
        else:
            return "EXTREME"
    
    def _check_risk_alerts(self):
        """Check for risk alerts"""
        self.risk_alerts = []
        
        if self.risk_metrics["portfolio_risk"] > 50:
            self.risk_alerts.append({
                "type": "HIGH_RISK",
                "message": "Portfolio risk exceeds 50%",
                "severity": "HIGH"
            })
        
        if self.risk_metrics["exposure_ratio"] > 80:
            self.risk_alerts.append({
                "type": "OVEREXPOSURE",
                "message": "High market exposure detected",
                "severity": "MEDIUM"
            })
    
    def _get_risk_recommendations(self) -> List[str]:
        """Get risk management recommendations"""
        recommendations = []
        
        if self.risk_metrics["portfolio_risk"] > 40:
            recommendations.append("Consider reducing position sizes")
        
        if self.risk_metrics["exposure_ratio"] > 75:
            recommendations.append("Reduce overall market exposure")
        
        recommendations.append("Maintain stop-loss orders")
        recommendations.append("Monitor correlation between positions")
        
        return recommendations
    
    async def evaluate_token_risk(self, token: dict) -> float:
        """Evaluate risk score for a token with enhanced risk factors"""
        risk_score = 0.3  # Base risk
        
        # Liquidity risk
        liquidity = token.get("liquidity", 0)
        if liquidity < 5000:
            risk_score += 0.3
        elif liquidity < 10000:
            risk_score += 0.2
        
        # Market cap risk
        mc_str = token.get("market_cap", "$100K")
        try:
            # Handle different market cap formats
            if isinstance(mc_str, str):
                mc_str = mc_str.upper().replace("$", "")
                if "M" in mc_str:
                    mc_value = float(mc_str.replace("M", "")) * 1000000
                elif "K" in mc_str:
                    mc_value = float(mc_str.replace("K", "")) * 1000
                else:
                    mc_value = float(mc_str)
            else:
                mc_value = float(mc_str if mc_str else 100000)
                
            if mc_value < 50000:
                risk_score += 0.2
            elif mc_value < 250000:
                risk_score += 0.1
        except (ValueError, TypeError):
            risk_score += 0.2  # Default to higher risk if can't parse
        
        # Holder risk
        holders = token.get("holders", 100)
        if holders < 50:
            risk_score += 0.15
        elif holders < 200:
            risk_score += 0.1
            
        # Volatility risk
        volatility = token.get("volatility")
        token_symbol = token.get("symbol", "UNKNOWN")
        if not volatility:
            # Try to get volatility from our internal metrics
            volatility = self.risk_metrics["volatility_metrics"].get(token_symbol, 50)
            
        if volatility > 60:  # Very high volatility
            risk_score += 0.25
        elif volatility > 40:  # High volatility
            risk_score += 0.15
        
        # Age risk - newer tokens are riskier
        age_days = token.get("age_days", 30)
        if age_days < 7:  # Less than a week old
            risk_score += 0.25
        elif age_days < 30:  # Less than a month old
            risk_score += 0.15
        
        return min(1.0, risk_score)
    
    async def analyze_portfolio_risk(self) -> dict:
        """Analyze overall portfolio risk with advanced metrics and emergency detection"""
        await self._update_risk_metrics()
        
        # Check for emergency exit conditions with detailed analysis
        emergency_check = self.check_emergency_exit_conditions()
        
        # Automatically trigger emergency stop if conditions met
        if emergency_check["emergency_exit"] and not self.emergency_stop_triggered:
            logger.critical(f"🚨 EMERGENCY CONDITION DETECTED: {emergency_check['reason']}")
            # Don't await the trigger here, just schedule it to avoid blocking
            asyncio.create_task(self.trigger_emergency_stop(emergency_check["reason"]))
        
        # Prepare risk recommendations
        recommendations = self._get_risk_recommendations()
        
        # Add emergency-specific recommendations if nearing thresholds
        if self.risk_metrics["portfolio_risk"] > self.emergency_thresholds["max_risk_level"] * 0.8:
            recommendations.append("URGENT: Reduce overall portfolio risk immediately")
            
        if self.risk_metrics["exposure_ratio"] > self.emergency_thresholds["max_exposure"] * 0.8:
            recommendations.append("URGENT: Lower portfolio exposure to prevent automatic exit")
        
        return {
            "emergency_exit": emergency_check["emergency_exit"],
            "emergency_reason": emergency_check["reason"],
            "emergency_severity": emergency_check["severity"],
            "emergency_triggered": self.emergency_stop_triggered,
            "emergency_history": self.emergency_stop_reasons[-5:] if self.emergency_stop_reasons else [],
            "risk_level": self._get_risk_level(),
            "exposure_level": self._get_exposure_level(),
            "recommendations": recommendations,
            "position_limits": self.calculate_position_limits(),
            "alerts": len(self.risk_alerts)
        }
    
    async def _monitor_risk(self):
        """Continuous risk monitoring"""
        while True:
            try:
                await self._update_risk_metrics()
                await asyncio.sleep(20)
            except Exception as e:
                logger.error(f"Risk monitoring error: {e}")
                await asyncio.sleep(40)
    
    def calculate_position_limits(self) -> dict:
        """Calculate dynamic position size limits based on volatility"""
        # Get base position limits from config
        base_max_position = real_trading_config.MAX_POSITION_SIZE
        
        # Calculate risk-adjusted position size
        risk_adjusted_size = base_max_position * (1 - (self.risk_metrics["portfolio_risk"] / 100))
        
        # Ensure minimum position size
        risk_adjusted_size = max(real_trading_config.MIN_TRADE_SIZE, risk_adjusted_size)
        
        return {
            "max_position_size": round(risk_adjusted_size, 2),  # Maximum position size in SOL
            "max_token_exposure": round(self.max_portfolio_risk / 3, 2),  # Maximum exposure to a single token
            "max_portfolio_risk": self.max_portfolio_risk,  # Maximum overall portfolio risk
            "risk_factor": round(self.risk_metrics["portfolio_risk"] / 100, 2)
        }
    
    def calculate_position_size_for_token(self, token_symbol: str, wallet_balance: float) -> float:
        """Calculate optimal position size based on token volatility and wallet balance"""
        # Get token volatility
        volatility = self.risk_metrics["volatility_metrics"].get(token_symbol, 50)  # Default 50% if unknown
        
        # Kelly criterion for position sizing (simplified)
        # Lower volatility = larger position size, higher volatility = smaller position
        # Formula: position_size = wallet_balance * (1 / volatility_factor)
        volatility_factor = max(2, volatility / 10)  # Scale volatility to reasonable range
        
        # Calculate position size based on volatility and wallet balance
        position_size = wallet_balance / volatility_factor
        
        # Get position limits
        position_limits = self.calculate_position_limits()
        max_position = position_limits["max_position_size"]
        
        # Cap position size to max position limit
        position_size = min(position_size, max_position)
        
        # Ensure minimum position size
        position_size = max(real_trading_config.MIN_TRADE_SIZE, position_size)
        
        return round(position_size, 2)
    
    def generate_stop_loss_recommendations(self) -> List[dict]:
        """Generate dynamic stop-loss recommendations based on volatility"""
        stop_losses = []
        
        # Dynamic stop-loss calculation for known tokens
        for token, volatility in self.risk_metrics["volatility_metrics"].items():
            # Higher volatility = tighter stop-loss
            stop_loss_pct = min(50, max(15, volatility / 2))  # Between 15-50%
            
            # Simulate entry and current prices
            entry_price = random.uniform(0.00001, 10.0)
            price_change = random.uniform(-0.1, 0.1)  # -10% to +10%
            current_price = entry_price * (1 + price_change)
            stop_loss_price = entry_price * (1 - stop_loss_pct / 100)
            
            stop_losses.append({
                "symbol": token,
                "entry_price": round(entry_price, 6),
                "current_price": round(current_price, 6),
                "stop_loss": round(stop_loss_price, 6),
                "stop_loss_pct": round(stop_loss_pct, 1)
            })
        
        return stop_losses
    
    def check_emergency_exit_conditions(self) -> dict:
        """Check if emergency exit conditions are met with detailed reason"""
        result = {
            "emergency_exit": False,
            "reason": None,
            "severity": "NORMAL"
        }
        
        try:
            # Portfolio risk exceeds threshold
            if self.risk_metrics["portfolio_risk"] > self.emergency_thresholds["max_risk_level"]:
                result["emergency_exit"] = True
                result["reason"] = f"Portfolio risk critical: {self.risk_metrics['portfolio_risk']:.1f}%" 
                result["severity"] = "CRITICAL"
            
            # Portfolio exposure ratio exceeds threshold
            if self.risk_metrics["exposure_ratio"] > self.emergency_thresholds["max_exposure"]:
                result["emergency_exit"] = True
                result["reason"] = f"Portfolio exposure critical: {self.risk_metrics['exposure_ratio']:.1f}%"
                result["severity"] = "CRITICAL"
            
            # Check for P/L based emergency exit
            if hasattr(self, 'position_manager') and self.position_manager:
                metrics = self.position_manager.get_metrics()
                total_pl = metrics.get("total_pl", 0)
                wallet_balance = metrics.get("wallet_balance", 1)
                
                if wallet_balance > 0:
                    pl_percent = (total_pl / wallet_balance) * 100
                    
                    # Emergency exit if P/L drops below threshold
                    if pl_percent < self.emergency_thresholds["portfolio_drawdown"]:
                        result["emergency_exit"] = True
                        result["reason"] = f"Critical portfolio drawdown: {pl_percent:.1f}%"
                        result["severity"] = "CRITICAL"
            
            # Check for extreme market volatility (simulated)
            # In production, this would use real market data
            avg_volatility = sum(self.risk_metrics["volatility_metrics"].values()) / max(len(self.risk_metrics["volatility_metrics"]), 1)
            if avg_volatility > 80:  # Extreme volatility across portfolio
                result["emergency_exit"] = True
                result["reason"] = f"Extreme market volatility detected: {avg_volatility:.1f}%"
                result["severity"] = "HIGH"
                
            # Check for sudden large movements in portfolio value (simulated)
            # In production, this would track real-time portfolio changes
            if hasattr(self, 'rapid_value_decline') and self.rapid_value_decline > self.emergency_thresholds["rapid_value_decline"]:
                result["emergency_exit"] = True
                result["reason"] = f"Rapid portfolio decline: {self.rapid_value_decline:.1f}% in short timeframe"
                result["severity"] = "CRITICAL"
                
            # Update emergency stop status if conditions are met
            if result["emergency_exit"] and not self.emergency_stop_triggered:
                self.emergency_stop_triggered = True
                
        except Exception as e:
            logger.error(f"Error checking emergency conditions: {e}")
            
        return result
    
    def _get_exposure_level(self) -> str:
        """Determine current portfolio exposure level"""
        exposure = self.risk_metrics["exposure_ratio"]
        
        if exposure < 30:
            return "LOW"
        elif exposure < 60:
            return "MEDIUM"
        elif exposure < 80:
            return "HIGH"
        else:
            return "EXTREME"
    
    def get_metrics(self) -> dict:
        """Get risk engine metrics with enhanced data including emergency status"""
        # Calculate average volatility
        volatility_values = list(self.risk_metrics["volatility_metrics"].values())
        volatility_avg = sum(volatility_values) / max(len(volatility_values), 1) if volatility_values else 0
        
        # Get emergency reason if triggered
        emergency_reason = self.emergency_stop_reasons[-1]["reason"] if self.emergency_stop_triggered and self.emergency_stop_reasons else None
        
        return {
            "portfolio_risk": self.risk_metrics["portfolio_risk"],
            "risk_level": self._get_risk_level(),
            "exposure_level": self._get_exposure_level(), 
            "exposure_ratio": self.risk_metrics["exposure_ratio"],
            "volatility_avg": volatility_avg,
            "emergency_stop": self.emergency_stop_triggered,
            "emergency_reason": emergency_reason,
            "active_alerts": len(self.risk_alerts),
            "position_sizing": "volatility-based",
            "max_drawdown": self.risk_metrics["max_drawdown"],
            "var_1d": self.risk_metrics["var_1d"],
            "last_assessment": self.last_assessment.isoformat()
        }
    
    async def set_position_manager(self, position_manager):
        """Set the position manager for real portfolio data"""
        self.position_manager = position_manager
        logger.info("✅ Position manager connected to risk engine")
        
    async def set_websocket_manager(self, ws_manager):
        """Set the WebSocket manager for dashboard notifications"""
        self.websocket_manager = ws_manager
        logger.info("✅ WebSocket manager connected to risk engine")
        
    async def send_emergency_notification(self, message: str, level: str = "CRITICAL"):
        """Send emergency notification to the dashboard"""
        if not self.websocket_manager:
            logger.warning("Cannot send notification: WebSocket manager not available")
            return False
            
        try:
            notification = {
                "type": "emergency_alert",
                "message": message,
                "level": level,
                "timestamp": datetime.now().isoformat()
            }
            
            # In a real implementation, this would send to the websocket manager
            # For now, just log it
            logger.critical(f"EMERGENCY NOTIFICATION: {message}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send emergency notification: {e}")
            return False
    
    async def trigger_emergency_stop(self, reason: str) -> bool:
        """Trigger emergency stop and execute portfolio protection measures"""
        if self.emergency_stop_triggered:
            # Already triggered, add reason to list
            self.emergency_stop_reasons.append({
                "reason": reason,
                "timestamp": datetime.now().isoformat()
            })
            return False
            
        logger.warning(f"🚨 EMERGENCY STOP TRIGGERED: {reason}")
        self.emergency_stop_triggered = True
        self.emergency_stop_reasons.append({
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        })
        
        # Send emergency notification
        await self.send_emergency_notification(f"EMERGENCY STOP: {reason}")
        
        # Execute emergency exit if position manager is available
        if self.position_manager:
            try:
                # Log emergency action to risk alerts
                self.risk_alerts.append({
                    "type": "EMERGENCY_EXIT",
                    "message": f"Emergency exit triggered: {reason}",
                    "severity": "CRITICAL",
                    "timestamp": datetime.now().isoformat()
                })
                
                # Execute actual emergency exit
                await self.position_manager.emergency_exit_all()
                logger.info("✅ Emergency exit executed")
                
                # Record execution in risk metrics
                self.risk_metrics["last_emergency_exit"] = datetime.now().isoformat()
                
                return True
            except Exception as e:
                logger.error(f"Emergency exit execution failed: {e}")
                await self.send_emergency_notification(
                    f"Emergency exit FAILED: {e}", 
                    level="CRITICAL"
                )
                return False
        else:
            logger.warning("⚠️ Position manager not available for emergency exit")
            await self.send_emergency_notification(
                "Emergency exit failed: Position manager not available", 
                level="CRITICAL"
            )
            return False
    
    async def reset_emergency_stop(self, admin_id: str = None) -> bool:
        """Reset emergency stop flag after manual review by admin"""
        if not self.emergency_stop_triggered:
            logger.info("No emergency stop active to reset")
            return False
            
        # Log the reset action with admin ID if provided
        reset_message = "Emergency stop reset"
        if admin_id:
            reset_message += f" by admin {admin_id}"
            
        logger.info(f"✅ {reset_message}")
        
        # Reset the emergency state
        self.emergency_stop_triggered = False
        
        # Add reset confirmation to alerts
        self.risk_alerts.append({
            "type": "EMERGENCY_RESET",
            "message": reset_message,
            "severity": "HIGH",
            "timestamp": datetime.now().isoformat()
        })
        
        # Notify dashboard
        await self.send_emergency_notification(
            f"EMERGENCY PROTOCOLS RESET: System returning to normal operation",
            level="WARNING"
        )
        
        return True
    
    async def shutdown(self):
        """Shutdown risk engine"""
        logger.info("🛑 SHUTTING DOWN RISK ENGINE...")
        self.emergency_stop_triggered = False
        self.position_manager = None
        logger.info("✅ RISK ENGINE SHUTDOWN COMPLETE")
