#!/usr/bin/env python3

import subprocess
import threading
import webbrowser
import time
import os
import signal
import sys
from pathlib import Path

class QuantBotLauncher:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.root_dir = Path(__file__).parent.absolute()
        self.backend_dir = self.root_dir / "backend"
        self.frontend_dir = self.root_dir / "frontend"
        
    def check_dependencies(self):
        """Check if required directories and files exist"""
        if not self.backend_dir.exists():
            print("❌ Backend directory not found!")
            return False
            
        if not self.frontend_dir.exists():
            print("❌ Frontend directory not found!")
            return False
            
        if not (self.backend_dir / "package.json").exists():
            print("❌ Backend package.json not found!")
            return False
            
        if not (self.frontend_dir / "package.json").exists():
            print("❌ Frontend package.json not found!")
            return False
            
        return True
    
    def start_backend(self):
        """Start the backend server"""
        print("🚀 Starting backend server...")
        try:
            os.chdir(self.backend_dir)
            self.backend_process = subprocess.Popen(
                ["npm", "run", "dev"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # Monitor backend output
            for line in iter(self.backend_process.stdout.readline, ''):
                if line:
                    print(f"[BACKEND] {line.strip()}")
                    
        except Exception as e:
            print(f"❌ Failed to start backend: {e}")
    
    def start_frontend(self):
        """Start the frontend development server"""
        print("🎨 Starting frontend server...")
        try:
            os.chdir(self.frontend_dir)
            self.frontend_process = subprocess.Popen(
                ["npm", "run", "dev"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # Monitor frontend output
            for line in iter(self.frontend_process.stdout.readline, ''):
                if line:
                    print(f"[FRONTEND] {line.strip()}")
                    # Check if frontend is ready
                    if "Local:" in line and "localhost:3000" in line:
                        # Delay browser opening to ensure both servers are fully ready
                        threading.Timer(2.0, self.open_browser).start()
                        
        except Exception as e:
            print(f"❌ Failed to start frontend: {e}")
    
    def open_browser(self):
        """Open the browser to localhost:3000 (frontend)"""
        print("🌐 Opening browser...")
        time.sleep(3)  # Give the servers a moment to fully start
        webbrowser.open("http://localhost:3000")
    
    def signal_handler(self, signum, frame):
        """Handle Ctrl+C gracefully"""
        print("\n🛑 Shutting down servers...")
        self.cleanup()
        sys.exit(0)
    
    def cleanup(self):
        """Clean up processes"""
        if self.backend_process:
            self.backend_process.terminate()
            print("✅ Backend server stopped")
            
        if self.frontend_process:
            self.frontend_process.terminate()
            print("✅ Frontend server stopped")
    
    def run(self):
        """Main execution method"""
        print("🤖 Quant Bot Launcher Starting...")
        print("=" * 50)
        
        # Check dependencies
        if not self.check_dependencies():
            print("❌ Dependency check failed. Please ensure backend and frontend directories exist with package.json files.")
            return
        
        # Set up signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        
        # Start backend in a separate thread
        backend_thread = threading.Thread(target=self.start_backend, daemon=True)
        backend_thread.start()
        
        # Wait a bit for backend to initialize
        time.sleep(3)
        
        # Start frontend in a separate thread
        frontend_thread = threading.Thread(target=self.start_frontend, daemon=True)
        frontend_thread.start()
        
        print("\n" + "=" * 50)
        print("🎉 Both servers are starting up!")
        print("📱 Backend API: http://localhost:8000")
        print("🌐 Frontend UI: http://localhost:3000")
        print("🤖 Use the frontend to control your bot")
        print("Press Ctrl+C to stop all servers")
        print("=" * 50 + "\n")
        
        try:
            # Keep the main thread alive
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.signal_handler(signal.SIGINT, None)

if __name__ == "__main__":
    launcher = QuantBotLauncher()
    launcher.run() 