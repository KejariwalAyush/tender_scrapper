# filepath: main.py
import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import threading
import time
import os

from app.api import router as api_router
from app.scraper import TenderScraper, logger # Import logger

app = FastAPI(title="Tender Scraper API")

# Ensure static and templates directories exist or are correctly referenced
# Assuming 'app' is a directory in the same root as main.py
static_dir = os.path.join(os.path.dirname(__file__), "app/static")
templates_dir = os.path.join(os.path.dirname(__file__), "app/templates")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

app.include_router(api_router)

# Serve the main HTML page
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# --- Background Scraper Task ---
# This is a simple way to run a background task.
# For production, consider more robust solutions like Celery, APScheduler with a persistent job store, or FastAPI-utils' RepeatedTask.

background_scraper_instance = TenderScraper() # Use a separate instance or manage shared state carefully if using api_router's instance

def schedule_scraper_task(interval_hours: int):
    logger.info(f"Background scraper scheduler started. Interval: {interval_hours} hours.")
    while True:
        try:
            logger.info("Background scraper task: Starting run.")
            background_scraper_instance.run()
            logger.info(f"Background scraper task: Run finished. Sleeping for {interval_hours} hours.")
        except Exception as e:
            logger.error(f"Background scraper task: Error during scheduled run: {e}", exc_info=True)
            # Sleep for a shorter interval on error to avoid busy-looping if config is bad,
            # but still retry.
            time.sleep(min(interval_hours * 3600, 300)) # Sleep at most 5 mins on error before retry
            continue # Continue to the next iteration of the loop
        time.sleep(interval_hours * 3600)

@app.on_event("startup")
async def startup_event():
    # Initial run on startup (optional, could be long)
    # logger.info("Performing initial scrape on startup...")
    # try:
    #     background_scraper_instance.run()
    #     logger.info("Initial scrape on startup finished.")
    # except Exception as e:
    #     logger.error(f"Error during initial startup scrape: {e}", exc_info=True)

    # Start the scheduler in a separate thread
    try:
        check_interval_str = background_scraper_instance.config.get('General', 'check_interval_hours', fallback='24')
        check_interval = int(check_interval_str)
        if check_interval <= 0:
            logger.warning(f"Invalid check_interval_hours: {check_interval}. Defaulting to 24.")
            check_interval = 24
    except ValueError:
        logger.error(f"Invalid format for check_interval_hours. Defaulting to 24.")
        check_interval = 24
        
    scheduler_thread = threading.Thread(
        target=schedule_scraper_task,
        args=(check_interval,),
        daemon=True  # Daemon threads exit when the main program exits
    )
    scheduler_thread.start()
    logger.info("Background scraper thread started.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")