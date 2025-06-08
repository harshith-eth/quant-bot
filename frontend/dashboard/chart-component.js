/**
 * Real-time Chart Component for Dashboard
 * Provides line and candlestick chart visualization for price and P&L data
 */

class DashboardChart {
    /**
     * Initialize a new chart
     * @param {string} containerId - ID of container element to render chart
     * @param {Object} options - Chart configuration options
     */
    constructor(containerId, options = {}) {
        // Store references
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        // Default options
        this.options = {
            type: 'line',            // 'line' or 'candlestick'
            timeframe: '1h',         // Chart timeframe
            height: 200,             // Chart height
            showVolume: false,       // Show volume bars
            showGrid: true,          // Show grid lines
            showAxis: true,          // Show axis
            showLegend: true,        // Show legend
            autoScale: true,         // Auto scale y-axis
            theme: 'dark',           // Chart theme
            colors: {
                background: 'transparent',
                grid: 'rgba(0, 255, 0, 0.1)',
                line: '#00ff00',
                candle: {
                    up: '#00ff00',
                    down: '#ff0000',
                    wick: '#ffffff'
                },
                volume: {
                    up: 'rgba(0, 255, 0, 0.3)',
                    down: 'rgba(255, 0, 0, 0.3)'
                }
            },
            ...options
        };
        
        // Data management
        this.data = {
            line: [],
            candles: []
        };
        
        // Max data points to keep
        this.maxDataPoints = 100;
        
        // Initialize the chart
        this.initializeChart();
    }
    
    /**
     * Initialize the chart canvas and setup
     */
    initializeChart() {
        if (!this.container) {
            console.error(`Container element #${this.containerId} not found`);
            return;
        }
        
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.options.height;
        this.canvas.style.width = '100%';
        this.canvas.style.height = `${this.options.height}px`;
        
        // Add the canvas to container
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);
        
        // Get context for drawing
        this.ctx = this.canvas.getContext('2d');
        
