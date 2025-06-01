#!/usr/bin/env python3
"""
🚀 QUANTUM DEGEN TRADING AI SWARM - LAUNCHER
Simple script to start the entire trading system
"""

import subprocess
import sys
import time
import threading
import webbrowser
from pathlib import Path

def check_dependencies():
    """Check if required packages are installed"""
    required_packages = ['rich', 'fastapi', 'uvicorn', 'websockets']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing packages: {', '.join(missing_packages)}")
        print("Installing required packages...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install'] + missing_packages)
        print("✅ All packages installed!")

def start_backend():
    """Start the FastAPI backend server"""
    print("🚀 Starting backend server...")
    backend_dir = Path(__file__).parent / "backend"
    subprocess.run([
        sys.executable, "-m", "uvicorn", "main:app", 
        "--host", "0.0.0.0", 
        "--port", "8000",
        "--reload"
    ], cwd=backend_dir)

def start_frontend():
    """Start a simple HTTP server for the frontend"""
    print("🌐 Starting frontend server...")
    frontend_dir = Path(__file__).parent / "frontend"
    subprocess.run([
        sys.executable, "-m", "http.server", "3000"
    ], cwd=frontend_dir)

def main():
    print("🤖 QUANTUM DEGEN TRADING AI SWARM LAUNCHER")
    print("=" * 50)
    
    # Check dependencies
    check_dependencies()
    
    # Ask user what they want to do
    print("\nChoose an option:")
    print("1. 🎯 Full Demo (Terminal + Web Dashboard)")
    print("2. 💻 Terminal Setup Only")
    print("3. 🌐 Web Dashboard Only")
    print("4. 🚀 Quick Start (Auto-launch everything)")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "1":
        # Full demo - start terminal first, then web
        print("\n🎯 Starting Full Demo Mode...")
        
        # Start backend in background
        backend_thread = threading.Thread(target=start_backend, daemon=True)
        backend_thread.start()
        
        # Wait a bit for backend to start
        time.sleep(3)
        
        # Open web dashboard
        webbrowser.open("http://localhost:8000/static/dashboard/")
        
        # Run terminal interface
        subprocess.run([sys.executable, "start_bot.py"])
        
    elif choice == "2":
        # Terminal only
        print("\n💻 Starting Terminal Setup...")
        subprocess.run([sys.executable, "start_bot.py"])
        
    elif choice == "3":
        # Web only
        print("\n🌐 Starting Web Dashboard...")
        
        # Start backend in background
        backend_thread = threading.Thread(target=start_backend, daemon=True)
        backend_thread.start()
        
        time.sleep(2)
        webbrowser.open("http://localhost:8000/static/dashboard/")
        
        print("✅ Dashboard opened in browser!")
        print("🔗 URL: http://localhost:8000/static/dashboard/")
        print("Press Ctrl+C to stop the server")
        
        try:
            backend_thread.join()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
            
    elif choice == "4":
        # Quick start everything
        print("\n🚀 Quick Start - Launching everything...")
        
        # Start backend
        backend_thread = threading.Thread(target=start_backend, daemon=True)
        backend_thread.start()
        
        time.sleep(2)
        
        # Open dashboard
        webbrowser.open("http://localhost:8000/static/dashboard/")
        
        print("✅ System launched!")
        print("🔗 Dashboard: http://localhost:8000/static/dashboard/")
        print("📊 API: http://localhost:8000/docs")
        print("\nPress Enter to run terminal setup or Ctrl+C to exit...")
        
        try:
            input()
            subprocess.run([sys.executable, "start_bot.py"])
        except KeyboardInterrupt:
            print("\n🛑 Shutting down...")
    
    else:
        print("❌ Invalid choice. Please run again and select 1-4.")

if __name__ == "__main__":
    main() 