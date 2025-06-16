import { Logger } from 'pino';
import dotenv from 'dotenv';
import { Commitment } from '@solana/web3.js';
import { logger } from './logger';

dotenv.config();

const retrieveEnvVariable = (variableName: string, logger: Logger, required: boolean = true) => {
  const variable = process.env[variableName] || '';
  if (!variable && required) {
    logger.error(`${variableName} is not set`);
    process.exit(1);
  }
  return variable;
};

// Wallet (optional for server-only mode)
export const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// Connection
export const NETWORK = 'mainnet-beta';
export const COMMITMENT_LEVEL: Commitment = (retrieveEnvVariable('COMMITMENT_LEVEL', logger, false) || 'confirmed') as Commitment;
export const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger, false) || 'https://api.mainnet-beta.solana.com';
export const RPC_WEBSOCKET_ENDPOINT = retrieveEnvVariable('RPC_WEBSOCKET_ENDPOINT', logger, false) || 'wss://api.mainnet-beta.solana.com';

// Bot
export const LOG_LEVEL = retrieveEnvVariable('LOG_LEVEL', logger, false) || 'info';
export const ONE_TOKEN_AT_A_TIME = (retrieveEnvVariable('ONE_TOKEN_AT_A_TIME', logger, false) || 'true') === 'true';
export const COMPUTE_UNIT_LIMIT = Number(retrieveEnvVariable('COMPUTE_UNIT_LIMIT', logger, false) || '200000');
export const COMPUTE_UNIT_PRICE = Number(retrieveEnvVariable('COMPUTE_UNIT_PRICE', logger, false) || '1000');
export const PRE_LOAD_EXISTING_MARKETS = (retrieveEnvVariable('PRE_LOAD_EXISTING_MARKETS', logger, false) || 'false') === 'true';
export const CACHE_NEW_MARKETS = (retrieveEnvVariable('CACHE_NEW_MARKETS', logger, false) || 'true') === 'true';
export const TRANSACTION_EXECUTOR = retrieveEnvVariable('TRANSACTION_EXECUTOR', logger, false) || 'default';
export const CUSTOM_FEE = retrieveEnvVariable('CUSTOM_FEE', logger, false) || '0.01';

// Buy
export const AUTO_BUY_DELAY = Number(retrieveEnvVariable('AUTO_BUY_DELAY', logger, false) || '1000');
export const QUOTE_MINT = retrieveEnvVariable('QUOTE_MINT', logger, false) || 'WSOL';
export const QUOTE_AMOUNT = retrieveEnvVariable('QUOTE_AMOUNT', logger, false) || '0.01';
export const MAX_BUY_RETRIES = Number(retrieveEnvVariable('MAX_BUY_RETRIES', logger, false) || '3');
export const BUY_SLIPPAGE = Number(retrieveEnvVariable('BUY_SLIPPAGE', logger, false) || '10');

// Sell
export const AUTO_SELL = (retrieveEnvVariable('AUTO_SELL', logger, false) || 'false') === 'true';
export const AUTO_SELL_DELAY = Number(retrieveEnvVariable('AUTO_SELL_DELAY', logger, false) || '1000');
export const MAX_SELL_RETRIES = Number(retrieveEnvVariable('MAX_SELL_RETRIES', logger, false) || '3');
export const TAKE_PROFIT = Number(retrieveEnvVariable('TAKE_PROFIT', logger, false) || '50');
export const STOP_LOSS = Number(retrieveEnvVariable('STOP_LOSS', logger, false) || '30');
export const PRICE_CHECK_INTERVAL = Number(retrieveEnvVariable('PRICE_CHECK_INTERVAL', logger, false) || '1000');
export const PRICE_CHECK_DURATION = Number(retrieveEnvVariable('PRICE_CHECK_DURATION', logger, false) || '10000');
export const SELL_SLIPPAGE = Number(retrieveEnvVariable('SELL_SLIPPAGE', logger, false) || '10');

// Filters
export const FILTER_CHECK_INTERVAL = Number(retrieveEnvVariable('FILTER_CHECK_INTERVAL', logger, false) || '1000');
export const FILTER_CHECK_DURATION = Number(retrieveEnvVariable('FILTER_CHECK_DURATION', logger, false) || '10000');
export const CONSECUTIVE_FILTER_MATCHES = Number(retrieveEnvVariable('CONSECUTIVE_FILTER_MATCHES', logger, false) || '2');
export const CHECK_IF_MUTABLE = (retrieveEnvVariable('CHECK_IF_MUTABLE', logger, false) || 'true') === 'true';
export const CHECK_IF_SOCIALS = (retrieveEnvVariable('CHECK_IF_SOCIALS', logger, false) || 'true') === 'true';
export const CHECK_IF_MINT_IS_RENOUNCED = (retrieveEnvVariable('CHECK_IF_MINT_IS_RENOUNCED', logger, false) || 'true') === 'true';
export const CHECK_IF_FREEZABLE = (retrieveEnvVariable('CHECK_IF_FREEZABLE', logger, false) || 'true') === 'true';
export const CHECK_IF_BURNED = (retrieveEnvVariable('CHECK_IF_BURNED', logger, false) || 'true') === 'true';
export const MIN_POOL_SIZE = retrieveEnvVariable('MIN_POOL_SIZE', logger, false) || '1';
export const MAX_POOL_SIZE = retrieveEnvVariable('MAX_POOL_SIZE', logger, false) || '100';
export const USE_SNIPE_LIST = (retrieveEnvVariable('USE_SNIPE_LIST', logger, false) || 'false') === 'true';
export const SNIPE_LIST_REFRESH_INTERVAL = Number(retrieveEnvVariable('SNIPE_LIST_REFRESH_INTERVAL', logger, false) || '60000');
