#!/usr/bin/env python3
"""
🚀 QUANTUM DEGEN TRADING AI - TERMINAL CLI
Terminal-based trading interface for Jupiter DEX trading
"""

import asyncio
import argparse
import logging
import getpass
import sys
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

# Import trading components
from backend.trading.jupiter_trader import RealJupiterTrader
from backend.active_positions.position_manager import RealPositionManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("trading_cli.log")
    ]
)
logger = logging.getLogger("TRADE_CLI")

# Global variables
trader = RealJupiterTrader()
position_manager = RealPositionManager()
wallet_configured = False

async def initialize_terminal_trading():
    """Initialize trading components for terminal use"""
    global trader, position_manager
    
    try:
        logger.info("🚀 Initializing trading components...")
        
        # Initialize trader and position manager
        await trader.initialize()
        await position_manager.initialize()
        
        logger.info("✅ Trading components initialized successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Initialization failed: {e}")
        return False

async def configure_wallet(private_key: str) -> bool:
    """Configure wallet for trading"""
    global trader, position_manager, wallet_configured
    
    try:
        logger.info("🔐 Configuring wallet...")
        
        # Set wallet in both components
        trader_success = trader.set_wallet(private_key)
        pm_success = await position_manager.configure_wallet(private_key)
        
        if trader_success and pm_success:
            wallet_configured = True
            
            # Get wallet info
            wallet_info = await trader.get_wallet_balance()
            wallet_address = wallet_info.get('wallet', 'Unknown')
            sol_balance = wallet_info.get('sol_balance', 0)
            
            logger.info(f"✅ WALLET CONFIGURED: {wallet_address}")
            logger.info(f"💰 BALANCE: {sol_balance:.4f} SOL")
            
            return True
        else:
            logger.error("❌ Failed to configure wallet")
            return False
    except Exception as e:
        logger.error(f"❌ Wallet configuration error: {e}")
        return False

async def get_wallet_balance():
    """Get current wallet balance"""
    global trader, wallet_configured
    
    if not wallet_configured:
        logger.error("❌ Wallet not configured")
        return None
    
    try:
        balance = await trader.get_wallet_balance()
        return balance
    except Exception as e:
        logger.error(f"❌ Balance fetch error: {e}")
        return None

async def get_token_price(token_mint: str) -> Optional[float]:
    """Get token price from Jupiter"""
    global trader
    
    try:
        price = await trader.get_token_price(token_mint)
        return price
    except Exception as e:
        logger.error(f"❌ Price fetch error: {e}")
        return None

async def execute_buy(token_mint: str, token_symbol: str, sol_amount: float, 
                      stop_loss_pct: float, take_profit_pct: float) -> Dict:
    """Execute a buy trade"""
    global position_manager, wallet_configured
    
    if not wallet_configured:
        return {"success": False, "error": "Wallet not configured"}
    
    try:
        result = await position_manager.execute_buy_trade(
            token_mint=token_mint,
            token_symbol=token_symbol,
            sol_amount=sol_amount,
            stop_loss_pct=stop_loss_pct,
            take_profit_pct=take_profit_pct
        )
        
        return result
    except Exception as e:
        logger.error(f"❌ Buy execution error: {e}")
        return {"success": False, "error": str(e)}

async def execute_sell(position_id: str, sell_percentage: float = 100.0) -> Dict:
    """Execute a sell trade"""
    global position_manager, wallet_configured
    
    if not wallet_configured:
        return {"success": False, "error": "Wallet not configured"}
    
    try:
        result = await position_manager.execute_sell_trade(
            position_id=position_id,
            sell_percentage=sell_percentage,
            reason="Manual sell from CLI"
        )
        
        return result
    except Exception as e:
        logger.error(f"❌ Sell execution error: {e}")
        return {"success": False, "error": str(e)}

async def get_active_positions() -> Dict:
    """Get active positions"""
    global position_manager
    
    try:
        positions = await position_manager.get_active_positions()
        return positions
    except Exception as e:
        logger.error(f"❌ Positions fetch error: {e}")
        return {"success": False, "error": str(e), "positions": []}

async def emergency_exit_all() -> Dict:
    """Emergency exit all positions"""
    global position_manager
    
    try:
        await position_manager.emergency_exit_all()
        return {"success": True, "message": "Emergency exit executed"}
    except Exception as e:
        logger.error(f"❌ Emergency exit error: {e}")
        return {"success": False, "error": str(e)}

async def execute_quote(input_mint: str, output_mint: str, amount: int) -> Dict:
    """Get a quote for a swap"""
    global trader
    
    try:
        quote = await trader.get_quote(input_mint, output_mint, amount)
        return quote
    except Exception as e:
        logger.error(f"❌ Quote error: {e}")
        return None

