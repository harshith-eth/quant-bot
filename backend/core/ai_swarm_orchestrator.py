"""
AI SWARM ORCHESTRATOR - THE BRAIN COORDINATOR
============================================
Coordinates all AI agents in the trading swarm.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger("AI_SWARM")

class AISwarmOrchestrator:
    """Coordinates all AI agents in the trading system"""
    
    def __init__(self, **agents):
        self.agents = agents
        self.active = False
        self.is_running = False
        self.last_coordination = datetime.now()
        
        logger.info("🤖 AI SWARM ORCHESTRATOR INITIALIZED")
    
    async def initialize(self):
        """Initialize all agents"""
        logger.info("🚀 INITIALIZING AI SWARM...")
        
        # Initialize all agents
        for name, agent in self.agents.items():
            try:
                await agent.initialize()
                logger.info(f"✅ {name} initialized")
            except Exception as e:
                logger.error(f"❌ Failed to initialize {name}: {e}")
        
        self.active = True
        self.is_running = True
        logger.info("✅ AI SWARM ONLINE")
    
    async def execute_trade(self, trade_data: dict) -> dict:
        """Execute a trade through the position manager"""
        try:
            if 'position_manager' in self.agents:
                return await self.agents['position_manager'].execute_trade(trade_data)
            else:
                return {"error": "Position manager not available", "success": False}
        except Exception as e:
            logger.error(f"Trade execution error: {e}")
            return {"error": str(e), "success": False}
    
    async def get_swarm_status(self) -> dict:
        """Get overall swarm status"""
        return {
            "active": self.active,
            "agents_count": len(self.agents),
            "agents": list(self.agents.keys()),
            "last_coordination": self.last_coordination.isoformat()
        }
    
    async def shutdown(self):
        """Shutdown all agents"""
        logger.info("🛑 SHUTTING DOWN AI SWARM...")
        
        for name, agent in self.agents.items():
            try:
                await agent.shutdown()
                logger.info(f"✅ {name} shutdown")
            except Exception as e:
                logger.error(f"❌ Error shutting down {name}: {e}")
        
        self.active = False
        self.is_running = False
        logger.info("✅ AI SWARM SHUTDOWN COMPLETE") 