        // Initial draw
        this.redraw();
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.resizeChart();
        });
    }
    
    /**
     * Resize the chart canvas
     */
    resizeChart() {
        if (!this.canvas || !this.container) return;
        
        // Update canvas dimensions
        this.canvas.width = this.container.clientWidth;
        
        // Redraw chart
        this.redraw();
    }
    
    /**
     * Add data to the chart
     * @param {Object|Array} newData - New data point(s) to add
     * @param {boolean} redraw - Whether to redraw the chart immediately
     */
    addData(newData, redraw = true) {
        if (!newData) return;
        
        // Handle line data
        if (this.options.type === 'line') {
            const dataArray = Array.isArray(newData) ? newData : [newData];
            
            dataArray.forEach(point => {
                // Add timestamp if not provided
                if (!point.time) {
                    point.time = new Date().getTime();
                }
                
                this.data.line.push(point);
            });
            
            // Limit data points
            if (this.data.line.length > this.maxDataPoints) {
                this.data.line = this.data.line.slice(this.data.line.length - this.maxDataPoints);
            }
        }
        // Handle candlestick data
        else if (this.options.type === 'candlestick') {
            const dataArray = Array.isArray(newData) ? newData : [newData];
            
            dataArray.forEach(candle => {
                // Add timestamp if not provided
                if (!candle.time) {
                    candle.time = new Date().getTime();
                }
                
                // Add candle or update if same timestamp
                const existingIndex = this.data.candles.findIndex(c => c.time === candle.time);
                
                if (existingIndex !== -1) {
                    this.data.candles[existingIndex] = candle;
                } else {
                    this.data.candles.push(candle);
                }
            });
            
            // Limit data points
            if (this.data.candles.length > this.maxDataPoints) {
                this.data.candles = this.data.candles.slice(this.data.candles.length - this.maxDataPoints);
            }
            
            // Sort candles by time
            this.data.candles.sort((a, b) => a.time - b.time);
        }
        
        // Redraw if needed
        if (redraw) {
            this.redraw();
        }
    }
    
    /**
     * Set chart data (replaces existing data)
     * @param {Array} data - Array of data points
     * @param {boolean} redraw - Whether to redraw the chart immediately
     */
    setData(data, redraw = true) {
        if (!data || !Array.isArray(data)) return;
        
        if (this.options.type === 'line') {
            this.data.line = [...data];
        } else if (this.options.type === 'candlestick') {
            this.data.candles = [...data];
            // Sort candles by time
            this.data.candles.sort((a, b) => a.time - b.time);
        }
        
        // Redraw if needed
        if (redraw) {
            this.redraw();
        }
    }
    
    /**
     * Clear all data from the chart
     * @param {boolean} redraw - Whether to redraw the chart immediately
     */
    clearData(redraw = true) {
        this.data.line = [];
        this.data.candles = [];
        
        if (redraw) {
            this.redraw();
        }
    }
    
    /**
     * Redraw the chart with current data
     */
    redraw() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = this.options.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Choose drawing method
        if (this.options.type === 'line') {
            this.drawLineChart();
        } else if (this.options.type === 'candlestick') {
            this.drawCandlestickChart();
        }
    }
    
    /**
     * Draw a line chart
     */
    drawLineChart() {
        const data = this.data.line;
        if (data.length < 2) return;
        
        const padding = 20;
        const width = this.canvas.width - 2 * padding;
        const height = this.canvas.height - 2 * padding;
        
        // Find min/max values
        let minValue = Number.MAX_VALUE;
        let maxValue = Number.MIN_VALUE;
        
        data.forEach(point => {
            if (point.value < minValue) minValue = point.value;
            if (point.value > maxValue) maxValue = point.value;
        });
        
        // Add padding to min/max to not have line at edges
        const range = maxValue - minValue;
        minValue -= range * 0.05;
        maxValue += range * 0.05;
        
        // Draw grid if enabled
        if (this.options.showGrid) {
            this.drawGrid(padding, width, height, minValue, maxValue);
        }
        
        // Draw line
        this.ctx.strokeStyle = this.options.colors.line;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            const x = padding + (i / (data.length - 1)) * width;
            const y = padding + height - ((point.value - minValue) / (maxValue - minValue)) * height;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        
        // Draw points
        this.ctx.fillStyle = this.options.colors.line;
        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            const x = padding + (i / (data.length - 1)) * width;
            const y = padding + height - ((point.value - minValue) / (maxValue - minValue)) * height;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw axis
        if (this.options.showAxis) {
            this.drawAxis(padding, width, height, minValue, maxValue);
        }
        
        // Draw legend
        if (this.options.showLegend) {
            this.drawLegend();
        }
    }
    
    /**
     * Draw a candlestick chart
     */
    drawCandlestickChart() {
        const data = this.data.candles;
        if (data.length < 1) return;
        
        const padding = 20;
        const width = this.canvas.width - 2 * padding;
        const height = this.canvas.height - 2 * padding;
        
        // Calculate volume area if shown
        let priceHeight = height;
        let volumeHeight = 0;
        let volumeTop = this.canvas.height - padding;
        
        if (this.options.showVolume) {
            volumeHeight = Math.floor(height * 0.2);
            priceHeight = height - volumeHeight;
        }
        
        // Find min/max values for price and volume
        let minValue = Number.MAX_VALUE;
        let maxValue = Number.MIN_VALUE;
        let maxVolume = 0;
        
        data.forEach(candle => {
            minValue = Math.min(minValue, candle.low);
            maxValue = Math.max(maxValue, candle.high);
            if (this.options.showVolume && candle.volume > maxVolume) {
                maxVolume = candle.volume;
            }
        });
        
        // Add padding to min/max for price
        const range = maxValue - minValue;
        minValue -= range * 0.05;
        maxValue += range * 0.05;
        
        // Draw grid if enabled
        if (this.options.showGrid) {
            this.drawGrid(padding, width, priceHeight, minValue, maxValue);
        }
        
        // Calculate candle width
        const candleWidth = Math.max(6, (width / data.length) - 2);
        const halfCandleWidth = candleWidth / 2;
        
        // Draw candles
        for (let i = 0; i < data.length; i++) {
            const candle = data[i];
            const x = padding + (i + 0.5) * (width / data.length);
            
            // Calculate y-positions for price
            const openY = padding + priceHeight - ((candle.open - minValue) / (maxValue - minValue)) * priceHeight;
            const closeY = padding + priceHeight - ((candle.close - minValue) / (maxValue - minValue)) * priceHeight;
            const highY = padding + priceHeight - ((candle.high - minValue) / (maxValue - minValue)) * priceHeight;
            const lowY = padding + priceHeight - ((candle.low - minValue) / (maxValue - minValue)) * priceHeight;
            
            // Determine if candle is up or down
            const isUp = candle.close >= candle.open;
            
            // Draw wick
            this.ctx.strokeStyle = this.options.colors.candle.wick;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, highY);
            this.ctx.lineTo(x, lowY);
            this.ctx.stroke();
            
            // Draw candle body
            const candleColor = isUp ? this.options.colors.candle.up : this.options.colors.candle.down;
            this.ctx.fillStyle = candleColor;
            this.ctx.fillRect(
                x - halfCandleWidth,
                isUp ? openY : closeY,
                candleWidth,
                Math.max(1, Math.abs(closeY - openY))
            );
            
            // Draw volume if enabled
            if (this.options.showVolume && maxVolume > 0) {
                const volumeHeight = (candle.volume / maxVolume) * volumeHeight;
                const volumeColor = isUp ? this.options.colors.volume.up : this.options.colors.volume.down;
                
                this.ctx.fillStyle = volumeColor;
                this.ctx.fillRect(
                    x - halfCandleWidth,
                    volumeTop - volumeHeight,
                    candleWidth,
                    volumeHeight
                );
            }
        }
        
        // Draw axis
        if (this.options.showAxis) {
            this.drawAxis(padding, width, priceHeight, minValue, maxValue);
        }
        
        // Draw legend
        if (this.options.showLegend) {
            this.drawLegend();
        }
    }
    
    /**
     * Draw grid lines
     * @param {number} padding - Chart padding
     * @param {number} width - Chart width
     * @param {number} height - Chart height
     * @param {number} minValue - Minimum value
     * @param {number} maxValue - Maximum value
     */
    drawGrid(padding, width, height, minValue, maxValue) {
        this.ctx.strokeStyle = this.options.colors.grid;
        this.ctx.lineWidth = 0.5;
        
        // Horizontal grid lines
        const numHLines = 5;
        for (let i = 0; i <= numHLines; i++) {
            const y = padding + (i / numHLines) * height;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(padding + width, y);
            this.ctx.stroke();
        }
        
        // Vertical grid lines
        const numVLines = 10;
        for (let i = 0; i <= numVLines; i++) {
            const x = padding + (i / numVLines) * width;
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, padding + height);
            this.ctx.stroke();
        }
    }
    
    /**
     * Draw axis labels
     * @param {number} padding - Chart padding
     * @param {number} width - Chart width
     * @param {number} height - Chart height
     * @param {number} minValue - Minimum value
     * @param {number} maxValue - Maximum value
     */
    drawAxis(padding, width, height, minValue, maxValue) {
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "10px Courier New";
        this.ctx.textAlign = "end";
        
        // Y-axis labels
        const numYLabels = 5;
        for (let i = 0; i <= numYLabels; i++) {
            const value = minValue + (maxValue - minValue) * (1 - i / numYLabels);
            const y = padding + (i / numYLabels) * height;
            
            // Format the label value
            let label;
            if (Math.abs(value) < 0.01) {
                label = value.toFixed(6);
            } else if (Math.abs(value) < 1) {
                label = value.toFixed(4);
            } else if (Math.abs(value) < 1000) {
                label = value.toFixed(2);
            } else {
                label = value.toLocaleString(undefined, { maximumFractionDigits: 0 });
            }
            
            this.ctx.fillText(label, padding - 5, y + 3);
        }
    }
    
    /**
     * Draw chart legend
     */
    drawLegend() {
        // Skip if no data
        const data = this.options.type === 'line' ? this.data.line : this.data.candles;
        if (data.length === 0) return;
        
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "10px Courier New";
        this.ctx.textAlign = "left";
        
        let legendText = "";
        
        // Get latest data point
        const latest = data[data.length - 1];
        
        if (this.options.type === 'line') {
            legendText = `Value: ${formatNumber(latest.value)} | Time: ${formatTime(latest.time)}`;
        } else {
            legendText = `O: ${formatNumber(latest.open)} H: ${formatNumber(latest.high)} L: ${formatNumber(latest.low)} C: ${formatNumber(latest.close)}`;
            if (this.options.showVolume && latest.volume) {
                legendText += ` | Vol: ${formatVolume(latest.volume)}`;
            }
        }
        
        // Draw legend
        this.ctx.fillText(legendText, 10, 15);
        
        // Helper functions for formatting
        function formatNumber(value) {
            if (value === undefined || value === null) return 'N/A';
            
            if (Math.abs(value) < 0.01) {
                return value.toFixed(6);
            } else if (Math.abs(value) < 1) {
                return value.toFixed(4);
            }
            return value.toFixed(2);
        }
        
        function formatVolume(volume) {
            if (volume >= 1000000) {
                return (volume / 1000000).toFixed(1) + 'M';
            } else if (volume >= 1000) {
                return (volume / 1000).toFixed(1) + 'K';
            }
            return volume.toString();
        }
        
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    /**
     * Update chart configuration options
     * @param {Object} options - New options to apply
     */
    updateOptions(options) {
        this.options = {
            ...this.options,
            ...options
        };
        this.redraw();
    }
}

// Export the chart class globally
window.DashboardChart = DashboardChart;