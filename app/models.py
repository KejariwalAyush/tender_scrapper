
# Pydantic Models for request and response

from typing import List, Optional
from pydantic import BaseModel, Field


class Tender(BaseModel):
    id: str
    website: str
    title: str
    date: str
    link: Optional[str] = None
    scraped_at: str
    tag: Optional[str] = None

class WebsiteConfig(BaseModel):
    name: str
    url: str
    selector: str
    title_selector: str
    date_selector: str
    link_selector: str
    base_url: Optional[str] = None

class EmailSettings(BaseModel):
    enabled: bool
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    sender_email: Optional[str] = None
    password: Optional[str] = Field(None, description="Provide new password to change, leave blank to keep current")
    recipient_email: Optional[str] = None

class AppConfigUpdate(BaseModel):
    websites: Optional[List[WebsiteConfig]] = None
    email: Optional[EmailSettings] = None
    output_directory: Optional[str] = None # Added for completeness

class CurrentAppConfig(BaseModel):
    websites: List[WebsiteConfig]
    email_enabled: bool
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    sender_email: Optional[str] = None
    recipient_email: Optional[str] = None
    output_directory: str

class RefreshResponse(BaseModel):
    status: str
    message: str
    new_tenders_count: int

class StatusResponse(BaseModel):
    status: str
    message: str