// This file contains JavaScript code for the front-end functionality of the application. 
// It handles user interactions, AJAX requests, and dynamic updates to the web page.

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the Bootstrap modal
    const websiteModal = new bootstrap.Modal(document.getElementById('websiteModal'));
    
    // Load initial data
    fetchTenders();
    fetchWebsites();
    fetchConfig();
    
    // Setup event listeners
    document.getElementById('refresh-btn').addEventListener('click', refreshData);
    document.getElementById('website-filter').addEventListener('change', filterTenders);
    document.getElementById('search-box').addEventListener('input', filterTenders);
    document.getElementById('dashboard-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('dashboard');
    });
    document.getElementById('settings-link').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('settings');
    });
    document.getElementById('add-website-btn').addEventListener('click', showAddWebsiteModal);
    document.getElementById('save-website-btn').addEventListener('click', saveWebsite);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
});

function showSection(section) {
    if (section === 'dashboard') {
        document.getElementById('dashboard-section').classList.remove('d-none');
        document.getElementById('settings-section').classList.add('d-none');
        document.querySelector('#dashboard-link').classList.add('active');
        document.querySelector('#settings-link').classList.remove('active');
    } else {
        document.getElementById('dashboard-section').classList.add('d-none');
        document.getElementById('settings-section').classList.remove('d-none');
        document.querySelector('#dashboard-link').classList.remove('active');
        document.querySelector('#settings-link').classList.add('active');
    }
}

function fetchTenders() {
    fetch('/api/tenders')
        .then(response => response.json())
        .then(data => {
            tenderData = data;
            displayTenders(data);
        })
        .catch(err => console.error('Error fetching tenders:', err));
}

function fetchWebsites() {
    fetch('/api/websites')
        .then(response => response.json())
        .then(data => {
            websitesConfig = data;
            populateWebsiteFilter(data);
            displayWebsitesSettings(data);
        })
        .catch(err => console.error('Error fetching websites config:', err));
}

function fetchConfig() {
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            document.getElementById('email-enabled').checked = data.email_enabled;
            document.getElementById('smtp-server').value = data.smtp_server || '';
            document.getElementById('smtp-port').value = data.smtp_port || '';
            document.getElementById('sender-email').value = data.sender_email || '';
            document.getElementById('recipient-email').value = data.recipient_email || '';
        })
        .catch(err => console.error('Error fetching config:', err));
}

function refreshData() {
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    
    refreshBtn.disabled = true;
    refreshIcon.classList.remove('d-none');
    
    fetch('/api/refresh', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert(data.message);
            fetchTenders();
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(err => {
        console.error('Error refreshing data:', err);
        alert('Error refreshing data. Check console for details.');
    })
    .finally(() => {
        refreshBtn.disabled = false;
        refreshIcon.classList.add('d-none');
    });
}

function populateWebsiteFilter(websites) {
    const filter = document.getElementById('website-filter');
    
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    websites.forEach(website => {
        const option = document.createElement('option');
        option.value = website.name;
        option.textContent = website.name;
        filter.appendChild(option);
    });
}

function displayTenders(tenders) {
    const container = document.getElementById('tenders-container');
    container.innerHTML = '';
    
    if (tenders.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-info">No tenders found</div></div>';
        return;
    }
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    tenders.forEach(tender => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        
        const isNew = tender.scraped_at && new Date(tender.scraped_at) > yesterday;
        
        col.innerHTML = `
            <div class="card tender-card">
            <div class="card-body">
                <p class="card-subtitle mb-2 ${tender.link ? 'text-success' : 'text-muted'}">
                ${tender.link 
                    ? `<a href="${tender.link}" class="text-success text-decoration-underline" target="_blank">${tender.date}</a>` 
                    : tender.date}
                </p>
                <h4 class="card-title" style="font-size: 1.2rem; font-weight: bold;">
                <a href="${tender.website}" target="_blank" class="text-decoration-none text-dark">${tender.title}</a>
                </h4>
                <p class="card-text">Source: ${tender.tag}</p>
            </div>
            </div>
        `;
        
        container.appendChild(col);
    });
}

