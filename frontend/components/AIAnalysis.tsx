import React, { useState, useEffect, useRef } from 'react';

interface TradeLog {
  id: string;
  timestamp: Date;
  type: 'buy' | 'sell' | 'info' | 'error';
  message: string;
  mint?: string;
  signature?: string;
  url?: string;
}

interface BotStatus {
  running: boolean;
  connected: boolean;
}

export default function ExecuteTrades() {
  const [botStatus, setBotStatus] = useState<BotStatus>({ running: false, connected: false });
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll to bottom when new logs are added
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [tradeLogs]);

  // WebSocket connection for real-time trade logs
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        // Close existing connection if any
        if (wsRef.current) {
          wsRef.current.close();
        }

        console.log('🔌 Attempting to connect to WebSocket at ws://localhost:8000');
        const ws = new WebSocket('ws://localhost:8000');
        wsRef.current = ws;

        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            console.error('❌ WebSocket connection timeout');
            ws.close();
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('🔌 Connected to trade logs WebSocket');
          setWsConnected(true);
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'tradeLog') {
              const log = {
                ...data.data,
                timestamp: new Date(data.data.timestamp)
              };
              setTradeLogs(prev => [...prev.slice(-49), log]); // Keep last 50 logs
            } else if (data.type === 'initialLogs') {
              const logs = data.data.map((log: any) => ({
                ...log,
                timestamp: new Date(log.timestamp)
              }));
              setTradeLogs(logs);
            } else if (data.type === 'clearLogs') {
              setTradeLogs([]);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(`🔌 WebSocket connection closed - Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
          setWsConnected(false);
          
          // Only attempt to reconnect if it wasn't a manual close and we haven't exceeded max attempts
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
            console.log(`🔄 Attempting to reconnect WebSocket in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              connectWebSocket();
            }, delay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('❌ Max WebSocket reconnection attempts reached');
          }
        };

        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ WebSocket error occurred:', error);
          console.error('WebSocket state:', ws.readyState);
          setWsConnected(false);
        };
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        setWsConnected(false);
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`🔄 Retrying WebSocket connection in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      }
    };

    // Load initial trade logs via HTTP as fallback
    const loadInitialLogs = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/trade-logs?limit=50');
        if (response.ok) {
          const logs = await response.json();
          const formattedLogs = logs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }));
          setTradeLogs(formattedLogs);
          console.log('📊 Loaded initial trade logs via HTTP');
        }
      } catch (error) {
        console.error('Failed to load initial trade logs:', error);
      }
    };

    // Load initial logs first, then connect WebSocket
    loadInitialLogs();
    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting'); // Normal closure
      }
    };
  }, []);

  // Check bot status periodically
  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/status');
        if (response.ok) {
          const data = await response.json();
          setBotStatus({ running: data.running, connected: true });
        } else {
          setBotStatus({ running: false, connected: false });
        }
      } catch (error) {
        setBotStatus({ running: false, connected: false });
      }
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const clearLogs = async () => {
    try {
      await fetch('http://localhost:8000/api/trade-logs', {
        method: 'DELETE',
      });
      // Logs will be cleared via WebSocket message
    } catch (error) {
      console.error('Failed to clear logs:', error);
      // Fallback: clear locally
      setTradeLogs([]);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'buy': return 'text-green-500';
      case 'sell': return 'text-red-500';
      case 'info': return 'text-blue-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-300';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'buy': return '📈';
      case 'sell': return '📉';
      case 'info': return 'ℹ️';
      case 'error': return '❌';
      default: return '•';
    }
  };

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
        <span>EXECUTE TRADES</span>
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className={`inline-block w-2 h-2 rounded-full ${botStatus.running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
          {botStatus.running ? 'ACTIVE' : 'INACTIVE'}
        </div>
      </h2>
      
              <div className="absolute top-6 left-0 right-0 bottom-0 flex flex-col">
        {/* Control Panel */}
        <div className="p-2 border-b border-green-500/20 bg-green-500/5">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">WebSocket:</span>
                <span className={wsConnected ? 'text-green-500' : 'text-red-500'}>
                  {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Bot:</span>
                <span className={botStatus.running ? 'text-green-500' : 'text-gray-500'}>
                  {botStatus.running ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={clearLogs}
                className="px-2 py-1 text-xs border border-green-500/30 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors"
              >
                🗑️ CLEAR
              </button>
              <div className="text-xs text-gray-400 flex items-center">
                Logs: {tradeLogs.length}/50
              </div>
            </div>
          </div>
        </div>

        {/* Trade Logs */}
        <div className="flex-1 overflow-y-auto p-2 bg-black/50 scrollbar-hide">
          {tradeLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 text-sm">
                {botStatus.running ? (
                  <>
                    <div className="animate-pulse">🤖 Bot is running...</div>
                    <div className="text-xs mt-1">Waiting for trade activity...</div>
                  </>
                ) : (
                  <>
                    <div>📊 Ready to execute trades</div>
                    <div className="text-xs mt-1">Use the START BOT button in the header to begin</div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {tradeLogs.map((log, index) => (
                <div
                  key={`${log.id}-${index}-${log.timestamp.getTime()}`}
                  className="flex items-start gap-2 p-2 rounded bg-black/30 border border-green-500/10 hover:border-green-500/20 transition-colors"
                >
                  <div className="text-xs text-gray-500 font-mono min-w-[60px]">
                    {formatTime(log.timestamp)}
                  </div>
                  <div className="text-xs">
                    {getLogIcon(log.type)}
                  </div>
                  <div className={`text-xs flex-1 ${getLogColor(log.type)}`}>
                    {log.message}
                    {log.mint && (
                      <div className="text-gray-400 mt-1">
                        Mint: <span className="font-mono">{log.mint.slice(0, 8)}...{log.mint.slice(-4)}</span>
                      </div>
                    )}
                    {log.url && (
                      <div className="mt-1">
                        <a
                          href={log.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline text-xs"
                        >
                          View on Solscan →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="p-2 border-t border-green-500/20 bg-green-500/5">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Backend:</span>
                <span className={botStatus.connected ? 'text-green-500' : 'text-red-500'}>
                  {botStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Logs:</span>
                <span className={wsConnected ? 'text-green-500' : 'text-red-500'}>
                  {wsConnected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>
            <div className="text-gray-400">
              {botStatus.running && wsConnected && (
                <span className="animate-pulse">● Real-time Trading</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
