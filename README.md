# PDC Darts Underdog Betting Analysis

Web application for analyzing underdog betting performance in PDC darts matches using data from eredmenyek.com.

## Project Structure

```
eredmenyek-crawler/
├── scraper.py          # Python scraper for extracting match data
├── index.html          # Frontend application
├── matches.json        # Scraped match data (generated)
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## Data Source

- **Website**: https://www.eredmenyek.com
- **Competition**: PDC World Championship
- **Bookmaker**: TippmixPro only
- **Match Type**: Historical completed matches

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Install ChromeDriver

The scraper uses Selenium with Chrome. Make sure you have Chrome and ChromeDriver installed:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install chromium-chromedriver

# Or download from: https://chromedriver.chromium.org/
```

## Usage

### Step 1: Scrape Match Data

Run the scraper to extract match data:

```bash
python scraper.py
```

This will:
- Fetch all PDC World Championship matches from eredmenyek.com
- Extract player names, TippmixPro odds, and winners
- Save data to `matches.json`

### Step 2: View Analysis

Open the frontend in a browser:

```bash
# Using Python's built-in server
python -m http.server 8000

# Then open: http://localhost:8000
```

Or simply open `index.html` directly in your browser.

## How It Works

### Scraping Logic

1. **Match List**: Scrapes all match links from the results page using `.eventRowLink` selector
2. **Match Details**: For each match:
   - Extracts player names from `.participant__participantName`
   - Finds TippmixPro bookmaker row via `a.prematchLink[title="TippmixPro"]`
   - Extracts odds from `button.wcl-oddsCell_qJ5md` elements
   - Detects winner using `wcl-win` CSS class
3. **Underdog Detection**: Player with higher odds is the underdog
4. **Data Export**: Saves to JSON with structure:

```json
{
  "matches": [
    {
      "playerA": "Name",
      "playerB": "Name",
      "underdog": "Name",
      "underdogOdds": 2.15,
      "underdogWon": true
    }
  ]
}
```

### Betting Logic

- **Strategy**: Always bet on the underdog (higher odds)
- **Stake**: User-defined (default = 1 unit)
- **Win**: Profit = (odds × stake) - stake
- **Loss**: Loss = stake
- **ROI**: (Total Profit / Total Staked) × 100

### Frontend Features

- Load match data from `matches.json`
- Adjustable stake input
- Display aggregated statistics:
  - Total matches
  - Underdog wins/losses
  - Total staked
  - Total profit/loss
  - ROI percentage
- Clean, responsive design with Tailwind CSS

## Notes

- The scraper includes polite delays (1s between requests)
- Only matches with TippmixPro odds are included
- Winner detection relies on CSS class, not score parsing
- Frontend is static HTML/JavaScript (no backend required)

## Troubleshooting

**Scraper not finding matches:**
- Check if eredmenyek.com structure has changed
- Verify ChromeDriver is compatible with your Chrome version

**Frontend not loading data:**
- Ensure `matches.json` exists in the same directory
- Check browser console for errors
- Use a local server (not file://) to avoid CORS issues

## License

MIT
