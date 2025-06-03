#!/usr/bin/env python3
"""
Import Test Script for Quantum Degen Trading AI Swarm
Tests if all required modules can be imported correctly
"""

import sys
import importlib
import traceback

# Define test color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def test_import(module_name):
    """Test importing a module and return result"""
    try:
        importlib.import_module(module_name)
        return True, None
    except ImportError as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)

def run_tests():
    """Run all import tests"""
    print(f"{YELLOW}🚀 Testing Quantum Degen AI Swarm Module Imports{RESET}")
    print("===========================================\n")
    
    # Core modules
    core_modules = [
        'backend.core.ai_swarm_orchestrator',
        'backend.core.websocket_manager', 
        'backend.core.config'
    ]
    
    # Feature modules
    feature_modules = [
        'backend.active_positions.position_manager',
        'backend.ai_analysis.neural_analyzer',
        'backend.market_analysis.market_intelligence',
        'backend.meme_scanner.token_hunter',
        'backend.portfolio_status.portfolio_tracker',
        'backend.risk_management.risk_engine',
        'backend.signal_feed.signal_aggregator',
        'backend.whale_activity.whale_tracker'
    ]
    
    # Trading modules
    trading_modules = [
        'backend.trading.jupiter_trader'
    ]
    
    # Required dependencies
    dependencies = [
        'fastapi',
        'uvicorn', 
        'httpx',
        'asyncio',
        'json',
        'websockets'
    ]
    
    # Test all modules
    all_modules = {
        'Core Modules': core_modules,
        'Feature Modules': feature_modules,
        'Trading Modules': trading_modules,
        'Dependencies': dependencies
    }
    
    total_tests = sum(len(modules) for modules in all_modules.values())
    passed = 0
    failed = 0
    
    for category, modules in all_modules.items():
        print(f"\n{YELLOW}{category}:{RESET}")
        print("-" * 40)
        
        for module in modules:
            success, error = test_import(module)
            
            if success:
                print(f"{GREEN}✓ {module}{RESET}")
                passed += 1
            else:
                print(f"{RED}✗ {module} - Error: {error}{RESET}")
                failed += 1
    
    # Print summary
    print("\n===========================================")
    print(f"Results: {passed}/{total_tests} modules imported successfully")
    
    if failed == 0:
        print(f"{GREEN}All modules imported successfully!{RESET}")
    else:
        print(f"{RED}Failed to import {failed} module(s){RESET}")
        print("\nTroubleshooting tips:")
        print(" - Check that all requirements are installed: pip install -r requirements.txt")
        print(" - Verify that the Python path includes the project root directory")
        print(" - Check for any missing dependencies in requirements.txt")
    
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)