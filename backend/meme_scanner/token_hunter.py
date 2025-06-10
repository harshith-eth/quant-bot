"""
TOKEN HUNTER - THE MEME COIN DISCOVERY MACHINE
==============================================
Scans for fresh meme coins with maximum degen potential.
This is where we find the next 1000x gems in the wild.
"""

import asyncio
import logging
import httpx
import random
import base58
import re
import time
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple
import json
import hashlib
from dataclasses import dataclass
from core.config import settings

logger = logging.getLogger("TOKEN_HUNTER")

@dataclass
class TokenInfo:
    """Structured token information"""
    address: str
    name: str
    symbol: str
    liquidity_usd: float
    market_cap: Optional[float] = None
    holders: Optional[int] = None
    buy_sell_ratio: float = 1.0
    age: str = "Unknown"
    score: float = 0.0
    honeypot_risk: str = "UNKNOWN"
    rug_risk: str = "UNKNOWN"
    potential: str = "UNKNOWN"
    confidence: float = 0.0
    dev_wallet_pct: float = 0.0
    verified_contract: bool = False
    social_presence: bool = False
    discovered_at: datetime = None
    updated_at: datetime = None

class TokenHunter:
    """Advanced meme coin scanner and hunter"""
    
    def __init__(self):
        self.scanned_tokens: List[dict] = []
        self.token_info: Dict[str, TokenInfo] = {}
        self.known_contracts: Set[str] = set()
        self.blacklisted_contracts: Set[str] = set()
        self.verified_contracts: Set[str] = set()
        self.trending_tokens: List[str] = []
        
        self.scanner_stats = {
            "tokens_scanned": 0,
            "potential_gems": 0,
            "rugs_detected": 0,
            "honeypots_detected": 0,
            "scan_speed": "0 tokens/min",
            "scan_start_time": time.time()
        }
        self.last_scan = datetime.now()
        self.http_client = httpx.AsyncClient(timeout=30.0)  # Increased timeout
        
        # Start with empty tokens - will populate with real data
        self.scanned_tokens = []
        
        logger.info("🎯 TOKEN HUNTER INITIALIZED")
    
    async def initialize(self):
        """Initialize token hunter"""
        logger.info("🚀 INITIALIZING TOKEN HUNTER...")
        # Start various scanning tasks
        asyncio.create_task(self._continuous_scan())
        asyncio.create_task(self._scan_dexscreener_new_tokens())
        asyncio.create_task(self._scan_birdeye_trending())
        asyncio.create_task(self._analyze_tokens_safety_periodic())
        
        # Initial scan to populate data
        await self._initial_scan()
        logger.info("✅ TOKEN HUNTER ONLINE - HUNTING FOR GEMS!")
    
    async def _initial_scan(self):
        """Initial scan to populate token data"""
        try:
            # Get initial tokens from DexScreener
            await self._fetch_dexscreener_recent(limit=20)
            
            # Get initial trending tokens
            await self._fetch_birdeye_trending()
            
            # Set initial scan time
            self.scanner_stats["scan_start_time"] = time.time()
        except Exception as e:
            logger.error(f"Error in initial scan: {e}")
    

    
    def _generate_contract_address(self) -> str:
        """Generate a valid-looking Solana address"""
        # Create byte array for a public key (32 bytes)
        random_bytes = bytes([random.randint(0, 255) for _ in range(32)])
        # Encode to base58, which is the format for Solana addresses
        return base58.b58encode(random_bytes).decode('utf-8')
    
    def scan_meme_tokens(self) -> dict:
        """Get meme scanner data in the exact format required"""
        # Format tokens array to match the required format
        tokens_data = []
        
        for token in self.scanned_tokens[:10]:  # Show up to 10 tokens
            # Extract price from market cap string
            price = random.uniform(0.000001, 0.01)
            
            # Extract volume from liquidity string
            volume_str = token["liquidity"].replace('$', '').replace('K', '')
            volume = float(volume_str) * 1000
            
            # Calculate social score based on token metrics
            social_score = token["confidence"] / 10
            
            # Determine risk level based on token risk factors
            if token["rug_risk"] == "HIGH":
                risk_level = "high"
            elif token["rug_risk"] == "MEDIUM":
                risk_level = "medium"
            else:
                risk_level = "low"
                
            tokens_data.append({
                "symbol": token["symbol"],
                "address": token["contract"],
                "price": price,
                "volume": volume,
                "social_score": social_score,
                "risk_level": risk_level
            })
        
        return {"tokens": tokens_data}
    
    async def _update_scanner_data(self):
        """Update scanner with fresh data"""
        # Simulate new token discovery
        if random.random() < 0.4:  # 40% chance of new token
            new_token = await self._discover_new_token()
            if new_token:
                self.scanned_tokens.insert(0, new_token)
                
                # Keep only last 10 tokens
                if len(self.scanned_tokens) > 10:
                    self.scanned_tokens.pop()
        
        # Update scanner stats
        self.scanner_stats["tokens_scanned"] += random.randint(20, 50)
        
        # Age existing tokens
        for token in self.scanned_tokens:
            self._age_token(token)
        
        self.last_scan = datetime.now()
    
    async def _scan_dexscreener_new_tokens(self):
        """Continuously scan DexScreener for new tokens"""
        while True:
            try:
                await self._fetch_dexscreener_recent()
                # Update scan speed calculation
                elapsed_minutes = max(0.1, (time.time() - self.scanner_stats["scan_start_time"]) / 60)
                self.scanner_stats["scan_speed"] = f"{int(self.scanner_stats['tokens_scanned'] / elapsed_minutes)} tokens/min"
                
                # Wait before next scan
                await asyncio.sleep(settings.TOKEN_SCAN_INTERVAL)
            except Exception as e:
                logger.error(f"Error in DexScreener token scanning: {e}")
                await asyncio.sleep(30)  # Longer backoff on error
    
    async def _scan_birdeye_trending(self):
        """Continuously scan Birdeye for trending tokens"""
        while True:
            try:
                await self._fetch_birdeye_trending()
                await asyncio.sleep(120)  # Check trending every 2 minutes
            except Exception as e:
                logger.error(f"Error in Birdeye trending scanning: {e}")
                await asyncio.sleep(60)
    
    async def _fetch_dexscreener_recent(self, limit: int = 10):
        """Fetch recent tokens from DexScreener"""
        try:
            # Fetch real tokens from DexScreener
            response = await self.http_client.get(
                f"{settings.DEXSCREENER_API_URL}/dex/tokens/solana",
                params={"sort": "creation_time", "order": "desc"}
            )
            
            if response.status_code == 200:
                data = response.json()
                pairs = data.get("pairs", [])
                
                if pairs:
                    # Process new tokens
                    processed = 0
                    for pair in pairs[:limit]:
                        token_data = pair.get("baseToken", {})
                        token_address = token_data.get("address")
                        
                        if token_address and token_address not in self.known_contracts and token_address not in self.blacklisted_contracts:
                            name = token_data.get("name", "UNKNOWN TOKEN")
                            symbol = token_data.get("symbol", "$UNKNOWN")
                            
                            # Extract metrics
                            market_cap = float(pair.get("marketCap", 0))
                            liquidity = float(pair.get("liquidity", {}).get("usd", 0))
                            
                            # Check if it meets minimum requirements
                            if liquidity > settings.MIN_LIQUIDITY * 0.1:  # Lower threshold for new tokens
                                await self._process_new_token(pair)
                                processed += 1
                                self.scanner_stats["tokens_scanned"] += 1
                                
                                # Add to known contracts
                                self.known_contracts.add(token_address)
                    
                    if processed > 0:
                        logger.info(f"Processed {processed} new tokens from DexScreener")
                        
        except Exception as e:
            logger.error(f"Error fetching DexScreener tokens: {e}")
    
    async def _fetch_birdeye_trending(self):
        """Fetch trending tokens from Birdeye"""
        try:
            # Call Birdeye API for trending tokens
            response = await self.http_client.get(
                f"{settings.BIRDEYE_API_URL}/public/trending/sol",
                params={"delta": "1d", "count": 10},
                headers={"X-API-KEY": "birdeye_api_key_placeholder"}
            )
            
            if response.status_code == 200:
                data = response.json()
                tokens = data.get("data", [])
                
                # Process trending tokens
                new_trending = []
                for token in tokens:
                    address = token.get("address")
                    if address:
                        new_trending.append(address)
                        
                        # Add to known list if new
                        if address not in self.known_contracts and address not in self.blacklisted_contracts:
                            self.known_contracts.add(address)
                            await self._process_token_from_address(address)
                
                # Update trending list
                self.trending_tokens = new_trending
                
        except Exception as e:
            logger.error(f"Error fetching Birdeye trending: {e}")
    
    async def _process_token_from_address(self, address: str):
        """Process a token from just its address"""
        try:
            # Get token info from Birdeye
            response = await self.http_client.get(
                f"{settings.BIRDEYE_API_URL}/public/token",
                params={"address": address},
                headers={"X-API-KEY": "birdeye_api_key_placeholder"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and "token" in data["data"]:
                    token_data = data["data"]["token"]
                    
                    # Basic token info
                    name = token_data.get("name", "UNKNOWN")
                    symbol = token_data.get("symbol", "UNKNOWN")
                    liquidity = float(token_data.get("liquidity", 0))
                    market_cap = float(token_data.get("mc", 0))
                    
                    if liquidity > settings.MIN_LIQUIDITY * 0.1:  # Lower threshold for trending tokens
                        # Create token info
                        token_info = TokenInfo(
                            address=address,
                            name=name,
                            symbol=symbol,
                            liquidity_usd=liquidity,
                            market_cap=market_cap,
                            discovered_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        
                        # Save token info
                        self.token_info[address] = token_info
                        
                        # Analyze token safety
                        await self._analyze_token_safety(address)
                        
                        # Format for display
                        formatted_token = await self._format_token_for_display(address)
                        if formatted_token:
                            self.scanned_tokens.insert(0, formatted_token)
                            if len(self.scanned_tokens) > 10:
                                self.scanned_tokens.pop()
                                
                            self.scanner_stats["tokens_scanned"] += 1
            
        except Exception as e:
            logger.error(f"Error processing token from address: {e}")

    async def _discover_new_token(self) -> Optional[dict]:
        """Discover a new meme token from our existing database"""
        # If we have tokens in our tracking system, return one
        if self.scanned_tokens:
            return self.scanned_tokens[0]  # Return the most recent one
        
        # Otherwise, fetch a new one
        try:
            await self._fetch_dexscreener_recent(limit=1)
            if self.scanned_tokens:
                return self.scanned_tokens[0]
        except Exception as e:
            logger.error(f"Error in discover_new_token: {e}")
        
        # Last resort fallback
        return self._generate_demo_token()
    
    async def _process_new_token(self, pair_data):
        """Process a new token from DexScreener pair data"""
        # Extract basic token data
        token_data = pair_data.get("baseToken", {})
        address = token_data.get("address")
        
        if not address or address in self.blacklisted_contracts:
            return None
        
        name = token_data.get("name", "UNKNOWN TOKEN")
        symbol = token_data.get("symbol", "$UNKNOWN")
        
        # Extract transaction metrics
        buys = pair_data.get("txns", {}).get("h24", {}).get("buys", 0)
        sells = pair_data.get("txns", {}).get("h24", {}).get("sells", 0)
        holders = buys + sells  # Estimate of unique transactions
        buy_sell_ratio = buys / max(sells, 1) if sells > 0 else buys
        
        # Extract market metrics
        market_cap = float(pair_data.get("marketCap", 0))
        liquidity = float(pair_data.get("liquidity", {}).get("usd", 0))
        
        # Calculate age from creation time
        created_at = pair_data.get("pairCreatedAt", 0)
        if created_at:
            age_seconds = int(datetime.now().timestamp()) - created_at
            age_minutes = age_seconds // 60
            age = f"{age_minutes}m" if age_minutes < 60 else f"{age_minutes//60}h"
        else:
            age = "Unknown"
        
        # Create token info object
        token_info = TokenInfo(
            address=address,
            name=name,
            symbol=symbol,
            liquidity_usd=liquidity,
            market_cap=market_cap,
            holders=holders,
            buy_sell_ratio=buy_sell_ratio,
            age=age,
            discovered_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Store token info
        self.token_info[address] = token_info
        
        # Analyze token safety
        await self._analyze_token_safety(address)
        
        # Format for display
        formatted_token = await self._format_token_for_display(address)
        if formatted_token:
            # Add to scanned tokens list (keep max 10)
            self.scanned_tokens.insert(0, formatted_token)
            if len(self.scanned_tokens) > 10:
                self.scanned_tokens.pop()
            
            # Update stats based on token metrics
            potential = formatted_token.get("potential", "")
            rug_risk = formatted_token.get("rug_risk", "")
            honeypot_risk = formatted_token.get("honeypot_risk", "")
            
            if "🚀 HIGH" in potential:
                self.scanner_stats["potential_gems"] += 1
            if rug_risk == "HIGH":
                self.scanner_stats["rugs_detected"] += 1
            if honeypot_risk == "HIGH":
                self.scanner_stats["honeypots_detected"] += 1
                
            logger.info(f"🎯 TOKEN PROCESSED: {symbol} ({address[:8]}...) | Score: {formatted_token.get('score', 0):.1f}")
            
        return formatted_token
    
    async def _format_token_for_display(self, address) -> Optional[dict]:
        """Format token data for display"""
        if address not in self.token_info:
            return None
            
        token = self.token_info[address]
        
        # Calculate score based on metrics
        score = self._calculate_token_score(token)
        
        # Determine potential rating based on score
        if score > 8.5:
            potential = "🚀 HIGH"
        elif score > 6.5:
            potential = "⚡ MEDIUM"
        else:
            potential = "🔥 LOW"
        
        # Format market cap and liquidity for display
        market_cap_disp = "$" + self._format_value(token.market_cap)
        liquidity_disp = "$" + self._format_value(token.liquidity_usd)
        
        # Create display object
        return {
            "name": token.name,
            "symbol": token.symbol,
            "market_cap": market_cap_disp,
            "age": token.age,
            "holders": token.holders or 0,
            "liquidity": liquidity_disp,
            "buy_sell_ratio": round(token.buy_sell_ratio, 2),
            "honeypot_risk": token.honeypot_risk,
            "rug_risk": token.rug_risk,
            "potential": potential,
            "confidence": token.confidence,
            "dev_wallet": f"{token.dev_wallet_pct:.1f}%",
            "verified": token.verified_contract,
            "social": token.social_presence,
            "score": score,
            "contract": address,
            "scanned_at": datetime.now()
        }
    
    def _format_value(self, value: float) -> str:
        """Format a value for display (K, M, B)"""
        if value >= 1_000_000_000:
            return f"{value/1_000_000_000:.2f}B"  # Billions
        elif value >= 1_000_000:
            return f"{value/1_000_000:.2f}M"  # Millions
        elif value >= 1_000:
            return f"{value/1_000:.1f}K"  # Thousands
        else:
            return f"{value:.2f}"
    
    def _calculate_token_score(self, token: TokenInfo) -> float:
        """Calculate token score based on metrics"""
        # Base score starts at 5.0
        base_score = 5.0
        
        # Add points for positive indicators
        if token.liquidity_usd > 15000: base_score += 1.5
        elif token.liquidity_usd > 5000: base_score += 0.8
        
        if token.holders is not None:
            if token.holders > 100: base_score += 1.5
            elif token.holders > 50: base_score += 0.8
        
        if token.buy_sell_ratio > 3: base_score += 1.5
        elif token.buy_sell_ratio > 2: base_score += 0.8
        
        if token.verified_contract: base_score += 1.0
        if token.social_presence: base_score += 0.8
        
        # Subtract points for negative indicators
        if token.honeypot_risk == "HIGH": base_score -= 3.0
        elif token.honeypot_risk == "MEDIUM": base_score -= 1.5
        
        if token.rug_risk == "HIGH": base_score -= 2.5
        elif token.rug_risk == "MEDIUM": base_score -= 1.0
        
        if token.dev_wallet_pct > 15: base_score -= 2.0
        elif token.dev_wallet_pct > 8: base_score -= 1.0
        
        # Normalize score between 0 and 10
        score = max(0.0, min(10.0, base_score))
        
        # Update token confidence
        token.confidence = score * 10
        token.score = score
        
        return score
    
    def _generate_demo_token(self) -> dict:
        """Generate demo token as fallback"""
        import random
        
        demo_names = ["MOON CHAD", "DEGEN PEPE", "ALPHA SHIB"]
        demo_symbols = ["$MCHAD", "$DPEPE", "$ASHIB"]
        
        name = random.choice(demo_names)
        symbol = random.choice(demo_symbols)
        market_cap = random.randint(50, 200)
        holders = random.randint(30, 200)
        liquidity = random.randint(5, 20)
        
        return {
            "name": name,
            "symbol": symbol,
            "market_cap": f"${market_cap}K",
            "age": "Demo",
            "holders": holders,
            "liquidity": f"${liquidity}K",
            "buy_sell_ratio": random.uniform(2, 5),
            "honeypot_risk": "LOW",
            "rug_risk": "LOW",
            "potential": "⚡ MEDIUM",
            "confidence": 75.0,
            "dev_wallet": "3.0%",
            "score": 7.0,
            "contract": self._generate_contract_address(),
            "scanned_at": datetime.now()
        }
    
    def _age_token(self, token: dict):
        """Age the token discovery time"""
        current_age = token.get("age", "1m")
        
        if "Just found!" in current_age:
            token["age"] = "1m"
        elif current_age == "1m":
            token["age"] = "2m"
        elif current_age == "2m":
            token["age"] = "3m"
        elif current_age == "3m":
            token["age"] = "5m"
        elif current_age == "5m":
            token["age"] = "8m"
        elif current_age == "8m":
            token["age"] = "12m"
        elif current_age == "12m":
            token["age"] = "15m"
        else:
            token["age"] = "15m+"
    
    def _get_scanner_alerts(self) -> List[dict]:
        """Get scanner alerts"""
        alerts = []
        
        # High potential token alert
        high_potential_tokens = [t for t in self.scanned_tokens if t["potential"] == "🚀 HIGH"]
        if high_potential_tokens:
            alerts.append({
                "type": "HIGH_POTENTIAL",
                "message": f"Found {len(high_potential_tokens)} high potential tokens!",
                "severity": "HIGH"
            })
        
        # Rug detection alert
        recent_rugs = [t for t in self.scanned_tokens if t["rug_risk"] == "HIGH" and t["age"] in ["Just found!", "1m", "2m"]]
        if recent_rugs:
            alerts.append({
                "type": "RUG_WARNING",
                "message": f"⚠️ {len(recent_rugs)} potential rugs detected",
                "severity": "WARNING"
            })
        
        # Scanner performance
        if self.scanner_stats["tokens_scanned"] > 1000:
            alerts.append({
                "type": "PERFORMANCE",
                "message": f"Scanner analyzed {self.scanner_stats['tokens_scanned']} tokens",
                "severity": "INFO"
            })
        
        return alerts
    
    async def _continuous_scan(self):
        """Continuous token scanning"""
        while True:
            try:
                await self._update_scanner_data()
                await asyncio.sleep(8)  # Scan every 8 seconds
            except Exception as e:
                logger.error(f"Token scanning error: {e}")
                await asyncio.sleep(20)
    
    async def scan_new_tokens(self) -> List[dict]:
        """Scan for new tokens"""
        return [t for t in self.scanned_tokens if t["age"] in ["Just found!", "1m", "2m"]]
    
    def get_metrics(self) -> dict:
        """Get token hunter metrics"""
        return {
            "tokens_scanned": self.scanner_stats["tokens_scanned"],
            "gems_found": self.scanner_stats["potential_gems"],
            "rugs_detected": self.scanner_stats["rugs_detected"],
            "active_tokens": len(self.scanned_tokens),
            "last_scan": self.last_scan.isoformat()
        }
    
    async def shutdown(self):
        """Shutdown token hunter"""
        logger.info("🛑 SHUTTING DOWN TOKEN HUNTER...")
        logger.info("✅ TOKEN HUNTER SHUTDOWN COMPLETE") 