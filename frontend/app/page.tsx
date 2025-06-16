"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import StatsBar from "@/components/StatsBar"
import PortfolioStatus from "@/components/PortfolioStatus"
import ActivePositions from "@/components/ActivePositions"
import MemeScanner from "@/components/MemeScanner"
import SignalFeed from "@/components/SignalFeed"
import WhaleActivity from "@/components/WhaleActivity"
import MarketAnalysis from "@/components/MarketAnalysis"
import RiskManagement from "@/components/RiskManagement"
import AIAnalysis from "@/components/AIAnalysis"

export default function Dashboard() {
  const [botRunning, setBotRunning] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [backendConnected, setBackendConnected] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Check backend connection and bot status
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/status');
        if (response.ok) {
          const data = await response.json();
          setBotRunning(data.running);
          setBackendConnected(true);
        } else {
          setBackendConnected(false);
          console.error("Backend connection failed:", response.statusText);
        }
      } catch (error) {
        setBackendConnected(false);
        console.error("Error connecting to backend:", error);
      } finally {
        setIsCheckingConnection(false);
      }
    }

    // Check immediately
    checkBackendConnection();
    
    // Check every 5 seconds
    const interval = setInterval(checkBackendConnection, 5000);

    return () => clearInterval(interval);
  }, [])

  const handleStartBot = async () => {
    if (!backendConnected) {
      alert("Backend is not connected. Please ensure the backend server is running.");
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBotRunning(true);
        console.log("Bot started successfully:", data.message);
      } else {
        console.error("Failed to start bot:", data.message);
        alert(`Failed to start bot: ${data.message}`);
      }
    } catch (error) {
      console.error("Error starting bot:", error);
      alert("Error starting bot. Please check the console for details.");
    }
  }

  const handleStopBot = async () => {
    if (!backendConnected) {
      alert("Backend is not connected. Please ensure the backend server is running.");
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBotRunning(false);
        console.log("Bot stopped successfully:", data.message);
      } else {
        console.error("Failed to stop bot:", data.message);
        alert(`Failed to stop bot: ${data.message}`);
      }
    } catch (error) {
      console.error("Error stopping bot:", error);
      alert("Error stopping bot. Please check the console for details.");
    }
  }

  // Show loading state while checking connection
  if (isCheckingConnection) {
    return (
      <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-500 text-xl mb-4">🤖 Connecting to Backend...</div>
          <div className="text-sm">Please ensure both frontend and backend servers are running.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono overflow-hidden p-1">
      {/* Backend connection status */}
      {!backendConnected && (
        <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-2 text-sm mb-1">
          ⚠️ Backend Disconnected - Bot controls may not work. Please ensure backend server is running on port 8000.
        </div>
      )}
      
      <div className="grid grid-cols-4 grid-rows-[auto_auto_1fr_1fr] gap-2 h-[98vh]">
        <Header
          botRunning={botRunning}
          onStartBot={handleStartBot}
          onStopBot={handleStopBot}
          currentTime={currentTime}
        />

        <StatsBar />

        <div className="col-span-1">
          <PortfolioStatus />
        </div>

        <div className="col-span-1">
          <ActivePositions />
        </div>

        <div className="col-span-1">
          <MemeScanner />
        </div>

        <div className="col-span-1">
          <SignalFeed />
        </div>

        <div className="col-span-1">
          <WhaleActivity />
        </div>

        <div className="col-span-1">
          <MarketAnalysis />
        </div>

        <div className="col-span-1">
          <RiskManagement />
        </div>

        <div className="col-span-1">
          <AIAnalysis />
        </div>
      </div>
    </div>
  )
}
