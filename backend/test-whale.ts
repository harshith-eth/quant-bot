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
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get transactions
    const transactions = whaleTracker.getRecentTransactions(10);
    console.log(`📊 Found ${transactions.length} transactions:`);
    console.log(JSON.stringify(transactions, null, 2));
    
    // Stop tracking
    whaleTracker.stopTracking();
    console.log('✅ Whale Tracker stopped');
    
  } catch (error) {
    console.error('❌ Error testing whale tracker:', error);
  }
}

testWhaleTracker(); 