#!/usr/bin/env python3
"""
REAL TRADING TEST SCRIPT
========================
Test the real trading system with actual blockchain connection.
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from trading.jupiter_trader import RealJupiterTrader
from active_positions.position_manager import RealPositionManager
from core.ai_swarm_orchestrator import AISwarmOrchestrator

async def test_jupiter_connection():
    """Test Jupiter API connection"""
    print("🔍 Testing Jupiter API connection...")
    
    trader = RealJupiterTrader()
    try:
        await trader.initialize()
        print("✅ Jupiter API connection successful")
        
        # Test getting SOL price
        sol_price = await trader.get_token_price("So11111111111111111111111111111111111111112")
        if sol_price:
            print(f"💰 SOL Price: ${sol_price:.2f}")
        
        await trader.shutdown()
        return True
        
    except Exception as e:
        print(f"❌ Jupiter connection failed: {e}")
        return False

async def test_position_manager():
    """Test position manager initialization"""
    print("\n🎯 Testing Position Manager...")
    
    try:
        position_manager = RealPositionManager()
        await position_manager.initialize()
        
        # Get initial state
        positions = await position_manager.get_active_positions()
        print(f"✅ Position Manager initialized")
        print(f"📊 Active positions: {positions.get('active_count', '0/0')}")
        
        await position_manager.shutdown()
        return True
        
    except Exception as e:
        print(f"❌ Position Manager test failed: {e}")
        return False

async def test_ai_orchestrator():
    """Test AI orchestrator initialization"""
    print("\n🤖 Testing AI Orchestrator...")
    
    try:
        # Create minimal orchestrator for testing
        orchestrator = AISwarmOrchestrator()
        await orchestrator.initialize()
        
        # Test swarm status
        status = await orchestrator.get_swarm_status()
        print(f"✅ AI Orchestrator initialized")
        print(f"🔄 Running: {status.get('is_running', False)}")
        print(f"🧠 Agents: {status.get('agents_count', 0)}")
        
        await orchestrator.shutdown()
        return True
        
    except Exception as e:
        print(f"❌ AI Orchestrator test failed: {e}")
        return False

async def test_trading_system():
    """Test complete trading system"""
    print("\n🚀 Testing Complete Trading System...")
    
    try:
        # Initialize components
        trader = RealJupiterTrader()
        position_manager = RealPositionManager()
        
        await trader.initialize()
        await position_manager.initialize()
        
        # Test getting quotes (without executing)
        print("📊 Testing quote retrieval...")
        SOL_MINT = "So11111111111111111111111111111111111111112"
        USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        
        quote = await trader.get_quote(
            input_mint=SOL_MINT,
            output_mint=USDC_MINT,
            amount=1000000000,  # 1 SOL in lamports
            slippage_bps=50
        )
        
        if quote:
            print(f"✅ Quote retrieved successfully")
            print(f"💱 1 SOL ≈ {int(quote.get('outAmount', 0)) / 1e6:.2f} USDC")
        else:
            print("❌ Failed to get quote")
        
        # Test position data structures
        positions = await position_manager.get_active_positions()
        print(f"📈 Position system ready: {positions.get('wallet_configured', False)}")
        
        await trader.shutdown()
        await position_manager.shutdown()
        
        print("✅ Complete trading system test passed")
        return True
        
    except Exception as e:
        print(f"❌ Trading system test failed: {e}")
        return False

async def run_comprehensive_test():
    """Run comprehensive test suite"""
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║                🧪 REAL TRADING SYSTEM TESTS 🧪                ║
    ║                                                               ║
    ║  Testing all components before real money deployment          ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)
    
    tests = [
        ("Jupiter API Connection", test_jupiter_connection),
        ("Position Manager", test_position_manager),
        ("AI Orchestrator", test_ai_orchestrator),
        ("Complete Trading System", test_trading_system)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Print results summary
    print("\n" + "="*60)
    print("📋 TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:.<30} {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Tests Passed: {passed}/{len(tests)}")
    
    if passed == len(tests):
        print("\n🎉 ALL TESTS PASSED! The real trading system is ready!")
        print("\nNext steps:")
        print("1. Run: python setup_real_trading.py")
        print("2. Configure your wallet and trading parameters")
        print("3. Start trading: python start_bot.py")
        print("\n⚠️  Remember: This will trade with REAL money!")
    else:
        print(f"\n⚠️  {len(tests) - passed} tests failed. Fix issues before deploying real money.")
        print("Review the error messages above and check your configuration.")

if __name__ == "__main__":
    try:
        asyncio.run(run_comprehensive_test())
    except KeyboardInterrupt:
        print("\n❌ Tests cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1) 