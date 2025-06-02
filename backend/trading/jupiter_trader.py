"""
REAL JUPITER TRADING ENGINE - ACTUAL SOLANA TRADING
===========================================
Real trading implementation using Jupiter SDK - NO SIMULATION SHIT.
This executes REAL trades with REAL money.
"""

import asyncio
import logging
import json
import time
from typing import Dict, List, Optional
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
import httpx
import base58
import base64

logger = logging.getLogger("JUPITER_TRADER")

class RealJupiterTrader:
    """REAL Jupiter DEX trading implementation - EXECUTES ACTUAL TRADES"""
    
    def __init__(self, rpc_url: str = "https://api.mainnet-beta.solana.com"):
        self.rpc_client = AsyncClient(rpc_url)
        self.http_client = httpx.AsyncClient()
        self.jupiter_api = "https://quote-api.jup.ag/v6"
        self.wallet_keypair = None
        self.slippage_bps = 50  # 0.5% slippage
        
        logger.info("🚀 REAL JUPITER TRADER INITIALIZED - READY FOR ACTUAL TRADING")
    
    async def initialize(self):
        """Initialize trader connection"""
        logger.info("🔗 CONNECTING TO JUPITER DEX...")
        try:
            response = await self.http_client.get(f"{self.jupiter_api}/tokens")
            if response.status_code == 200:
                logger.info("✅ JUPITER CONNECTION ESTABLISHED - READY TO TRADE")
            else:
                logger.error("❌ JUPITER CONNECTION FAILED")
                raise Exception("Failed to connect to Jupiter API")
        except Exception as e:
            logger.error(f"❌ JUPITER CONNECTION ERROR: {e}")
            raise
    
    def set_wallet(self, private_key: str):
        """Set trading wallet from private key"""
        try:
            # Handle both hex and base58 encoded private keys
            if len(private_key) == 128:  # Hex format
                key_bytes = bytes.fromhex(private_key)
            else:  # Base58 format
                key_bytes = base58.b58decode(private_key)
            
            self.wallet_keypair = Keypair.from_bytes(key_bytes)
            logger.info(f"✅ WALLET SET: {self.wallet_keypair.pubkey()}")
            return True
        except Exception as e:
            logger.error(f"❌ INVALID PRIVATE KEY: {e}")
            return False
    
    async def get_token_price(self, token_mint: str) -> Optional[float]:
        """Get real token price from Jupiter"""
        try:
            response = await self.http_client.get(
                f"{self.jupiter_api}/price",
                params={"ids": token_mint},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and token_mint in data["data"]:
                    return float(data["data"][token_mint]["price"])
            
            logger.warning(f"Could not fetch price for {token_mint}")
            return None
            
        except Exception as e:
            logger.error(f"Price fetch error for {token_mint}: {e}")
            return None
    
    async def get_quote(self, input_mint: str, output_mint: str, amount: int, slippage_bps: int = None) -> Optional[Dict]:
        """Get swap quote from Jupiter"""
        try:
            slippage = slippage_bps or self.slippage_bps
            
            response = await self.http_client.get(
                f"{self.jupiter_api}/quote",
                params={
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": amount,
                    "slippageBps": slippage,
                    "onlyDirectRoutes": "false",
                    "asLegacyTransaction": "false"
                },
                timeout=15.0
            )
            
            if response.status_code == 200:
                quote_data = response.json()
                logger.info(f"📊 QUOTE RECEIVED: {amount} {input_mint[:8]}... -> {quote_data.get('outAmount', 'N/A')} {output_mint[:8]}...")
                return quote_data
            else:
                logger.error(f"Quote request failed: {response.status_code} - {response.text}")
                return None
            
        except Exception as e:
            logger.error(f"Quote error: {e}")
            return None
    
    async def execute_swap(self, quote: Dict) -> Dict:
        """Execute REAL swap transaction through Jupiter"""
        if not self.wallet_keypair:
            return {"success": False, "error": "No wallet configured"}
        
        try:
            logger.info("🔄 EXECUTING REAL SWAP TRANSACTION...")
            
            # Get swap transaction from Jupiter
            swap_data = {
                "quoteResponse": quote,
                "userPublicKey": str(self.wallet_keypair.pubkey()),
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": 1000000  # 0.001 SOL priority fee
            }
            
            response = await self.http_client.post(
                f"{self.jupiter_api}/swap",
                json=swap_data,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"Swap instruction failed: {response.status_code} - {response.text}")
                return {"success": False, "error": f"Jupiter swap API error: {response.status_code}"}
            
            swap_response = response.json()
            
            # Get the transaction
            transaction_b64 = swap_response.get("swapTransaction")
            if not transaction_b64:
                return {"success": False, "error": "No transaction returned from Jupiter"}
            
            # Deserialize transaction
            transaction_bytes = base64.b64decode(transaction_b64)
            transaction = VersionedTransaction.from_bytes(transaction_bytes)
            
            # Sign transaction
            transaction.sign([self.wallet_keypair])
            
            # Send transaction
            logger.info("📡 SENDING TRANSACTION TO BLOCKCHAIN...")
            result = await self.rpc_client.send_transaction(
                transaction,
                opts={
                    "skip_preflight": False,
                    "preflight_commitment": "processed",
                    "max_retries": 3
                }
            )
            
            if result.value:
                tx_signature = str(result.value)
                logger.info(f"✅ TRANSACTION SENT: {tx_signature}")
                
                # Wait for confirmation
                await self._wait_for_confirmation(tx_signature)
                
                return {
                    "success": True,
                    "transaction_id": tx_signature,
                    "input_amount": quote.get("inAmount"),
                    "output_amount": quote.get("outAmount"),
                    "input_mint": quote.get("inputMint"),
                    "output_mint": quote.get("outputMint"),
                    "message": "REAL TRADE EXECUTED SUCCESSFULLY"
                }
            else:
                logger.error("Transaction failed to send")
                return {"success": False, "error": "Transaction failed to send"}
            
        except Exception as e:
            logger.error(f"Swap execution error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _wait_for_confirmation(self, tx_signature: str, max_retries: int = 30):
        """Wait for transaction confirmation"""
        logger.info(f"⏳ WAITING FOR CONFIRMATION: {tx_signature}")
        
        for i in range(max_retries):
            try:
                result = await self.rpc_client.get_signature_status(tx_signature)
                if result.value and result.value[0]:
                    status = result.value[0]
                    if status.confirmation_status:
                        logger.info(f"✅ TRANSACTION CONFIRMED: {tx_signature}")
                        return True
                    elif status.err:
                        logger.error(f"❌ TRANSACTION FAILED: {status.err}")
                        return False
                
                await asyncio.sleep(2)  # Wait 2 seconds between checks
                
            except Exception as e:
                logger.error(f"Error checking transaction status: {e}")
                await asyncio.sleep(2)
        
        logger.warning(f"⚠️ TRANSACTION CONFIRMATION TIMEOUT: {tx_signature}")
        return False
    
    async def buy_token(self, token_mint: str, sol_amount: float) -> Dict:
        """Buy token with SOL"""
        try:
            SOL_MINT = "So11111111111111111111111111111111111111112"
            amount_lamports = int(sol_amount * 1e9)  # Convert SOL to lamports
            
            logger.info(f"🟢 BUYING {token_mint[:8]}... with {sol_amount} SOL")
            
            # Get quote
            quote = await self.get_quote(SOL_MINT, token_mint, amount_lamports)
            if not quote:
                return {"success": False, "error": "Failed to get quote"}
            
            # Execute swap
            result = await self.execute_swap(quote)
            
            if result.get("success"):
                logger.info(f"💰 BUY ORDER EXECUTED: {sol_amount} SOL -> {token_mint[:8]}...")
            
            return result
            
        except Exception as e:
            logger.error(f"Buy error: {e}")
            return {"success": False, "error": str(e)}
    
    async def sell_token(self, token_mint: str, token_amount: int) -> Dict:
        """Sell token for SOL"""
        try:
            SOL_MINT = "So11111111111111111111111111111111111111112"
            
            logger.info(f"🔴 SELLING {token_amount} of {token_mint[:8]}... for SOL")
            
            # Get quote
            quote = await self.get_quote(token_mint, SOL_MINT, token_amount)
            if not quote:
                return {"success": False, "error": "Failed to get quote"}
            
            # Execute swap
            result = await self.execute_swap(quote)
            
            if result.get("success"):
                logger.info(f"💸 SELL ORDER EXECUTED: {token_amount} {token_mint[:8]}... -> SOL")
            
            return result
            
        except Exception as e:
            logger.error(f"Sell error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_wallet_balance(self) -> Dict:
        """Get current wallet balance"""
        if not self.wallet_keypair:
            return {"error": "No wallet configured"}
        
        try:
            # Get SOL balance
            sol_balance_result = await self.rpc_client.get_balance(self.wallet_keypair.pubkey())
            sol_balance = sol_balance_result.value / 1e9  # Convert lamports to SOL
            
            # Get SOL price
            sol_price = await self.get_token_price("So11111111111111111111111111111111111111112")
            
            return {
                "sol_balance": sol_balance,
                "sol_price": sol_price,
                "total_value_usd": sol_balance * (sol_price or 0),
                "wallet": str(self.wallet_keypair.pubkey())
            }
            
        except Exception as e:
            logger.error(f"Balance fetch error: {e}")
            return {"error": str(e)}
    
    async def get_token_accounts(self) -> List[Dict]:
        """Get all token accounts for the wallet"""
        if not self.wallet_keypair:
            return []
        
        try:
            # Get token accounts by owner
            result = await self.rpc_client.get_token_accounts_by_owner(
                self.wallet_keypair.pubkey(),
                {"programId": Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")}
            )
            
            token_accounts = []
            for account_info in result.value:
                account_data = account_info.account.data
                # Parse token account data here
                token_accounts.append({
                    "pubkey": str(account_info.pubkey),
                    "mint": "parsing_required",  # Would need proper parsing
                    "amount": "parsing_required"
                })
            
            return token_accounts
            
        except Exception as e:
            logger.error(f"Token accounts fetch error: {e}")
            return []
    
    async def shutdown(self):
        """Cleanup connections"""
        await self.http_client.aclose()
        await self.rpc_client.close()
        logger.info("✅ REAL JUPITER TRADER SHUTDOWN")

# Global trader instance
real_trader = RealJupiterTrader()

# Example usage
async def main():
    trader = RealJupiterTrader()
    await trader.initialize()
    
    # Set wallet (you need to provide your private key)
    # trader.set_wallet("your_private_key_here")
    
    # Get balance
    balance = await trader.get_wallet_balance()
    print(f"Wallet Balance: {balance}")
    
    await trader.shutdown()

if __name__ == "__main__":
    asyncio.run(main()) 