import { Connection } from '@solana/web3.js';
import { WhaleTrackerService } from './whale-tracker';

const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');

async function debugWhaleTracker() {
  console.log('🧪 Debug Whale Tracker Service...');
  
  try {
    const whaleTracker = new WhaleTrackerService(connection);
    console.log('✅ Whale Tracker Service created');
    
    // Check initial state
    console.log('📊 Initial transactions:', whaleTracker.getRecentTransactions(5));
    
    // Start tracking
    await whaleTracker.startTracking();
    console.log('✅ Whale Tracker started');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get transactions again
    const transactions = whaleTracker.getRecentTransactions(10);
    console.log(`📊 Found ${transactions.length} transactions after start:`);
    transactions.forEach((tx, i) => {
      console.log(`  ${i+1}. ${tx.action} ${tx.amount} ${tx.tokenSymbol} ($${tx.usdValue.toFixed(2)}) - ${tx.wallet}`);
    });
    
    // Check stats
    const stats = whaleTracker.getWhaleStats();
    console.log('📈 Stats:', stats);
    
    // Stop tracking
    whaleTracker.stopTracking();
    console.log('✅ Whale Tracker stopped');
    
  } catch (error) {
    console.error('❌ Error debugging whale tracker:', error);
  }
}

debugWhaleTracker(); 