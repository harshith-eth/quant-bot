/**
 * Chart Component for Quant-Bot Trading Dashboard
 * Renders performance charts with real-time WebSocket data
 */

class DashboardChart {
    constructor(elementId, options = {}) {
        this.elementId = elementId;
        this.container = document.getElementById(elementId);
        if (!this.container) {
            console.error(`Container element with ID '${elementId}' not found`);
            return;
        }

        // Default options
        this.options = {
            type: options.type || 'line',
            height: options.height || 200,
            padding: options.padding || { top: 10, right: 10, bottom: 20, left: 40 },
            showVolume: options.showVolume !== undefined ? options.showVolume : false,
            colors: options.colors || {
                background: 'rgba(0,0,0,0.1)',
                line: '#00ff00',
                text: '#8b949e',
                grid: 'rgba(0, 255, 0, 0.1)',
                volume: 'rgba(0, 255, 0, 0.2)',
                positive: '#00ff00',
                negative: '#ff0000'
            },
            animate: options.animate !== undefined ? options.animate : true
        };

        // Initialize chart data
        this.data = [];
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.options.height;
        this.container.appendChild(this.canvas);
        
        // Get context
        this.ctx = this.canvas.getContext('2d');
        
        // Add resize handler
        window.addEventListener('resize', () => this.handleResize());
        
        // Initial render
        this.render();
    }
    
    handleResize() {
        // Update canvas dimensions
        if (this.container) {
            this.canvas.width = this.container.clientWidth;
            this.render();
        }
    }
    
    setData(data) {
        this.data = data;
        this.render();
    }
    
    render() {
        const { ctx, canvas, options, data } = this;
        if (!ctx || data.length === 0) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate chart dimensions
        const chartWidth = canvas.width - options.padding.left - options.padding.right;
        const chartHeight = canvas.height - options.padding.top - options.padding.bottom;
        const volumeHeight = options.showVolume ? chartHeight * 0.2 : 0;
        const priceHeight = chartHeight - volumeHeight;
        
        // Find min/max values for scaling
        let minValue = Math.min(...data.map(d => d.value));
        let maxValue = Math.max(...data.map(d => d.value));
        
        // Add some padding to min/max
        const padding = (maxValue - minValue) * 0.1;
        minValue -= padding;
        maxValue += padding;
        
        // Draw background
        ctx.fillStyle = options.colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        this.drawGrid(minValue, maxValue, priceHeight);
        
        // Draw price line or candles
        if (options.type === 'line') {
            this.drawLine(data, minValue, maxValue, priceHeight);
        } else if (options.type === 'candlestick' && data[0] && data[0].open !== undefined) {
            this.drawCandles(data, minValue, maxValue, priceHeight);
        }
        
        // Draw volume if enabled
        if (options.showVolume && data[0] && data[0].volume !== undefined) {
            this.drawVolume(data, volumeHeight);
        }
        
        // Draw axes labels
        this.drawAxes(minValue, maxValue);
    }
    
    drawGrid(minValue, maxValue, priceHeight) {
        const { ctx, canvas, options } = this;
        ctx.strokeStyle = options.colors.grid;
        ctx.lineWidth = 0.5;
        
        // Horizontal grid lines
        const gridCount = 4;
        for (let i = 0; i <= gridCount; i++) {
            const y = options.padding.top + (priceHeight / gridCount * i);
            ctx.beginPath();
            ctx.moveTo(options.padding.left, y);
            ctx.lineTo(canvas.width - options.padding.right, y);
            ctx.stroke();
            
            // Add value label
            const value = maxValue - ((maxValue - minValue) / gridCount * i);
            ctx.fillStyle = options.colors.text;
            ctx.font = '10px "Courier New", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(value.toFixed(2), options.padding.left - 5, y + 3);
        }
        
        // Time labels (only first, middle and last for simplicity)
        if (this.data.length > 0) {
            const timePositions = [0, Math.floor(this.data.length / 2), this.data.length - 1];
            const chartWidth = canvas.width - options.padding.left - options.padding.right;
            
            timePositions.forEach(i => {
                if (this.data[i]) {
                    const x = options.padding.left + (chartWidth / (this.data.length - 1) * i);
                    const date = new Date(this.data[i].time);
                    const timeLabel = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                    
                    ctx.fillStyle = options.colors.text;
                    ctx.font = '10px "Courier New", monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(timeLabel, x, canvas.height - 5);
                }
            });
        }
    }
    
