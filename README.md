# PDC Darts Eredmények Crawler

## Beállítás

### 1. Config fájl létrehozása
Először másold le a példa config fájlt:

```bash
cp config.py.example config.py
```

Majd szerkeszd a `config.py` fájlt és add meg a megfelelő URL-eket a `YEAR_URLS` dictionary-ben.

### 2. Függőségek telepítése

```bash
pip install -r requirements.txt
```

## Scriptek használata

### 1. **Teljes év scraping** (`scrape_year.py`)
Újra scrape-eli az egész évet (felülírja a meglévő JSON-t):

```bash
./run_scraper.sh 2026
# vagy
python3 scrape_year.py 2026
```

### 2. **Inkrementális frissítés** (`scrape_monitor.py`) ⭐ ÚJ!
Csak az **új meccseket** adja hozzá a JSON-hoz (nem írja újra az egészet):

```bash
# Egyszeri ellenőrzés
./run_monitor.sh 2026

# Folyamatos figyelés (pl. óránként)
./run_monitor.sh 2026 3600

# Vagy közvetlenül Python-nal
python3 scrape_monitor.py 2026
python3 scrape_monitor.py 2026 3600  # loop mode
```

### 3. **Hogyan működik a monitor?**

A `scrape_monitor.py`:
1. ✅ Betölti a meglévő `data/matches_2026.json` fájlt
2. ✅ Megnézi az eredmények oldalon, hogy van-e új meccs
3. ✅ Csak azokat a meccseket scrape-eli, amik még nincsenek a JSON-ban
4. ✅ Hozzáadja az új meccseket a meglévő JSON-hoz (nem írja újra az egészet!)
5. ✅ Ha megadsz interval-t, akkor folyamatosan figyel új eredményekre

### Példa használat

```bash
# Reggel indítsd el, hogy óránként nézze az új eredményeket:
./run_monitor.sh 2026 3600 &

# Vagy cron job-ként (minden 30 percben):
# */30 * * * * cd /home/davide/apps/eredmenyek-crawler && ./run_monitor.sh 2026
```

### Fájlok

- **`scrape_year.py`** - Teljes év scraper (újraírja a JSON-t)
- **`scrape_monitor.py`** - Inkrementális monitor (csak új meccseket ad hozzá)
- **`run_scraper.sh`** - Shell script a teljes scraper futtatásához
- **`run_monitor.sh`** - Shell script a monitor futtatásához
- **`data/matches_2026.json`** - Az eredmények JSON fájlja

### Megjegyzések

- A monitor script minden meccshez hozzáad egy `"id"` mezőt (a meccs URL-je), így tudja ellenőrizni, hogy melyik meccs új
- Ha a JSON fájl nem létezik, akkor üres adatstruktúrával kezd
- A script automatikusan kezeli a cookie elfogadást és a "További meccsek" gombot
