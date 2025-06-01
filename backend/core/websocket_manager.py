"""
WEBSOCKET MANAGER - REAL-TIME COMMUNICATION HUB
==============================================
Manages all WebSocket connections and real-time data streaming.
"""

import asyncio
import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket
from datetime import datetime

logger = logging.getLogger("WS_MANAGER")

class WebSocketManager:
    """Manages WebSocket connections and real-time data distribution"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        self.last_data: Dict[str, dict] = {}
        
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")
        
        # Send initial data
        await self.send_initial_data(websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            if websocket in self.subscriptions:
                del self.subscriptions[websocket]
            logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    def subscribe_channels(self, websocket: WebSocket, channels: List[str]):
        """Subscribe WebSocket to specific data channels"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(channels)
            logger.info(f"WebSocket subscribed to channels: {channels}")
    
    async def send_initial_data(self, websocket: WebSocket):
        """Send initial data to newly connected client"""
        try:
            initial_message = {
                "type": "connection_established",
                "timestamp": datetime.now().isoformat(),
                "available_channels": [
                    "active_positions",
                    "ai_analysis", 
                    "market_analysis",
                    "meme_scanner",
                    "portfolio_status",
                    "risk_management",
                    "signal_feed",
                    "whale_activity"
                ]
            }
            await websocket.send_text(json.dumps(initial_message))
        except Exception as e:
            logger.error(f"Error sending initial data: {e}")
    
    async def broadcast_to_channel(self, channel: str, data: dict):
        """Broadcast data to all subscribers of a specific channel"""
        if not self.active_connections:
            return
            
        # Store latest data
        self.last_data[channel] = data
        
        message = {
            "type": "data_update",
            "channel": channel,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        disconnected = []
        for websocket in self.active_connections:
            try:
                # Check if this websocket is subscribed to the channel
                if channel in self.subscriptions.get(websocket, set()):
                    await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending to WebSocket: {e}")
                disconnected.append(websocket)
        
        # Remove disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)
    
    async def broadcast_to_all(self, data: dict):
        """Broadcast data to all connected clients"""
        if not self.active_connections:
            return
            
        message = {
            "type": "broadcast",
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        disconnected = []
        for websocket in self.active_connections:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                disconnected.append(websocket)
        
        # Remove disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)
    
    async def send_alert(self, alert_type: str, message: str, severity: str = "info"):
        """Send alert to all connected clients"""
        alert_data = {
            "type": "alert",
            "alert_type": alert_type,
            "message": message,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast_to_all(alert_data)
        logger.info(f"Alert sent: {alert_type} - {message}")
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    def get_subscription_stats(self) -> Dict[str, int]:
        """Get statistics about channel subscriptions"""
        stats = {}
        for subscriptions in self.subscriptions.values():
            for channel in subscriptions:
                stats[channel] = stats.get(channel, 0) + 1
        return stats 