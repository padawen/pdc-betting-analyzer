#!/bin/bash

# PDC Darts Monitor - Incremental Update Script
# Usage: ./run_monitor.sh [YEAR] [INTERVAL_SECONDS]
# Example: ./run_monitor.sh 2026        (single check)
#          ./run_monitor.sh 2026 3600   (loop every hour)

YEAR=${1:-2026}
INTERVAL=${2:-}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PDC Darts Monitor ===${NC}"

# Check/Create virtual environment
if [ ! -f "venv/bin/activate" ]; then
    echo "Creating virtual environment..."
    rm -rf venv
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Checking dependencies..."
pip install -q -r requirements.txt

# Run monitor
if [ -z "$INTERVAL" ]; then
    echo -e "${GREEN}Checking for new matches for year: $YEAR${NC}"
    python3 scrape_monitor.py "$YEAR"
else
    echo -e "${YELLOW}Starting continuous monitoring for year: $YEAR (every ${INTERVAL}s)${NC}"
    python3 scrape_monitor.py "$YEAR" "$INTERVAL"
fi

# Cleanup logs
rm -f geckodriver.log
rm -f chromedriver.log

echo -e "${BLUE}=== Done ===${NC}"
