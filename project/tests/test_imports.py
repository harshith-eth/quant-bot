#!/usr/bin/env python3
"""
Test script to verify imports and module structure
"""

import sys
import os
from pathlib import Path

def print_status(message, success=True):
    """Print colored status message"""
    if success:
        print(f"✅ {message}")
    else:
        print(f"❌ {message}")

def test_imports():
    """Test importing all essential modules"""
    # Add backend directory to path
    backend_dir = Path(__file__).parent / "backend"
    sys.path.insert(0, str(backend_dir))
    
    # Dictionary of modules to test
    modules = {
        "active_positions.position_manager": ["PositionManager", "RealPositionManager"],
        "ai_analysis.neural_analyzer": ["NeuralAnalyzer"],
        "market_analysis.market_intelligence": ["MarketIntelligence"],
        "meme_scanner.token_hunter": ["TokenHunter"],
        "portfolio_status.portfolio_tracker": ["PortfolioTracker"],
        "risk_management.risk_engine": ["RiskEngine"],
        "signal_feed.signal_aggregator": ["SignalAggregator"],
        "whale_activity.whale_tracker": ["WhaleTracker"],
        "core.ai_swarm_orchestrator": ["AISwarmOrchestrator"],
        "core.websocket_manager": ["WebSocketManager"],
        "core.config": ["settings"]
    }
    
    all_successful = True
    for module_name, classes in modules.items():
        try:
            # Dynamic import 
            __import__(module_name)
            module = sys.modules[module_name]
            
            # Check each class
            class_success = True
            for class_name in classes:
                if not hasattr(module, class_name):
                    print_status(f"Class {class_name} not found in {module_name}", False)
                    class_success = False
                    all_successful = False
            
            if class_success:
                print_status(f"Successfully imported {module_name} with all required classes")
        except Exception as e:
            print_status(f"Failed to import {module_name}: {e}", False)
            all_successful = False
    
    return all_successful

def test_file_structure():
    """Test that the file structure is correct"""
    backend_dir = Path(__file__).parent / "backend"
    
    # Required directories with underscore naming
    required_dirs = [
        "active_positions",
        "ai_analysis",
        "market_analysis",
        "meme_scanner",
        "portfolio_status",
        "risk_management",
        "signal_feed",
        "whale_activity",
        "core",
        "trading",
        "utils"
    ]
    
    # Required files
    required_files = {
        "active_positions/position_manager.py": ["PositionManager", "RealPositionManager"],
        "ai_analysis/neural_analyzer.py": ["NeuralAnalyzer"],
        "market_analysis/market_intelligence.py": ["MarketIntelligence"],
        "meme_scanner/token_hunter.py": ["TokenHunter"],
        "portfolio_status/portfolio_tracker.py": ["PortfolioTracker"],
        "risk_management/risk_engine.py": ["RiskEngine"],
        "signal_feed/signal_aggregator.py": ["SignalAggregator"],
        "whale_activity/whale_tracker.py": ["WhaleTracker"],
        "core/ai_swarm_orchestrator.py": ["AISwarmOrchestrator"],
        "core/websocket_manager.py": ["WebSocketManager"],
        "main.py": []
    }
    
    all_successful = True
    
    # Check directories
    for dir_name in required_dirs:
        dir_path = backend_dir / dir_name
        if dir_path.exists() and dir_path.is_dir():
            print_status(f"Directory {dir_name} exists")
        else:
            print_status(f"Directory {dir_name} is missing", False)
            all_successful = False
    
    # Check files
    for file_path, _ in required_files.items():
        full_path = backend_dir / file_path
        if full_path.exists() and full_path.is_file():
            print_status(f"File {file_path} exists")
        else:
            print_status(f"File {file_path} is missing", False)
            all_successful = False
    
    return all_successful

if __name__ == "__main__":
    print("\n=== TESTING FILE STRUCTURE ===")
    structure_ok = test_file_structure()
    
    print("\n=== TESTING IMPORTS ===")
    imports_ok = test_imports()
    
    print("\n=== SUMMARY ===")
    if structure_ok and imports_ok:
        print_status("All tests PASSED! The structure and imports are correct.")
    else:
        print_status("Some tests FAILED. See details above.", False)