async def handle_command_buy(args):
    """Handle buy command"""
    if not args.token_mint or not args.amount:
        logger.error("❌ Token mint and amount are required for buy")
        return False
    
    symbol = args.symbol if args.symbol else f"TOKEN-{args.token_mint[:6]}"
    stop_loss = args.stop_loss if args.stop_loss else 30.0
    take_profit = args.take_profit if args.take_profit else 100.0
    
    result = await execute_buy(
        token_mint=args.token_mint,
        token_symbol=symbol,
        sol_amount=float(args.amount),
        stop_loss_pct=stop_loss,
        take_profit_pct=take_profit
    )
    
    if result.get("success"):
        logger.info(f"✅ BUY ORDER EXECUTED: {args.amount} SOL -> {symbol}")
        logger.info(f"🧾 TRANSACTION: {result.get('transaction_id', 'Unknown')}")
        logger.info(f"📊 OUTPUT AMOUNT: {result.get('token_amount', 'Unknown')}")
        return True
    else:
        logger.error(f"❌ BUY ORDER FAILED: {result.get('error', 'Unknown error')}")
        return False

async def handle_command_sell(args):
    """Handle sell command"""
    if not args.position_id:
        logger.error("❌ Position ID is required for sell")
        return False
    
    percentage = args.percentage if args.percentage else 100.0
    
    result = await execute_sell(
        position_id=args.position_id,
        sell_percentage=float(percentage)
    )
    
    if result.get("success"):
        logger.info(f"✅ SELL ORDER EXECUTED: {args.position_id} ({percentage}%)")
        logger.info(f"🧾 TRANSACTION: {result.get('transaction_id', 'Unknown')}")
        logger.info(f"📊 SOL RECEIVED: {result.get('sol_amount', 'Unknown')}")
        return True
    else:
        logger.error(f"❌ SELL ORDER FAILED: {result.get('error', 'Unknown error')}")
        return False

async def handle_command_positions(args):
    """Handle positions command"""
    positions = await get_active_positions()
    
    if positions.get("positions"):
        pos_list = positions.get("positions", [])
        logger.info(f"📊 ACTIVE POSITIONS: {len(pos_list)}")
        
        for pos in pos_list:
            position_id = pos.get("id", "Unknown")
            symbol = pos.get("symbol", "Unknown")
            size = pos.get("size", "0")
            value_usd = pos.get("value_usd", "0")
            pnl = pos.get("pnl", "0%")
            
            logger.info(f"🔹 {position_id}: {symbol} | {size} | ${value_usd} | PNL: {pnl}")
    else:
        logger.info("📊 NO ACTIVE POSITIONS")
    
    return True

async def handle_command_balance(args):
    """Handle balance command"""
    balance = await get_wallet_balance()
    
    if balance:
        sol_balance = balance.get("sol_balance", 0)
        sol_price = balance.get("sol_price", 0)
        total_value_usd = balance.get("total_value_usd", 0)
        wallet = balance.get("wallet", "Unknown")
        
        logger.info(f"💰 WALLET BALANCE")
        logger.info(f"🔹 ADDRESS: {wallet}")
        logger.info(f"🔹 SOL: {sol_balance:.4f} (${sol_price:.2f})")
        logger.info(f"🔹 TOTAL VALUE: ${total_value_usd:.2f}")
    else:
        logger.error("❌ FAILED TO FETCH BALANCE")
    
    return True

async def handle_command_price(args):
    """Handle price command"""
    if not args.token_mint:
        logger.error("❌ Token mint is required for price check")
        return False
    
    price = await get_token_price(args.token_mint)
    
    if price is not None:
        logger.info(f"💲 TOKEN PRICE: ${price:.6f}")
    else:
        logger.error(f"❌ FAILED TO FETCH PRICE FOR {args.token_mint}")
    
    return True

async def handle_command_emergency(args):
    """Handle emergency command"""
    logger.warning("🚨 EXECUTING EMERGENCY EXIT - SELLING ALL POSITIONS")
    
    result = await emergency_exit_all()
    
    if result.get("success"):
        logger.info("✅ EMERGENCY EXIT EXECUTED SUCCESSFULLY")
    else:
        logger.error(f"❌ EMERGENCY EXIT FAILED: {result.get('error', 'Unknown error')}")
    
    return True

async def handle_command_quote(args):
    """Handle quote command"""
    if not args.input_mint or not args.output_mint or not args.amount:
        logger.error("❌ Input mint, output mint and amount are required for quote")
        return False
    
    quote = await execute_quote(
        input_mint=args.input_mint,
        output_mint=args.output_mint,
        amount=int(args.amount)
    )
    
    if quote:
        in_amount = quote.get("inAmount", "Unknown")
        out_amount = quote.get("outAmount", "Unknown")
        price_impact = quote.get("priceImpactPct", "Unknown")
        
        logger.info(f"📊 QUOTE")
        logger.info(f"🔹 INPUT: {in_amount} {args.input_mint[:6]}...")
        logger.info(f"🔹 OUTPUT: {out_amount} {args.output_mint[:6]}...")
        logger.info(f"🔹 PRICE IMPACT: {price_impact}")
    else:
        logger.error("❌ FAILED TO GET QUOTE")
    
    return True

