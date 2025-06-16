import { Connection } from '@solana/web3.js';
import { WhaleTrackerService } from './whale-tracker';

const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');

async function testWhaleTracker() {
  console.log('🧪 Testing Whale Tracker Service...');
  
  try {
    const whaleTracker = new WhaleTrackerService(connection);
    console.log('✅ Whale Tracker Service created');
    
    // Start tracking
    await whaleTracker.startTracking();
    console.log('✅ Whale Tracker started');
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get transactions
    const transactions = whaleTracker.getRecentTransactions(10);
    console.log(`📊 Found ${transactions.length} transactions:`);
    
    transactions.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.action} ${tx.amount.toFixed(2)} ${tx.tokenSymbol} ($${tx.usdValue.toFixed(2)}) - ${tx.wallet}`);
    });
    
    // Get stats
    const stats = whaleTracker.getWhaleStats();
    console.log('📈 Stats:', stats);
    
    // Check if active
    console.log('🔄 Is Active:', whaleTracker.isActive());
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWhaleTracker(); 