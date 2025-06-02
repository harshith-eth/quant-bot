#!/usr/bin/env python3
"""
🚀 QUANTUM DEGEN TRADING AI SWARM - REAL STARTUP SCRIPT
Advanced Multi-Agent Trading System - REAL VERSION
"""

import os
import sys
import time
import signal
import subprocess
import webbrowser
import threading
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import box

console = Console()

class TradingBotLauncher:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.base_dir = Path(__file__).parent
        self.backend_dir = self.base_dir / "backend"
        self.frontend_dir = self.base_dir / "frontend"
        self.venv_dir = self.base_dir / "venv"
        
    def display_banner(self):
banner = """
🚀 QUANTUM DEGEN TRADING AI SWARM 🚀
REAL AI-POWERED SOLANA TRADING SYSTEM
        
📊 Features:
• Real-time whale tracking
• Neural network price prediction  
• Fibonacci retracement analysis
• Jupiter DEX integration
• Live market analysis
• Risk management system
        """
        
        console.print(Panel(
            Text(banner, style="bold green"),
            title="[bold red]⚡ REAL TRADING BOT ⚡[/bold red]",
            border_style="bright_green",
            box=box.DOUBLE
        ))
    
    def check_requirements(self):
        """Check if all requirements are met"""
        console.print("\n[bold yellow]🔍 Checking System Requirements...[/bold yellow]")
        
        # Check Python virtual environment
        if not self.venv_dir.exists():
            console.print("[red]❌ Virtual environment not found[/red]")
            console.print("[yellow]Please run: python -m venv venv[/yellow]")
            return False
            
        # Check backend directory
        if not self.backend_dir.exists():
            console.print("[red]❌ Backend directory not found[/red]")
            return False
            
        # Check frontend directory  
        if not self.frontend_dir.exists():
            console.print("[red]❌ Frontend directory not found[/red]")
            return False
            
        console.print("[green]✅ All requirements satisfied[/green]")
        return True
    
    def get_python_executable(self):
        """Get the correct Python executable from venv"""
        if os.name == 'nt':  # Windows
            return self.venv_dir / "Scripts" / "python.exe"
        else:  # Unix/Linux/macOS
            return self.venv_dir / "bin" / "python"
    
    def start_backend(self):
        """Start the FastAPI backend server"""
        console.print("\n[bold cyan]🚀 Starting Backend Server...[/bold cyan]")
        
        python_exe = self.get_python_executable()
        
        # Start backend with uvicorn
        cmd = [
            str(python_exe), "-m", "uvicorn", "main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload"
        ]
        
        try:
            self.backend_process = subprocess.Popen(
                cmd,
                cwd=self.backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait for backend to start
            console.print("[yellow]⏳ Waiting for backend to initialize...[/yellow]")
            time.sleep(5)
            
            if self.backend_process.poll() is None:
                console.print("[green]✅ Backend server started on http://localhost:8000[/green]")
                return True
            else:
                console.print("[red]❌ Backend failed to start[/red]")
                return False
                
        except Exception as e:
            console.print(f"[red]❌ Error starting backend: {e}[/red]")
            return False
    
    def start_frontend(self):
        """Start the frontend dashboard"""
        console.print("\n[bold cyan]🌐 Starting Frontend Dashboard...[/bold cyan]")
        
        try:
            # Start simple HTTP server for frontend
            cmd = [sys.executable, "-m", "http.server", "3000"]
            
            self.frontend_process = subprocess.Popen(
                cmd,
                cwd=self.frontend_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            time.sleep(2)
            
            if self.frontend_process.poll() is None:
                console.print("[green]✅ Frontend dashboard started on http://localhost:3000[/green]")
        return True
            else:
                console.print("[red]❌ Frontend failed to start[/red]")
        return False

        except Exception as e:
            console.print(f"[red]❌ Error starting frontend: {e}[/red]")
            return False
    
    def open_dashboard(self):
        """Open the dashboard in browser"""
        console.print("\n[bold green]🔗 Opening Dashboard...[/bold green]")
        
        dashboard_url = "http://localhost:3000/dashboard/"
        
        try:
            webbrowser.open(dashboard_url)
            console.print(f"[green]✅ Dashboard opened: {dashboard_url}[/green]")
        except Exception as e:
            console.print(f"[yellow]⚠️  Could not auto-open browser: {e}[/yellow]")
            console.print(f"[yellow]Please manually open: {dashboard_url}[/yellow]")
    
    def show_status(self):
        """Show running status"""
        console.print("\n[bold green]🎉 TRADING BOT IS NOW RUNNING![/bold green]")
        console.print("\n[bold cyan]📊 Access Points:[/bold cyan]")
        console.print("• [green]Frontend Dashboard: http://localhost:3000/dashboard/[/green]")
        console.print("• [green]Backend API: http://localhost:8000[/green]")
        console.print("• [green]API Docs: http://localhost:8000/docs[/green]")
        
        console.print("\n[bold yellow]💡 Features Available:[/bold yellow]")
        console.print("• [cyan]Real-time market analysis[/cyan]")
        console.print("• [cyan]Whale activity tracking[/cyan]")
        console.print("• [cyan]AI neural network predictions[/cyan]")
        console.print("• [cyan]Fibonacci retracement analysis[/cyan]")
        console.print("• [cyan]Live signal feed[/cyan]")
        console.print("• [cyan]Portfolio tracking[/cyan]")
        console.print("• [cyan]Risk management[/cyan]")
        
        console.print("\n[bold red]⚠️  Controls:[/bold red]")
        console.print("• [yellow]Press Ctrl+C to stop the bot[/yellow]")
        console.print("• [yellow]Bot will continue running in background[/yellow]")
    
    def cleanup(self):
        """Clean up processes on exit"""
        console.print("\n[bold yellow]🛑 Stopping Trading Bot...[/bold yellow]")
        
        if self.backend_process:
            try:
                self.backend_process.terminate()
                self.backend_process.wait(timeout=5)
                console.print("[green]✅ Backend stopped[/green]")
            except:
                self.backend_process.kill()
                console.print("[yellow]⚠️  Backend force-stopped[/yellow]")
        
        if self.frontend_process:
            try:
                self.frontend_process.terminate()
                self.frontend_process.wait(timeout=5)
                console.print("[green]✅ Frontend stopped[/green]")
            except:
                self.frontend_process.kill()
                console.print("[yellow]⚠️  Frontend force-stopped[/yellow]")
    
    def run(self):
        """Main execution method"""
        try:
            self.display_banner()
            
            if not self.check_requirements():
                console.print("\n[red]❌ System requirements not met. Exiting...[/red]")
                return
            
            # Start backend
            if not self.start_backend():
                console.print("\n[red]❌ Failed to start backend. Exiting...[/red]")
                return
            
            # Start frontend
            if not self.start_frontend():
                console.print("\n[yellow]⚠️  Frontend failed to start, but backend is running[/yellow]")
            
            # Open dashboard
            self.open_dashboard()
            
            # Show status
            self.show_status()
            
            # Keep running until interrupted
            try:
                while True:
        time.sleep(1)
        
                    # Check if processes are still running
                    if self.backend_process and self.backend_process.poll() is not None:
                        console.print("[red]❌ Backend process died[/red]")
                        break
                        
            except KeyboardInterrupt:
                console.print("\n[yellow]🛑 Received interrupt signal[/yellow]")
                
        except Exception as e:
            console.print(f"\n[red]❌ Unexpected error: {e}[/red]")
            
        finally:
            self.cleanup()
            console.print("\n[bold green]✅ Trading Bot Shutdown Complete[/bold green]")

def main():
    """Main entry point"""
    launcher = TradingBotLauncher()
    launcher.run()

if __name__ == "__main__":
    main() 