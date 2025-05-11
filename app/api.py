# filepath: app/api.py
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.models import Tender, WebsiteConfig, EmailSettings, AppConfigUpdate, CurrentAppConfig, RefreshResponse, StatusResponse
from app.scraper import TenderScraper, logger # Import logger from scraper

router = APIRouter()
scraper_instance = TenderScraper()

@router.get("/api/tenders", response_model=List[Tender])
async def get_tenders_api(website: Optional[str] = Query(None)):
    all_tenders_map = scraper_instance.load_previous_tenders() # Load latest from file
    
    if website:
        if website in all_tenders_map:
            return all_tenders_map[website]
        else:
            return [] # Or raise HTTPException(status_code=404, detail="Website not found")
    
    flat_tenders = [tender for tenders_list in all_tenders_map.values() for tender in tenders_list]
    return flat_tenders

@router.post("/api/refresh", response_model=RefreshResponse)
async def refresh_data_api():
    try:
        _, new_tenders_map = scraper_instance.run() # scraper.run() now returns (all_tenders_map, new_tenders_map)
        new_count = sum(len(tenders) for tenders in new_tenders_map.values())
        
        return RefreshResponse(
            status='success',
            message=f'Refresh completed. Found {new_count} new tenders.',
            new_tenders_count=new_count
        )
    except Exception as e:
        logger.error(f"Error during API refresh: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/websites", response_model=List[WebsiteConfig])
async def get_websites_api():
    return scraper_instance.websites

@router.get("/api/config", response_model=CurrentAppConfig)
async def get_config_api():
    # Ensure scraper_instance.config is up-to-date if modified elsewhere (e.g. direct file edit)
    # For simplicity, we assume scraper_instance holds the current view.
    # For a more robust solution, scraper.config.read(scraper.config_path) could be called here.
    return CurrentAppConfig(
        websites=scraper_instance.websites,
        email_enabled=scraper_instance.email_config['enabled'],
        smtp_server=scraper_instance.email_config.get('smtp_server'),
        smtp_port=scraper_instance.email_config.get('smtp_port'),
        sender_email=scraper_instance.email_config.get('sender_email'),
        recipient_email=scraper_instance.email_config.get('recipient_email'),
        output_directory=scraper_instance.output_dir
    )

@router.post("/api/config", response_model=StatusResponse)
async def manage_config_api(config_data: AppConfigUpdate):
    try:
        if config_data.websites is not None:
            # Convert Pydantic models back to dicts for saving if necessary,
            # or ensure TenderScraper methods can handle Pydantic models.
            # For now, assuming TenderScraper.save_websites_config expects list of dicts.
            websites_to_save = [site.model_dump() for site in config_data.websites]
            scraper_instance.save_websites_config(websites_to_save)
            scraper_instance.websites = websites_to_save # Update in-memory list

        if config_data.email is not None:
            email_dict = config_data.email.model_dump(exclude_unset=True) # Get only provided fields
            scraper_instance.update_email_config(email_dict)

        if config_data.output_directory is not None:
            scraper_instance.update_general_config(output_dir=config_data.output_directory)
        
        scraper_instance.save_ini_config() # Save all changes to config.ini
        
        return StatusResponse(status='success', message='Configuration updated successfully')
    except Exception as e:
        logger.error(f"Error updating configuration via API: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
