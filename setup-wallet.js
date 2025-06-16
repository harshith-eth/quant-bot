const { Connection, Keypair, PublicKey, SystemProgram, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, NATIVE_MINT } = require('@solana/spl-token');
const bs58 = require('bs58');
require('dotenv').config();

async function setupWallet() {
  console.log('🔧 Setting up wallet for trading bot...\n');

  // Check if private key exists
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    return;
  }

  try {
    // Create connection
    const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Create wallet from private key
    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
    console.log(`💼 Wallet Address: ${wallet.publicKey.toString()}`);

    // Check SOL balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 SOL Balance: ${balance / 1e9} SOL`);

    if (balance < 0.01 * 1e9) {
      console.log('⚠️  Warning: Low SOL balance. You need at least 0.01 SOL for transactions.');
    }

    // Get WSOL token account address
    const wsolTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey);
    console.log(`🪙 WSOL Token Account: ${wsolTokenAccount.toString()}`);

    // Check if WSOL account exists
    try {
      const accountInfo = await connection.getAccountInfo(wsolTokenAccount);
      if (accountInfo) {
        console.log('✅ WSOL token account already exists');
        console.log('🎉 Wallet is ready for trading!');
        return;
      }
    } catch (error) {
      // Account doesn't exist, we'll create it
    }

    console.log('📝 Creating WSOL token account...');

    // Create WSOL token account
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        wsolTokenAccount, // ata
        wallet.publicKey, // owner
        NATIVE_MINT // mint
      )
    );

    // Send transaction
    const signature = await connection.sendTransaction(transaction, [wallet]);
    await connection.confirmTransaction(signature);

    console.log(`✅ WSOL token account created successfully!`);
    console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);
    console.log('🎉 Wallet is now ready for trading!');

  } catch (error) {
    console.error('❌ Error setting up wallet:', error.message);
  }
}

setupWallet(); 