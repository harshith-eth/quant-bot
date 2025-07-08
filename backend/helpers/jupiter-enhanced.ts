import axios, { AxiosError } from 'axios';
import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';
import { logger } from './logger';

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | any;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapParams {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

export interface JupiterConfig {
  apiUrl: string;
  timeout: number;
  retryConfig: RetryConfig;
  fallbackEndpoints: string[];
  maxConcurrentRequests: number;
  rateLimitDelay: number;
}

export class JupiterEnhancedService {
  private config: JupiterConfig;
  private currentEndpointIndex: number = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests: number = 0;
  private lastRequestTime: number = 0;
  private connectionPool: Connection[] = [];
  private circuitBreaker: {
    failures: number;
    lastFailureTime: number;
    threshold: number;
    resetTimeout: number;
    isOpen: boolean;
  } = {
    failures: 0,
    lastFailureTime: 0,
    threshold: 5,
    resetTimeout: 60000, // 1 minute
    isOpen: false
  };

  constructor(config?: Partial<JupiterConfig>) {
    this.config = {
      apiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
      timeout: parseInt(process.env.JUPITER_TIMEOUT || '30000'),
      retryConfig: {
        maxRetries: parseInt(process.env.JUPITER_RETRY_ATTEMPTS || '5'),
        initialDelay: parseInt(process.env.JUPITER_RETRY_DELAY || '1000'),
        maxDelay: 30000,
        exponentialBase: 2,
        jitter: true
      },
      fallbackEndpoints: [
        'https://quote-api.jup.ag/v6',
        'https://quote-api.jup.ag/v4',
        'https://api.jup.ag/quote/v1'
      ],
      maxConcurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '3'),
      rateLimitDelay: 100,
      ...config
    };

    logger.info('🪐 Jupiter Enhanced Service initialized with advanced retry logic');
  }

  /**
   * Enhanced quote fetching with retry logic and fallback mechanisms
   */
  async getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
    return this.executeWithRetry(async () => {
      await this.rateLimitCheck();
      
      const endpoint = this.getCurrentEndpoint();
      const url = `${endpoint}/quote`;
      
      const response = await axios.get(url, {
        params: {
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippageBps: params.slippageBps || 1500,
          onlyDirectRoutes: params.onlyDirectRoutes || false,
          asLegacyTransaction: params.asLegacyTransaction || false
        },
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'QuantBot/3.0',
          'Accept': 'application/json'
        }
      });

      if (!response.data) {
        throw new Error('Empty response from Jupiter Quote API');
      }

      this.onRequestSuccess();
      return response.data;
    }, 'getQuote');
  }

  /**
   * Enhanced swap transaction creation with retry logic
   */
  async getSwapTransaction(params: JupiterSwapParams): Promise<JupiterSwapResponse> {
    return this.executeWithRetry(async () => {
      await this.rateLimitCheck();
      
      const endpoint = this.getCurrentEndpoint();
      const url = `${endpoint}/swap`;
      
      const response = await axios.post(url, {
        quoteResponse: params.quoteResponse,
        userPublicKey: params.userPublicKey,
        wrapAndUnwrapSol: params.wrapAndUnwrapSol !== false,
        dynamicComputeUnitLimit: params.dynamicComputeUnitLimit !== false,
        prioritizationFeeLamports: params.prioritizationFeeLamports || 100000
      }, {
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'QuantBot/3.0',
          'Accept': 'application/json'
        }
      });

      if (!response.data?.swapTransaction) {
        throw new Error('No swap transaction returned from Jupiter');
      }

      this.onRequestSuccess();
      return response.data;
    }, 'getSwapTransaction');
  }

  /**
   * Complete swap execution with enhanced error handling
   */
  async executeSwap(
    connection: Connection,
    wallet: Keypair,
    params: JupiterQuoteParams,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<{ signature: string; confirmed: boolean; error?: string }> {
    try {
      onProgress?.('Getting quote', 10);
      
      // Get quote with retry logic
      const quote = await this.getQuote(params);
      
      onProgress?.('Preparing transaction', 30);
      
      // Get swap transaction with retry logic
      const swapData = await this.getSwapTransaction({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString()
      });

      onProgress?.('Signing transaction', 50);
      
      // Deserialize and sign transaction
      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      transaction.sign([wallet]);

      onProgress?.('Sending transaction', 70);
      
      // Send transaction with retry logic
      const signature = await this.sendTransactionWithRetry(connection, transaction);
      
      onProgress?.('Confirming transaction', 90);
      
      // Confirm transaction with timeout
      const confirmed = await this.confirmTransactionWithTimeout(connection, signature, 60000);
      
      onProgress?.('Completed', 100);
      
      return { signature, confirmed };
      
    } catch (error) {
      logger.error('Jupiter swap execution failed:', error);
      return { 
        signature: '', 
        confirmed: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Execute function with retry logic and circuit breaker
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      if (Date.now() - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        logger.info(`🔄 Circuit breaker reset for ${operationName}`);
      } else {
        throw new Error(`Circuit breaker is open for ${operationName}`);
      }
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryableError(error)) {
          logger.error(`Non-retryable error in ${operationName}:`, error);
          throw error;
        }

        if (attempt === this.config.retryConfig.maxRetries) {
          this.onRequestFailure();
          logger.error(`Max retries exceeded for ${operationName}:`, error);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        logger.warn(`Retry ${attempt + 1}/${this.config.retryConfig.maxRetries} for ${operationName} in ${delay}ms`);
        
        await this.sleep(delay);
        
        // Switch to next endpoint if available
        if (this.isEndpointError(error)) {
          this.switchToNextEndpoint();
        }
      }
    }

    throw lastError || new Error(`Operation ${operationName} failed after all retries`);
  }

  /**
   * Send transaction with retry logic
   */
  private async sendTransactionWithRetry(
    connection: Connection,
    transaction: VersionedTransaction
  ): Promise<string> {
    return this.executeWithRetry(async () => {
      return await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
    }, 'sendTransaction');
  }

  /**
   * Confirm transaction with timeout
   */
  private async confirmTransactionWithTimeout(
    connection: Connection,
    signature: string,
    timeout: number = 60000
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Transaction confirmation timeout'));
      }, timeout);

      connection.confirmTransaction(signature, 'confirmed')
        .then(confirmation => {
          clearTimeout(timeoutId);
          resolve(!confirmation.value.err);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Rate limiting check
   */
  private async rateLimitCheck(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.config.rateLimitDelay) {
      await this.sleep(this.config.rateLimitDelay - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Calculate delay for exponential backoff with jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.retryConfig.initialDelay * 
      Math.pow(this.config.retryConfig.exponentialBase, attempt);
    
    const cappedDelay = Math.min(exponentialDelay, this.config.retryConfig.maxDelay);
    
    if (this.config.retryConfig.jitter) {
      // Add ±25% jitter
      const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    if (error.response?.status) {
      const status = error.response.status;
      return status >= 500 || status === 429 || status === 408;
    }
    
    return false;
  }

  /**
   * Check if error is endpoint-related
   */
  private isEndpointError(error: any): boolean {
    return error.code === 'ECONNREFUSED' || 
           error.code === 'ENOTFOUND' || 
           error.response?.status >= 500;
  }

  /**
   * Switch to next endpoint
   */
  private switchToNextEndpoint(): void {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.config.fallbackEndpoints.length;
    logger.info(`🔄 Switched to fallback endpoint: ${this.getCurrentEndpoint()}`);
  }

  /**
   * Get current endpoint
   */
  private getCurrentEndpoint(): string {
    return this.config.fallbackEndpoints[this.currentEndpointIndex] || this.config.apiUrl;
  }

  /**
   * Handle successful request
   */
  private onRequestSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
  }

  /**
   * Handle failed request
   */
  private onRequestFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      logger.warn('🚨 Circuit breaker opened due to excessive failures');
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service health status
   */
  getHealthStatus(): object {
    return {
      currentEndpoint: this.getCurrentEndpoint(),
      circuitBreaker: this.circuitBreaker,
      activeRequests: this.activeRequests,
      config: {
        timeout: this.config.timeout,
        maxRetries: this.config.retryConfig.maxRetries,
        endpoints: this.config.fallbackEndpoints.length
      }
    };
  }
}

// Export singleton instance
export const jupiterEnhanced = new JupiterEnhancedService();