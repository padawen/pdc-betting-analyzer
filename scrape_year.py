#!/usr/bin/env python3
"""
PDC Darts Year-Specific Scraper with Round Information
Usage: python3 scrape_year.py 2026
       python3 scrape_year.py 2025
"""

import json
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException,
    WebDriverException
)

# Import URL configuration
try:
    from config import YEAR_URLS
except ImportError:
    print("Error: config.py not found. Please create it from config.py.example")
    sys.exit(1)


def setup_driver():
    """Initialize Chrome driver with optimized options"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')
    chrome_options.page_load_strategy = 'eager'
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(0)
    
    return driver


def accept_cookies(driver):
    """Accept cookie consent if present"""
    try:
        cookie_btn = WebDriverWait(driver, 3).until(
            EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler"))
        )
        cookie_btn.click()
        WebDriverWait(driver, 2).until(
            EC.invisibility_of_element_located((By.ID, "onetrust-accept-btn-handler"))
        )
    except (TimeoutException, NoSuchElementException):
        pass


def get_match_links(driver, base_url):
    """Extract all match detail links from results page"""
    try:
        driver.get(base_url)
        accept_cookies(driver)
        
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "a.eventRowLink"))
        )
        
        # Scroll down to trigger lazy loading
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        import time
        time.sleep(2)
        
        # Click "Show more matches" - Robust method checking text content
        try:
            # Try finding by text "További meccsek" (most reliable based on user feedback)
            more_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(text(), 'További meccsek')] | //span[contains(text(), 'További meccsek')]"))
            )
            print("  Found 'További meccsek' button, clicking...")
            driver.execute_script("arguments[0].scrollIntoView(true);", more_btn)
            time.sleep(1)
            driver.execute_script("arguments[0].click();", more_btn)
            
            # Wait for more items to load
            time.sleep(5)
            print("  Loaded more matches.")
            
        except TimeoutException:
            # Fallback to standard selector if text not found
            try:
                more_btn = driver.find_element(By.CSS_SELECTOR, ".event__more")
                print("  Found '.event__more' button, clicking...")
                driver.execute_script("arguments[0].click();", more_btn)
                time.sleep(5)
            except:
                print("  No 'Show more matches' button found or clickable.")
        except Exception as e:
            print(f"  Error clicking show more: {e}")
            
        elements = driver.find_elements(By.CSS_SELECTOR, "a.eventRowLink")
        match_links = []
        
        for elem in elements:
            href = elem.get_attribute('href')
            if href:
                match_links.append(href)
        
        return match_links
        
    except Exception as e:
        print(f"Error getting match links: {e}")
        return []


def extract_match_data(driver, match_url):
    """Extract match data from individual match page"""
    try:
        driver.get(match_url)
        
        # Wait for player names
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".participant__participantNameWrapper"))
        )
        
        # Extract player names
        player_elements = driver.find_elements(By.CSS_SELECTOR, ".participant__participantNameWrapper")
        if len(player_elements) < 2:
            print(f"  Warning: Less than 2 players found at {match_url}")
            return None
        
        player_a = player_elements[0].text.strip()
        player_b = player_elements[1].text.strip()
        
        # Check for Walkover based on player names
        is_walkover = False
        winner_index = -1 # 0 for Player A, 1 for Player B
        
        if "Továbbjutó" in player_a:
            is_walkover = True
            winner_index = 0
            player_a = player_a.replace("Továbbjutó", "").strip(" -()")
        elif "Továbbjutó" in player_b:
            is_walkover = True
            winner_index = 1
            player_b = player_b.replace("Továbbjutó", "").strip(" -()")
            
        # Extract round information from breadcrumb
        round_name = "Unknown"
        try:
            # Get all breadcrumb elements and take the last one
            breadcrumb_elems = driver.find_elements(By.CSS_SELECTOR, '[class*="breadcrumbItemLabel"]')
            if breadcrumb_elems:
                breadcrumb_text = breadcrumb_elems[-1].get_attribute('textContent').strip()
                # Format: "PDC-dartsvilágbajnokság - 1/8 döntő"
                if " - " in breadcrumb_text:
                    round_name = breadcrumb_text.split(" - ")[1].strip()
                else:
                    round_name = breadcrumb_text
        except (NoSuchElementException, IndexError):
            pass  # Keep "Unknown" if breadcrumb not found
        
        odds_a = 1.0
        odds_b = 1.0
        player_a_won = False
        player_b_won = False
        
        if is_walkover:
            print(f"  Walkover detected: {player_a} vs {player_b}")
            odds_a = 1.0
            odds_b = 1.0
            if winner_index == 0:
                player_a_won = True
            else:
                player_b_won = True
                
        else:
            # Try to get real odds
            try:
                # Wait for odds section (short wait)
                try:
                    WebDriverWait(driver, 3).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "a.prematchLink"))
                    )
                except TimeoutException:
                    pass # Continue logic to check if we can handle it or return None

                # Find TippmixPro bookmaker
                tippmix_links = driver.find_elements(By.CSS_SELECTOR, 'a[title="TippmixPro"]')
                
                if tippmix_links:
                    tippmix_link = tippmix_links[0]
                    # Find odds row
                    try:
                        odds_row = tippmix_link.find_element(By.XPATH, "./ancestor::div[contains(@class, 'odds')]")
                    except NoSuchElementException:
                        try:
                            odds_row = tippmix_link.find_element(By.XPATH, "./ancestor::div[contains(@class, 'row')]")
                        except NoSuchElementException:
                             odds_row = driver.execute_script("return arguments[0].parentElement.parentElement;", tippmix_link)
                    
                    odds_cells = odds_row.find_elements(By.CSS_SELECTOR, "button[class*='oddsCell']")
                    
                    if len(odds_cells) >= 2:
                        odds_a_text = odds_cells[0].text.strip()
                        odds_b_text = odds_cells[1].text.strip()
                        
                        if odds_a_text and odds_b_text:
                            try:
                                odds_a = float(odds_a_text.replace(',', '.'))
                                odds_b = float(odds_b_text.replace(',', '.'))
                                
                                # Check winner based on classes
                                cell_a_classes = odds_cells[0].get_attribute('class') or ''
                                cell_b_classes = odds_cells[1].get_attribute('class') or ''
                                player_a_won = 'wcl-win' in cell_a_classes
                                player_b_won = 'wcl-win' in cell_b_classes
                                
                            except ValueError:
                                pass # Keep default 1.0

            except Exception as e:
                print(f"  Error parsing odds: {e}")
                
            # If still 1.0 (no odds found) but NOT walkover, check if we need to skip
            # But wait, maybe odds were <= 1.01 and we want to keep them as 1.0?
            if odds_a <= 1.01 or odds_b <= 1.01:
                 # Treat extremely low odds as walkover/void for safety/consistency with request
                 pass
            
            # If odds are valid, but we couldn't determine winner from CSS, try score?
            # For now, rely on wcl-win. If scraping failed (no odds found at all) and not walkover -> likely return None
            if not is_walkover and odds_a == 1.0 and odds_b == 1.0:
                 # Check if we can determine winner from score to at least save the match
                 # But without odds it's useless for betting analysis. 
                 # Unless user wants ALL matches.
                 # Let's assume without odds we skip, unless it is a WALKOWER.
                 return None

        # Determine underdog and favorite
        # If odds are equal (1.0 vs 1.0), logic is arbitrary, but won't affect ROI (0 profit)
        if odds_a > odds_b:
            underdog = player_a
            underdog_odds = odds_a
            underdog_won = player_a_won
            favorite = player_b
            favorite_odds = odds_b
            favorite_won = player_b_won
        elif odds_b > odds_a:
            underdog = player_b
            underdog_odds = odds_b
            underdog_won = player_b_won
            favorite = player_a
            favorite_odds = odds_a
            favorite_won = player_a_won
        else:
            # Odds equal (e.g. 1.0 vs 1.0)
            # Assign favorite/underdog arbitrarily or based on winner
            underdog = player_a
            underdog_odds = odds_a
            underdog_won = player_a_won
            favorite = player_b
            favorite_odds = odds_b
            favorite_won = player_b_won
        
        return {
            "playerA": player_a,
            "playerB": player_b,
            "oddsA": odds_a,
            "oddsB": odds_b,
            "underdog": underdog,
            "underdogOdds": underdog_odds,
            "underdogWon": underdog_won,
            "favorite": favorite,
            "favoriteOdds": favorite_odds,
            "favoriteWon": favorite_won,
            "round": round_name,
            "id": match_url
        }
        
    except TimeoutException:
        print(f"  Timeout processing {match_url}")
        return None
    except NoSuchElementException:
        return None
    except Exception as e:
        print(f"  Error extracting match data: {e}")
        return None


def scrape_year(year):
    """Scrape matches for a specific year"""
    if year not in YEAR_URLS:
        print(f"Error: Year {year} not supported. Available years: {list(YEAR_URLS.keys())}")
        return False
    
    base_url = YEAR_URLS[year]
    # Ensure data directory exists
    import os
    if not os.path.exists('data'):
        os.makedirs('data')
        
    output_file = f"data/matches_{year}.json"
    
    driver = None
    
    try:
        print(f"\n{'='*60}")
        print(f"PDC {year} Scraper")
        print(f"{'='*60}\n")
        print("Initializing Chrome driver...")
        driver = setup_driver()
        
        print(f"Fetching match links from: {base_url}")
        match_links = get_match_links(driver, base_url)
        
        if not match_links:
            print("No matches found!")
            return False
        
        # Optional: limit for testing
        MAX_MATCHES = None  # Set to None for all matches
        if MAX_MATCHES:
            match_links = match_links[:MAX_MATCHES]
            print(f"Found {len(match_links)} matches (limited to {MAX_MATCHES} for testing)\n")
        else:
            print(f"Found {len(match_links)} matches\n")

        
        matches = []
        successful = 0
        skipped = 0
        
        for i, match_url in enumerate(match_links, 1):
            print(f"[{i}/{len(match_links)}] Processing...")
            
            match_data = extract_match_data(driver, match_url)
            
            if match_data:
                matches.append(match_data)
                successful += 1
                print(f"  ✓ {match_data['playerA']} ({match_data['oddsA']}) vs {match_data['playerB']} ({match_data['oddsB']}) - {match_data['round']}")
            else:
                skipped += 1
                print(f"  ✗ Skipped (no odds/walkover)")
        
        # Save to JSON
        output_data = {
            "year": year,
            "tournament": f"PDC {year}",
            "matches": matches
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print("\n" + "="*60)
        print(f"SCRAPING COMPLETE - PDC {year}")
        print(f"Total processed: {len(match_links)}")
        print(f"Successfully scraped: {successful}")
        print(f"Skipped: {skipped}")
        print(f"Data saved to: {output_file}")
        print("="*60 + "\n")
        
        return True
        
    except WebDriverException as e:
        print(f"\nWebDriver error: {e}")
        return False
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        return False
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scrape_year.py <year>")
        print(f"Available years: {list(YEAR_URLS.keys())}")
        sys.exit(1)
    
    try:
        year = int(sys.argv[1])
        success = scrape_year(year)
        sys.exit(0 if success else 1)
    except ValueError:
        print(f"Error: Invalid year '{sys.argv[1]}'. Must be a number.")
        sys.exit(1)
