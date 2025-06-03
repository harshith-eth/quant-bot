#!/bin/bash
# Test script for Quantum Degen Trading AI Swarm API endpoints

BASE_URL="http://localhost:8000"

# Text colors
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
NC="\033[0m" # No Color

echo -e "${YELLOW}🚀 Testing Quantum Degen AI Swarm API Endpoints${NC}"
echo "===========================================\n"

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -e "Testing ${YELLOW}$description${NC} at ${GREEN}$endpoint${NC}..."
    
    # Make the API call
    response=$(curl -s "$BASE_URL$endpoint")
    
    # Check if curl command succeeded
    if [ $? -eq 0 ]; then
        # Check if response contains an error key
        if [[ $response == *"\"error\""* ]]; then
            echo -e "${RED}✘ Error:${NC} $response"
        else
            echo -e "${GREEN}✓ Success!${NC}"
            echo "Response preview: ${response:0:80}..."
        fi
    else
        echo -e "${RED}✘ Failed to connect!${NC}"
    fi
    
    echo ""
}

# Test root endpoint
test_endpoint "/" "Root endpoint"

# Test health check
test_endpoint "/health" "Health check"

# Test all API endpoints
echo -e "${YELLOW}Testing Module API Endpoints:${NC}"
echo "================================\n"

test_endpoint "/api/active-positions" "Active Positions"
test_endpoint "/api/ai-analysis" "AI Analysis"
test_endpoint "/api/market-analysis" "Market Analysis"
test_endpoint "/api/meme-scanner" "Meme Scanner"
test_endpoint "/api/portfolio-status" "Portfolio Status"
test_endpoint "/api/risk-management" "Risk Management"
test_endpoint "/api/signal-feed" "Signal Feed"
test_endpoint "/api/whale-activity" "Whale Activity"

echo -e "${GREEN}API Testing Complete!${NC}"
echo "Remember to start the server with: python backend/main.py before running this test"

