# filepath: app/scraper.py
import requests
from bs4 import BeautifulSoup
import pandas as pd
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
import os
import logging
from datetime import datetime
# import time # Not used directly in TenderScraper after removing schedule_scraper
import configparser
from urllib.parse import urljoin

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("tender_scraper.log"), # Consider making path configurable or relative to project root
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("TenderScraper")

class TenderScraper:
    def __init__(self, config_path="config/config.ini", websites_config_path="config/websites_config.json"): # Adjusted paths
        self.config = configparser.ConfigParser()
        self.websites_config_path = websites_config_path
        self.config_path = config_path # Store config_path

        if not os.path.exists(self.config_path):
            self.create_default_config(self.config_path)

        self.config.read(self.config_path)
        self.output_dir = self.config.get('General', 'output_directory', fallback='output')
        self.email_config = {
            'enabled': self.config.getboolean('Email', 'enabled', fallback=False),
            'smtp_server': self.config.get('Email', 'smtp_server', fallback='smtp.gmail.com'),
            'smtp_port': self.config.getint('Email', 'smtp_port', fallback=587),
            'sender_email': self.config.get('Email', 'sender_email', fallback=''),
            'password': self.config.get('Email', 'password', fallback=''),
            'recipient_email': self.config.get('Email', 'recipient_email', fallback='')
        }

        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

        self.websites = self.load_websites_config()
        self.prev_data_file = os.path.join(self.output_dir, 'previous_tenders.json')
        self.previous_tenders = self.load_previous_tenders()

    def create_default_config(self, config_path_to_create):
        logger.info(f"Creating default configuration file at {config_path_to_create}...")
        default_config = configparser.ConfigParser()
        default_config['General'] = {
            'output_directory': 'output',
            'check_interval_hours': '24'
        }
        
        default_config['Email'] = {
            'enabled': 'False',
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': '587',
            'sender_email': 'your_email@gmail.com',
            'password': 'your_app_password',
            'recipient_email': 'recipient@example.com'
        }
        
        os.makedirs(os.path.dirname(config_path_to_create), exist_ok=True)
        with open(config_path_to_create, 'w') as configfile:
            default_config.write(configfile)
            
        logger.info(f"Default configuration created at {config_path_to_create}")

    def load_websites_config(self):
        if os.path.exists(self.websites_config_path):
            try:
                with open(self.websites_config_path, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                logger.error(f"Error decoding websites config file: {self.websites_config_path}")
                return [] # Return empty list on error
        else:
            logger.warning(f"Websites config file not found: {self.websites_config_path}. Creating default.")
            default_websites = [
                {
                    'name': 'DAV CSP',
                    'url': 'https://davcsp.org/NoticeBoardDetail.aspx',
                    'selector': '.notice-list-box',
                    'title_selector': '.head-text',
                    'date_selector': '.date-text',
                    'link_selector': 'a',
                    'base_url': 'https://davcsp.org/'
                }
            ]
            os.makedirs(os.path.dirname(self.websites_config_path), exist_ok=True)
            self.save_websites_config(default_websites) # Save it so it exists next time
            return default_websites

    def save_websites_config(self, websites):
        try:
            os.makedirs(os.path.dirname(self.websites_config_path), exist_ok=True)
            with open(self.websites_config_path, 'w') as f:
                json.dump(websites, f, indent=4)
            logger.info(f"Website configurations saved to {self.websites_config_path}")
        except Exception as e:
            logger.error(f"Error saving websites config: {e}")

    def load_previous_tenders(self):
        if os.path.exists(self.prev_data_file):
            try:
                with open(self.prev_data_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                logger.error(f"Error decoding previous tenders file: {self.prev_data_file}")
                return {}
        else:
            return {}

    def save_current_tenders(self, all_tenders):
        with open(self.prev_data_file, 'w') as f:
            json.dump(all_tenders, f, indent=4)

    def scrape_website(self, website_config):
        logger.info(f"Scraping website: {website_config['name']}")
        tenders = []
        try:
            response = requests.get(website_config['url'], timeout=120)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            tender_elements = soup.select(website_config['selector'])
            if not tender_elements:
                logger.warning(f"No tender elements found for {website_config['name']} using selector {website_config['selector']}")
                return tenders
            for tender_element in tender_elements:
                try:
                    title_element = tender_element.select_one(website_config['title_selector'])
                    date_element = tender_element.select_one(website_config['date_selector'])
                    link_element = tender_element.select_one(website_config['link_selector'])
                    
                    title = title_element.text.strip() if title_element else "Unknown Title"
                    date = date_element.text.strip() if date_element else "Unknown Date"
                    
                    link = ""
                    if link_element and link_element.has_attr('href'):
                        link_href = link_element['href']
                        if not link_href.startswith(('http://', 'https://')):
                            base_url = website_config.get('base_url', website_config['url'])
                            link = urljoin(base_url, link_href)
                        else:
                            link = link_href
                    
                    tender_id = f"{website_config['name']}_{title}_{date}"
                    tender_info = {
                        'id': tender_id,
                        'tag': website_config['name'],
                        'website': website_config['url'],
                        'title': title,
                        'date': date,
                        'link': link,
                        'scraped_at': datetime.now().isoformat()
                    }
                    tenders.append(tender_info)
                except Exception as e:
                    logger.error(f"Error extracting tender information from element: {e}")
            logger.info(f"Successfully scraped {len(tenders)} tenders from {website_config['name']}")
            return tenders
        except requests.exceptions.RequestException as e:
            logger.error(f"Error scraping website {website_config['name']}: {e}")
            return tenders
        except Exception as e:
            logger.error(f"An unexpected error occurred while scraping {website_config['name']}: {e}")
            return tenders

    def scrape_all_websites(self):
        all_tenders_data = {}
        new_tenders_data = {}
        for website_config in self.websites:
            tenders = self.scrape_website(website_config)
            website_name = website_config['name']
            all_tenders_data[website_name] = tenders
            
            # Check for new tenders
            if website_name in self.previous_tenders:
                prev_ids = {t['id'] for t in self.previous_tenders.get(website_name, [])} # Ensure previous_tenders[website_name] is a list
                new_tenders_data[website_name] = [t for t in tenders if t['id'] not in prev_ids]
            else:
                new_tenders_data[website_name] = tenders
        
        self.save_to_csv(all_tenders_data)
        self.save_current_tenders(all_tenders_data) # Save all current tenders as new "previous"
        self.previous_tenders = all_tenders_data # Update in-memory previous_tenders
        
        return all_tenders_data, new_tenders_data

    def save_to_csv(self, all_tenders_map):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        all_data_list = []
        for website_name, tenders_list in all_tenders_map.items():
            for tender in tenders_list:
                all_data_list.append(tender)
        
        if all_data_list:
            df = pd.DataFrame(all_data_list)
            csv_file = os.path.join(self.output_dir, f"tenders_{timestamp}.csv")
            df.to_csv(csv_file, index=False)
            logger.info(f"Tender data saved to {csv_file}")

    def send_email_notification(self, new_tenders_map):
        if not self.email_config['enabled']:
            logger.info("Email notifications are disabled.")
            return
        
        has_new_tenders = any(len(tenders) > 0 for tenders in new_tenders_map.values())
        if not has_new_tenders:
            logger.info("No new tenders to send notification for.")
            return
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email_config['sender_email']
            msg['To'] = self.email_config['recipient_email']
            msg['Subject'] = f"New Tenders Notification - {datetime.now().strftime('%Y-%m-%d')}"
            
            email_body = "<html><body><h2>New Tenders Notification</h2>"
            for website, tenders_list in new_tenders_map.items():
                if tenders_list:
                    email_body += f"<h3>{website}</h3><ul>"
                    for tender in tenders_list:
                        email_body += f"<li><strong>{tender['title']}</strong> - {tender['date']}"
                        if tender['link']:
                            email_body += f" - <a href='{tender['link']}'>Download/View</a>"
                        email_body += "</li>"
                    email_body += "</ul>"
            email_body += "</body></html>"
            msg.attach(MIMEText(email_body, 'html'))
            
            with smtplib.SMTP(self.email_config['smtp_server'], self.email_config['smtp_port']) as server:
                server.starttls()
                server.login(self.email_config['sender_email'], self.email_config['password'])
                server.send_message(msg)
            logger.info(f"Email notification sent to {self.email_config['recipient_email']}")
        except Exception as e:
            logger.error(f"Error sending email notification: {e}")

    def run(self):
        logger.info("Starting tender scraper run...")
        all_tenders, new_tenders = self.scrape_all_websites()
        if self.email_config['enabled'] and any(new_tenders.values()):
            self.send_email_notification(new_tenders)
        logger.info("Tender scraper run finished.")
        return all_tenders, new_tenders

    def update_general_config(self, output_dir=None):
        if output_dir:
            self.config['General']['output_directory'] = output_dir
            self.output_dir = output_dir
            if not os.path.exists(self.output_dir):
                os.makedirs(self.output_dir)
        # Add other general settings if needed

    def update_email_config(self, email_data):
        self.config['Email']['enabled'] = str(email_data.get('enabled', self.email_config['enabled']))
        if 'smtp_server' in email_data:
            self.config['Email']['smtp_server'] = email_data['smtp_server']
        if 'smtp_port' in email_data:
            self.config['Email']['smtp_port'] = str(email_data['smtp_port'])
        if 'sender_email' in email_data:
            self.config['Email']['sender_email'] = email_data['sender_email']
        if 'password' in email_data and email_data['password']: # Only update if password is provided
            self.config['Email']['password'] = email_data['password']
        if 'recipient_email' in email_data:
            self.config['Email']['recipient_email'] = email_data['recipient_email']
        
        # Update in-memory email_config
        self.email_config = {
            'enabled': self.config.getboolean('Email', 'enabled'),
            'smtp_server': self.config.get('Email', 'smtp_server'),
            'smtp_port': self.config.getint('Email', 'smtp_port'),
            'sender_email': self.config.get('Email', 'sender_email'),
            'password': self.config.get('Email', 'password'),
            'recipient_email': self.config.get('Email', 'recipient_email')
        }

    def save_ini_config(self):
        with open(self.config_path, 'w') as configfile: # Use self.config_path
            self.config.write(configfile)
        logger.info(f"INI configuration saved to {self.config_path}")
