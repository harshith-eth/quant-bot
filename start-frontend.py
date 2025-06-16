#!/usr/bin/env python3

import subprocess
import os
import signal
import sys
import webbrowser
from pathlib import Path

def signal_handler(signum, frame):
    print("\n🛑 Frontend server stopped")
    sys.exit(0)

def main():
    print("🎨 FRONTEND SERVER")
    print("=" * 40)
    print("🚀 Starting Quant Bot Frontend...")
    print("🌐 Will run on: http://localhost:3000")
    print("=" * 40)
    
    # Setup signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    # Get frontend directory
    root_dir = Path(__file__).parent.absolute()
    frontend_dir = root_dir / "frontend"
    
    if not frontend_dir.exists():
        print("❌ Frontend directory not found!")
        return
    
    # Check if dependencies are installed
    if not (frontend_dir / "node_modules").exists():
        print("📦 Installing frontend dependencies...")
        try:
            subprocess.run(["npm", "install", "--legacy-peer-deps"], cwd=frontend_dir, check=True)
            print("✅ Dependencies installed")
        except subprocess.CalledProcessError:
            print("❌ Failed to install dependencies")
            return
    
    # Start frontend server
    try:
        os.chdir(frontend_dir)
        print("🎨 Starting frontend server...")
        
        # Set environment variable to ensure port 3000
        env = os.environ.copy()
        env['PORT'] = '3000'
        
        # Start the server
        process = subprocess.Popen(["npm", "run", "dev"], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        
        # Monitor output and open browser when ready
        browser_opened = False
        for line in iter(process.stdout.readline, ''):
            if line:
                print(line.strip())
                # Open browser when server is ready
                if not browser_opened and "Local:" in line and "localhost:3000" in line:
                    print("🌐 Opening browser...")
                    try:
                        webbrowser.open("http://localhost:3000")
                        browser_opened = True
                    except:
                        pass
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Frontend server failed: {e}")
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)

if __name__ == "__main__":
    main() 