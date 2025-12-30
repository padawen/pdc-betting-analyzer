#!/bin/bash

# PDC Darts Scraper Runner
# Usage: ./run_scraper.sh [YEAR] (Default: 2026)

YEAR=${1:-2026}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PDC Darts Scraper Setup ===${NC}"

# Check/Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Checking dependencies..."
pip install -r requirements.txt > /dev/null

# Run scraper
echo -e "${GREEN}Running scraper for year: $YEAR${NC}"
python3 scrape_year.py "$YEAR"

# Cleanup logs
rm -f geckodriver.log
rm -f chromedriver.log

echo -e "${BLUE}=== Done ===${NC}"
