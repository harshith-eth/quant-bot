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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Check bot status on component mount
  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/status');
        const data = await response.json();
        setBotRunning(data.running);
      } catch (error) {
        console.error("Error checking bot status:", error);
      }
    }

    checkBotStatus();
  }, [])

  const handleStartBot = async () => {
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
      }
    } catch (error) {
      console.error("Error starting bot:", error);
    }
  }

  const handleStopBot = async () => {
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
      }
    } catch (error) {
      console.error("Error stopping bot:", error);
    }
  }

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono overflow-hidden p-1">
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
