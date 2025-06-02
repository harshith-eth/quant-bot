#!/usr/bin/env python3
"""
REAL TRADING SETUP SCRIPT
=========================
Configure the bot for ACTUAL trading with real money.
This is NOT a simulation - you will trade with REAL SOL.
"""

import asyncio
import getpass
import os
import sys
from pathlib import Path

# Add the backend directory to the path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from trading.jupiter_trader import RealJupiterTrader
from core.config import RealTradingConfig

def print_banner():
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║                  🚀 REAL TRADING SETUP 🚀                     ║
    ║                                                               ║
    ║  ⚠️  WARNING: THIS IS NOT A SIMULATION                        ║
    ║  💰 YOU WILL BE TRADING WITH REAL MONEY                      ║
    ║  📈 REAL PROFITS AND LOSSES WILL OCCUR                       ║
    ║                                                               ║
    ║  Make sure you understand the risks before proceeding!       ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)

def get_user_consent():
    """Get explicit user consent for real trading"""
    print("\n🔴 RISK ACKNOWLEDGMENT 🔴")
    print("By continuing, you acknowledge that:")
    print("• You understand this bot will execute REAL trades")
    print("• You may lose money and accept full responsibility")
    print("• The bot operates autonomously and may make unexpected trades")
    print("• You should only risk money you can afford to lose")
    print("• Past performance does not guarantee future results")
    
    consent = input("\nDo you accept these risks and want to proceed? (type 'I ACCEPT RISKS'): ")
    
    if consent != "I ACCEPT RISKS":
        print("❌ Setup cancelled. Use demo mode instead.")
        sys.exit(1)
    
    print("✅ Risk acknowledgment received.")

def get_wallet_private_key():
    """Securely get wallet private key"""
    print("\n🔐 WALLET CONFIGURATION")
    print("You need to provide your Solana wallet private key.")
    print("This will be used to execute REAL trades on your behalf.")
    print("\nSecurity notes:")
    print("• Keep your private key secure")
    print("• Never share it with anyone")
    print("• Consider using a dedicated trading wallet")
    print("• Start with small amounts for testing")
    
    while True:
        private_key = getpass.getpass("\nEnter your wallet private key (hidden): ")
        
        if not private_key:
            print("❌ Private key cannot be empty")
            continue
        
        # Basic validation
        if len(private_key) not in [88, 128]:  # Base58 or hex format
            print("❌ Invalid private key format. Should be 88 chars (base58) or 128 chars (hex)")
            continue
        
        confirm = getpass.getpass("Confirm private key (hidden): ")
        
        if private_key != confirm:
            print("❌ Private keys don't match. Try again.")
            continue
        
        return private_key

def configure_trading_parameters():
    """Configure trading parameters"""
    print("\n⚙️ TRADING PARAMETERS")
    
    print(f"Current settings:")
    print(f"• Max position size: {RealTradingConfig.MAX_POSITION_SIZE} SOL")
    print(f"• Max portfolio risk: {RealTradingConfig.MAX_PORTFOLIO_RISK * 100}%")
    print(f"• Min trade size: {RealTradingConfig.MIN_TRADE_SIZE} SOL")
    print(f"• Max positions: {RealTradingConfig.MAX_POSITIONS}")
    print(f"• Default slippage: {RealTradingConfig.DEFAULT_SLIPPAGE / 100}%")
    
    modify = input("\nDo you want to modify these settings? (y/n): ").lower()
    
    if modify == 'y':
        try:
            max_pos = float(input(f"Max position size in SOL ({RealTradingConfig.MAX_POSITION_SIZE}): ") or RealTradingConfig.MAX_POSITION_SIZE)
            RealTradingConfig.MAX_POSITION_SIZE = max_pos
            
            max_risk = float(input(f"Max portfolio risk % ({RealTradingConfig.MAX_PORTFOLIO_RISK * 100}): ") or RealTradingConfig.MAX_PORTFOLIO_RISK * 100) / 100
            RealTradingConfig.MAX_PORTFOLIO_RISK = max_risk
            
            min_trade = float(input(f"Min trade size in SOL ({RealTradingConfig.MIN_TRADE_SIZE}): ") or RealTradingConfig.MIN_TRADE_SIZE)
            RealTradingConfig.MIN_TRADE_SIZE = min_trade
            
            print("✅ Trading parameters updated")
            
        except ValueError:
            print("❌ Invalid input. Using default values.")

