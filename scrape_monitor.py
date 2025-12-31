#!/usr/bin/env python3
"""
PDC Darts Incremental Monitor Script
Checks for NEW results and appends them to the JSON file without re-scraping everything.
Usage: python3 scrape_monitor.py <year> [loop_interval_seconds]
Ex: python3 scrape_monitor.py 2026
    python3 scrape_monitor.py 2026 3600  (Loops every hour)
"""

import json

import os
import sys
import time
from scrape_year import setup_driver, get_match_links, extract_match_data, YEAR_URLS

def load_existing_matches(output_file):
    """Load existing matches and return a set of IDs (URLs)"""
    if not os.path.exists(output_file):
        return [], set()
    
    try:
        with open(output_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            matches = data.get('matches', [])
            # Support both old (no id) and new (with id) format
            # If no ID, we can't easily skip, but we'll try to check if we can migrate or just rely on 'id' field if present
            # For now, we assume if ID is missing, we might re-scrape. 
            # Ideally, we should add IDs to existing data if missing, but let's just collect what we have.
            existing_ids = {m.get('id') for m in matches if m.get('id')}
            return data, existing_ids
    except json.JSONDecodeError:
        return {}, set()

def monitor_matches(year):
    if year not in YEAR_URLS:
        print(f"Error: Year {year} not supported.")
        return

    base_url = YEAR_URLS[year]
    output_file = f"data/matches_{year}.json"
    
    print(f"Checking for new matches for {year}...")
    
    # 1. Load existing
    data, existing_ids = load_existing_matches(output_file)
    if not data:
        # If no file exists, we should probably run the full scraper or just initialize empty
        print("  No existing data found. Starting fresh.")
        data = {
            "year": year,
            "tournament": f"PDC {year}",
            "matches": []
        }
    
    driver = setup_driver()
    try:
        # 2. Get all available links
        print(f"  Fetching latest match list from {base_url}...")
        all_links = get_match_links(driver, base_url)
        
        # 3. Filter for NEW links
        new_links = [link for link in all_links if link not in existing_ids]
        
        if not new_links:
            print("  No new matches found.")
            return
        
        print(f"  Found {len(new_links)} NEW matches!")
        
        # 4. Scrape new matches
        new_matches = []
        for i, match_url in enumerate(new_links, 1):
            print(f"  [{i}/{len(new_links)}] Scraping new match...")
            match_data = extract_match_data(driver, match_url)
            if match_data:
                # Ensure ID is present
                if 'id' not in match_data:
                    match_data['id'] = match_url
                new_matches.append(match_data)
                print(f"    ✓ {match_data['playerA']} vs {match_data['playerB']}")
                
                # Append immediately to memory list
                data['matches'].append(match_data)
                existing_ids.add(match_url) # Add to set to prevent duplicate if we crash and restart
            else:
                print("    ✗ Failed to scrape match or valid data not found.")

        # 5. Save updated JSON
        # We verify we actually have new data to save
        if new_matches:
            print(f"  Saving {len(new_matches)} new matches to {output_file}...")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("  Update complete.")
        
    except Exception as e:
        print(f"Error during monitoring: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scrape_monitor.py <year> [interval_seconds]")
        sys.exit(1)
        
    try:
        year = int(sys.argv[1])
        
        # Check if loop mode
        if len(sys.argv) > 2:
            interval = int(sys.argv[2])
            print(f"Starting Monitor Loop for {year}. Interval: {interval}s")
            while True:
                monitor_matches(year)
                print(f"Sleeping for {interval}s...")
                time.sleep(interval)
        else:
            # Single run
            monitor_matches(year)
            
    except ValueError:
        print("Invalid arguments. Year and interval must be numbers.")
        sys.exit(1)