function filterTenders() {
    const websiteFilter = document.getElementById('website-filter').value;
    const searchText = document.getElementById('search-box').value.toLowerCase();
    
    let filteredTenders = [...tenderData];
    
    if (websiteFilter) {
        filteredTenders = filteredTenders.filter(tender => tender.website === websiteFilter);
    }
    
    if (searchText) {
        filteredTenders = filteredTenders.filter(tender => 
            tender.title.toLowerCase().includes(searchText) || 
            tender.date.toLowerCase().includes(searchText)
        );
    }
    
    displayTenders(filteredTenders);
}

function displayWebsitesSettings(websites) {
    const container = document.getElementById('websites-list');
    container.innerHTML = '';
    
    if (websites.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No websites configured</div>';
        return;
    }
    
    websites.forEach((website, index) => {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">${website.name}</h5>
                    <div>
                        <button class="btn btn-sm btn-outline-primary edit-website-btn" data-index="${index}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger delete-website-btn" data-index="${index}">Delete</button>
                    </div>
                </div>
                <p class="card-text text-muted mt-2">${website.url}</p>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    document.querySelectorAll('.edit-website-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            showEditWebsiteModal(index);
        });
    });
    
    document.querySelectorAll('.delete-website-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            if (confirm('Are you sure you want to delete this website?')) {
                deleteWebsite(index);
            }
        });
    });
}

function showAddWebsiteModal() {
    document.getElementById('website-form').reset();
    document.getElementById('website-index').value = '';
    document.getElementById('websiteModalLabel').textContent = 'Add Website';
    
    websiteModal.show();
}

function showEditWebsiteModal(index) {
    const website = websitesConfig[index];
    
    document.getElementById('website-index').value = index;
    document.getElementById('website-name').value = website.name;
    document.getElementById('website-url').value = website.url;
    document.getElementById('website-base-url').value = website.base_url || '';
    document.getElementById('selector').value = website.selector;
    document.getElementById('title-selector').value = website.title_selector;
    document.getElementById('date-selector').value = website.date_selector;
    document.getElementById('link-selector').value = website.link_selector;
    
    document.getElementById('websiteModalLabel').textContent = 'Edit Website';
    
    websiteModal.show();
}

function saveWebsite() {
    const form = document.getElementById('website-form');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const index = document.getElementById('website-index').value;
    const website = {
        name: document.getElementById('website-name').value,
        url: document.getElementById('website-url').value,
        base_url: document.getElementById('website-base-url').value,
        selector: document.getElementById('selector').value,
        title_selector: document.getElementById('title-selector').value,
        date_selector: document.getElementById('date-selector').value,
        link_selector: document.getElementById('link-selector').value
    };
    
    if (index !== '') {
        websitesConfig[index] = website;
    } else {
        websitesConfig.push(website);
    }
    
    displayWebsitesSettings(websitesConfig);
    populateWebsiteFilter(websitesConfig);
    
    websiteModal.hide();
}

function deleteWebsite(index) {
    websitesConfig.splice(index, 1);
    
    displayWebsitesSettings(websitesConfig);
    populateWebsiteFilter(websitesConfig);
}

function saveSettings() {
    const config = {
        websites: websitesConfig,
        email: {
            enabled: document.getElementById('email-enabled').checked,
            smtp_server: document.getElementById('smtp-server').value,
            smtp_port: parseInt(document.getElementById('smtp-port').value),
            sender_email: document.getElementById('sender-email').value,
            password: document.getElementById('email-password').value,
            recipient_email: document.getElementById('recipient-email').value
        }
    };
    
    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Settings saved successfully');
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(err => {
        console.error('Error saving settings:', err);
        alert('Error saving settings. Check console for details.');
    });
}