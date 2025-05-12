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

    // Sort tenders: newest date first, then by highest match_score
    tenders.sort((a, b) => {
        function parseDMY(dateStr) {
            if (!dateStr) return new Date(0);
            const parts = dateStr.split('/');
            if (parts.length !== 3) return new Date(0);
            let [d, m, y] = parts;
            d = parseInt(d, 10);
            m = parseInt(m, 10) - 1;
            y = parseInt(y, 10);
            if (y < 100) y += 2000;
            return new Date(y, m, d);
        }
        const dateA = parseDMY(a.date);
        const dateB = parseDMY(b.date);
        if (dateB - dateA !== 0) return dateB - dateA;

        const scoreA = typeof a.match_score === 'number' ? a.match_score : -Infinity;
        const scoreB = typeof b.match_score === 'number' ? b.match_score : -Infinity;
        return scoreB - scoreA;
    });

    const table = document.createElement('table');
    table.className = 'table table-striped table-bordered';

    // Create table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Sl. No.</th>
            <th>Title</th>
            <th>Match Score</th>
            <th>Date</th>
            <th>Source</th>
            <th>Link</th>
        </tr>
    `;
    table.appendChild(thead);

    // Find the highest match score
    let maxScore = -Infinity;
    tenders.forEach(t => {
        if (typeof t.match_score === 'number' && t.match_score > maxScore) {
            maxScore = t.match_score;
        }
    });

    // Create table body
    const tbody = document.createElement('tbody');
    const currentDate = new Date();

    tenders.forEach((tender, idx) => {
        const row = document.createElement('tr');

        // Sl. No.
        const slNoCell = document.createElement('td');
        slNoCell.textContent = idx + 1;
        row.appendChild(slNoCell);

        // Title
        const titleCell = document.createElement('td');
        const truncatedTitle = tender.title.length > 200 ? tender.title.substring(0, 250) + '...' : tender.title;
        titleCell.innerHTML = `
            <span class="d-inline-block" style="max-width: 500px; cursor: pointer; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; white-space: normal;" title="Click to view full title">
            ${truncatedTitle}
            </span>
        `;
        titleCell.addEventListener('click', () => {
            alert(`Full Title: ${tender.title}`);
        });
        row.appendChild(titleCell);

        // Match Score with color highlighting
        const scoreCell = document.createElement('td');
        let score = tender.match_score;
        let scoreText = score !== undefined ? score : 'N/A';
        let scoreClass = '';
        if (typeof score === 'number') {
            if (score === maxScore && maxScore > 0) {
                scoreClass = 'bg-success text-white fw-bold'; // Top score: green
            } else if (score >= maxScore * 0.75) {
                scoreClass = 'bg-primary text-white'; // High: blue
            } else if (score >= maxScore * 0.5) {
                scoreClass = 'bg-warning text-dark'; // Medium: yellow
            } else {
                scoreClass = 'bg-secondary text-white'; // Low: gray
            }
        } else {
            scoreClass = 'bg-secondary text-white';
        }
        scoreCell.innerHTML = `<span class="px-2 py-1 rounded ${scoreClass}">${scoreText}</span>`;
        row.appendChild(scoreCell);

        // Date
        const dateCell = document.createElement('td');
        // Parse DD/MM/YYYY safely
        function parseDMY(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            let [d, m, y] = parts;
            d = parseInt(d, 10);
            m = parseInt(m, 10) - 1;
            y = parseInt(y, 10);
            if (y < 100) y += 2000;
            const dt = new Date(y, m, d);
            // Check for invalid date
            if (isNaN(dt.getTime())) return null;
            return dt;
        }
        const tenderDate = parseDMY(tender.date);
        const oneMonth = 30 * 24 * 60 * 60 * 1000;

        if (tenderDate) {
            if (Math.abs(tenderDate - currentDate) <= oneMonth) {
                dateCell.innerHTML = `<strong>${tender.date}</strong>`;
            } else if (tenderDate < currentDate) {
                dateCell.innerHTML = `<span class="text-danger">${tender.date}</span>`;
            } else {
                dateCell.innerHTML = `<span class="text-success">${tender.date}</span>`;
            }
        } else {
            dateCell.innerHTML = `<span class="text-muted">Invalid date</span>`;
        }
        row.appendChild(dateCell);

        // Source (as chips)
        const sourceCell = document.createElement('td');
        const sources = tender.tag
            ? `<div style="max-width: 150px; white-space: wrap; overflow: hidden; text-overflow: ellipsis;">${
            tender.tag.split(',').map(tag => `<span 
                class="badge" style="background-color: #e6f4ea; color: #2f513c; border-radius: 50px; padding: 0.5em 1em margin: 0.2em;">
                    ${tag.trim()}</span>`).join('')}
                </span>
              </div>`
            : 'N/A';
        sourceCell.innerHTML = sources;
        row.appendChild(sourceCell);

        // Link
        const linkCell = document.createElement('td');
        linkCell.innerHTML = tender.link 
            ? `<a href="${tender.link}" target="_blank">View</a>` 
            : 'N/A';
        row.appendChild(linkCell);

        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);
}

function filterTenders() {
    const websiteFilter = document.getElementById('website-filter').value;
    const searchText = document.getElementById('search-box').value.toLowerCase();
    
    let filteredTenders = [...tenderData];
    
    if (websiteFilter) {
        filteredTenders = filteredTenders.filter(tender => 
            tender.tag && tender.tag.toLowerCase().includes(websiteFilter.toLowerCase())
        );
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