    drawLine(data, minValue, maxValue, priceHeight) {
        const { ctx, canvas, options } = this;
        const chartWidth = canvas.width - options.padding.left - options.padding.right;
        
        // Set line style
        ctx.strokeStyle = options.colors.line;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        // Create path
        ctx.beginPath();
        data.forEach((point, index) => {
            const x = options.padding.left + (chartWidth / (data.length - 1) * index);
            const normalizedValue = (point.value - minValue) / (maxValue - minValue);
            const y = options.padding.top + priceHeight - (normalizedValue * priceHeight);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Add gradient fill
        if (data.length > 1) {
            const gradient = ctx.createLinearGradient(0, options.padding.top, 0, options.padding.top + priceHeight);
            gradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 255, 0, 0.0)');
            
            ctx.fillStyle = gradient;
            ctx.lineTo(options.padding.left + chartWidth, options.padding.top + priceHeight);
            ctx.lineTo(options.padding.left, options.padding.top + priceHeight);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    drawCandles(data, minValue, maxValue, priceHeight) {
        const { ctx, canvas, options } = this;
        const chartWidth = canvas.width - options.padding.left - options.padding.right;
        
        // Calculate candle width
        const candleWidth = Math.max(4, (chartWidth / data.length) * 0.8);
        const wickWidth = 1;
        
        data.forEach((candle, index) => {
            const x = options.padding.left + (chartWidth / (data.length) * (index + 0.5));
            const open = (candle.open - minValue) / (maxValue - minValue);
            const close = (candle.close - minValue) / (maxValue - minValue);
            const high = (candle.high - minValue) / (maxValue - minValue);
            const low = (candle.low - minValue) / (maxValue - minValue);
            
            const openY = options.padding.top + priceHeight - (open * priceHeight);
            const closeY = options.padding.top + priceHeight - (close * priceHeight);
            const highY = options.padding.top + priceHeight - (high * priceHeight);
            const lowY = options.padding.top + priceHeight - (low * priceHeight);
            
            // Draw wick
            ctx.beginPath();
            ctx.strokeStyle = candle.open > candle.close ? options.colors.negative : options.colors.positive;
            ctx.lineWidth = wickWidth;
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();
            
            // Draw candle body
            ctx.fillStyle = candle.open > candle.close ? options.colors.negative : options.colors.positive;
            const candleHeight = Math.abs(closeY - openY);
            const yStart = Math.min(openY, closeY);
            ctx.fillRect(x - candleWidth / 2, yStart, candleWidth, candleHeight || 1);
        });
    }
    
    drawVolume(data, volumeHeight) {
        if (volumeHeight <= 0) return;
        
        const { ctx, canvas, options } = this;
        const chartWidth = canvas.width - options.padding.left - options.padding.right;
        const volumeY = canvas.height - options.padding.bottom - volumeHeight;
        
        // Find max volume
        const maxVolume = Math.max(...data.map(d => d.volume));
        
        // Calculate bar width
        const barWidth = Math.max(2, (chartWidth / data.length) * 0.8);
        
        data.forEach((point, index) => {
            const x = options.padding.left + (chartWidth / data.length * (index + 0.5));
            const normalizedVolume = point.volume / maxVolume;
            const height = normalizedVolume * volumeHeight;
            
            // Draw volume bar
            ctx.fillStyle = options.colors.volume;
            ctx.fillRect(x - barWidth / 2, volumeY + volumeHeight - height, barWidth, height);
        });
    }
    
    drawAxes(minValue, maxValue) {
        const { ctx, canvas, options } = this;
        
        // Draw y-axis line
        ctx.strokeStyle = options.colors.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(options.padding.left, options.padding.top);
        ctx.lineTo(options.padding.left, canvas.height - options.padding.bottom);
        ctx.stroke();
        
        // Draw x-axis line
        ctx.beginPath();
        ctx.moveTo(options.padding.left, canvas.height - options.padding.bottom);
        ctx.lineTo(canvas.width - options.padding.right, canvas.height - options.padding.bottom);
        ctx.stroke();
        
        // Add title if provided
        if (options.title) {
            ctx.fillStyle = options.colors.text;
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(options.title, canvas.width / 2, options.padding.top - 5);
        }
    }
    
    // Update data with new point for real-time updates
    addPoint(point) {
        this.data.push(point);
        
        // Keep data within reasonable size
        const maxPoints = 100;
        if (this.data.length > maxPoints) {
            this.data.shift();
        }
        
        this.render();
    }
    
    // Clear all data
    clearData() {
        this.data = [];
        this.render();
    }
}

// Make available globally
window.DashboardChart = DashboardChart;