async def test_wallet_connection(private_key: str):
    """Test wallet connection and show balance"""
    print("\n🔍 TESTING WALLET CONNECTION...")
    
    try:
        trader = RealJupiterTrader()
        await trader.initialize()
        
        # Set wallet
        success = trader.set_wallet(private_key)
        if not success:
            print("❌ Failed to configure wallet")
            return False
        
        # Get balance
        balance_info = await trader.get_wallet_balance()
        
        print(f"✅ Wallet connected successfully!")
        print(f"📍 Address: {balance_info.get('wallet', 'Unknown')}")
        print(f"💰 SOL Balance: {balance_info.get('sol_balance', 0):.4f} SOL")
        print(f"💵 USD Value: ${balance_info.get('total_value_usd', 0):.2f}")
        
        if balance_info.get('sol_balance', 0) < 0.1:
            print("\n⚠️ WARNING: Low SOL balance detected!")
            print("You need at least 0.1 SOL for trading + gas fees.")
            
            proceed = input("Continue anyway? (y/n): ").lower()
            if proceed != 'y':
                return False
        
        await trader.shutdown()
        return True
        
    except Exception as e:
        print(f"❌ Wallet connection failed: {e}")
        return False

def save_configuration(private_key: str):
    """Save configuration to environment file"""
    print("\n💾 SAVING CONFIGURATION...")
    
    env_file = backend_path / ".env"
    
    env_content = f"""
# REAL TRADING CONFIGURATION
WALLET_PRIVATE_KEY={private_key}
SOL_RPC_URL={RealTradingConfig.SOL_RPC_URL}
MAX_POSITION_SIZE={RealTradingConfig.MAX_POSITION_SIZE}
MAX_PORTFOLIO_RISK={RealTradingConfig.MAX_PORTFOLIO_RISK}
MIN_TRADE_SIZE={RealTradingConfig.MIN_TRADE_SIZE}
MAX_POSITIONS={RealTradingConfig.MAX_POSITIONS}
DEFAULT_SLIPPAGE={RealTradingConfig.DEFAULT_SLIPPAGE}
ENABLE_AUTO_TRADING=false
REQUIRE_MANUAL_APPROVAL=true
"""
    
    with open(env_file, "w") as f:
        f.write(env_content.strip())
    
    print(f"✅ Configuration saved to {env_file}")
    print("\n🔒 SECURITY REMINDER:")
    print("• Your private key is now stored in the .env file")
    print("• Make sure this file is not shared or committed to version control")
    print("• Consider using environment variables in production")

def print_next_steps():
    """Print next steps for the user"""
    print("""
    ✅ SETUP COMPLETE!
    
    Next steps:
    1. Start the bot: python start_bot.py
    2. Open the dashboard: http://localhost:8000
    3. Enable auto trading in the dashboard (optional)
    4. Monitor your positions and P&L
    
    Safety tips:
    • Start with small position sizes
    • Monitor the bot closely at first
    • Set stop losses and take profits
    • Keep some SOL for gas fees
    • Review trades regularly
    
    🚨 REMEMBER: This bot trades with REAL money!
    Always trade responsibly and within your risk tolerance.
    """)

async def main():
    """Main setup function"""
    print_banner()
    get_user_consent()
    
    private_key = get_wallet_private_key()
    configure_trading_parameters()
    
    # Test wallet connection
    if not await test_wallet_connection(private_key):
        print("❌ Setup failed due to wallet connection issues")
        sys.exit(1)
    
    save_configuration(private_key)
    print_next_steps()
    
    print("\n🎉 Real trading setup complete! Good luck and trade safely! 🎉")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1) 