async def save_config(private_key: str, config_file: str = "trading_config.json"):
    """Save private key to config file (encrypted in real-world implementation)"""
    try:
        # WARNING: This is a simple implementation - in a real system, encrypt the key
        config = {
            "private_key": private_key,
            "timestamp": datetime.now().isoformat()
        }
        
        with open(config_file, "w") as f:
            json.dump(config, f)
        
        logger.info(f"✅ Configuration saved to {config_file}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to save configuration: {e}")
        return False

async def load_config(config_file: str = "trading_config.json"):
    """Load private key from config file"""
    try:
        if not os.path.exists(config_file):
            return None
        
        with open(config_file, "r") as f:
            config = json.load(f)
        
        return config.get("private_key")
    except Exception as e:
        logger.error(f"❌ Failed to load configuration: {e}")
        return None

async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description="Terminal-based Solana trading CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Initialize command
    parser_init = subparsers.add_parser("init", help="Initialize trading with private key")
    parser_init.add_argument("--key", help="Private key (WARNING: prefer interactive mode by omitting this)")
    parser_init.add_argument("--save", action="store_true", help="Save configuration for later use")
    
    # Buy command
    parser_buy = subparsers.add_parser("buy", help="Buy a token with SOL")
    parser_buy.add_argument("--token-mint", help="Token mint address")
    parser_buy.add_argument("--symbol", help="Token symbol (optional)")
    parser_buy.add_argument("--amount", help="SOL amount to spend")
    parser_buy.add_argument("--stop-loss", type=float, help="Stop loss percentage (default: 30%)")
    parser_buy.add_argument("--take-profit", type=float, help="Take profit percentage (default: 100%)")
    
    # Sell command
    parser_sell = subparsers.add_parser("sell", help="Sell a token position")
    parser_sell.add_argument("--position-id", help="Position ID to sell")
    parser_sell.add_argument("--percentage", type=float, help="Percentage to sell (default: 100%)")
    
    # Positions command
    parser_positions = subparsers.add_parser("positions", help="List active positions")
    
    # Balance command
    parser_balance = subparsers.add_parser("balance", help="Show wallet balance")
    
    # Price command
    parser_price = subparsers.add_parser("price", help="Check token price")
    parser_price.add_argument("--token-mint", help="Token mint address")
    
    # Emergency command
    parser_emergency = subparsers.add_parser("emergency", help="Emergency exit all positions")
    
    # Quote command
    parser_quote = subparsers.add_parser("quote", help="Get quote for token swap")
    parser_quote.add_argument("--input-mint", help="Input token mint address")
    parser_quote.add_argument("--output-mint", help="Output token mint address")
    parser_quote.add_argument("--amount", help="Amount of input tokens (in smallest denomination)")
    
    args = parser.parse_args()
    
    # Initialize trading components
    success = await initialize_terminal_trading()
    if not success:
        logger.error("❌ Failed to initialize trading components")
        return 1
    
    # Handle commands
    if args.command == "init":
        private_key = args.key
        
        # If no key provided, try loading from config or prompt
        if not private_key:
            # Try loading from config
            private_key = await load_config()
            
            # If still no key, prompt for input
            if not private_key:
                private_key = getpass.getpass("Enter private key: ")
        
        success = await configure_wallet(private_key)
        if success:
            if args.save:
                await save_config(private_key)
            return 0
        else:
            return 1
    
    # Check if private key is loaded from config for other commands
    if not wallet_configured:
        # Try loading from config
        private_key = await load_config()
        if private_key:
            success = await configure_wallet(private_key)
            if not success:
                logger.error("❌ Failed to configure wallet from saved config")
                return 1
        else:
            logger.error("❌ Wallet not configured. Run 'init' command first.")
            return 1
    
    # Handle other commands
    if args.command == "buy":
        await handle_command_buy(args)
    elif args.command == "sell":
        await handle_command_sell(args)
    elif args.command == "positions":
        await handle_command_positions(args)
    elif args.command == "balance":
        await handle_command_balance(args)
    elif args.command == "price":
        await handle_command_price(args)
    elif args.command == "emergency":
        await handle_command_emergency(args)
    elif args.command == "quote":
        await handle_command_quote(args)
    else:
        logger.error("❌ Unknown command")
        return 1
    
    # Clean up
    await trader.shutdown()
    await position_manager.shutdown()
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        logger.info("🛑 Trading CLI terminated by user")
        sys.exit(0)