# Tender Scraper

## Overview
Tender Scraper is a web application designed to scrape tender information from various websites. It provides a user-friendly interface to view and manage tender data, and it can send email notifications for new tenders.

## Features
- Scrapes tender information from configured websites.
- Sends email notifications for new tenders.
- Provides a web interface to view and filter tenders.
- Configurable through a simple configuration file.

## Project Structure
```
tender_scraper
├── app
│   ├── __init__.py          # Initializes the Flask application
│   ├── routes.py            # Defines the application routes
│   ├── scraper.py           # Contains the scraping logic
│   ├── static
│   │   ├── script.js        # Front-end JavaScript
│   │   └── style.css        # Front-end CSS styles
│   └── templates
│       └── index.html       # Main HTML template
├── config
│   ├── config.ini           # Application configuration
│   └── websites_config.json  # Websites configuration for scraping
├── run.py                   # Entry point to run the application
├── requirements.txt         # Project dependencies
└── README.md                # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd tender_scraper
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Configure the application:
   - Update `config/config.ini` with your email settings.
   - Update `config/websites_config.json` with the websites you want to scrape.

## Usage
To run the application, execute the following command:
```
python run.py
```
The application will start on `http://localhost:5000`.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.