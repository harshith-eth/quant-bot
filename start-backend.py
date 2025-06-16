#!/usr/bin/env python3

import subprocess
import os
import signal
import sys
from pathlib import Path

def signal_handler(signum, frame):
    print("\n🛑 Backend server stopped")
    sys.exit(0)

def main():
    print("🔧 BACKEND SERVER")
    print("=" * 40)
    print("🚀 Starting Quant Bot Backend...")
    print("🔗 Will run on: http://localhost:8000")
    print("=" * 40)
    
    # Setup signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    # Get backend directory
    root_dir = Path(__file__).parent.absolute()
    backend_dir = root_dir / "backend"
    
    if not backend_dir.exists():
        print("❌ Backend directory not found!")
        return
    
    # Check if dependencies are installed
    if not (backend_dir / "node_modules").exists():
        print("📦 Installing backend dependencies...")
        try:
            subprocess.run(["npm", "install"], cwd=backend_dir, check=True)
            print("✅ Dependencies installed")
        except subprocess.CalledProcessError:
            print("❌ Failed to install dependencies")
            return
    
    # Start backend server
    try:
        os.chdir(backend_dir)
        print("🔧 Starting backend server...")
        subprocess.run(["npm", "run", "dev"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Backend server failed: {e}")
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)

if __name__ == "__main__":
    main() 