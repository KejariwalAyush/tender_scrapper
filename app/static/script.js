// This file contains JavaScript code for the front-end functionality of the application. 
// It handles user interactions, AJAX requests, and dynamic updates to the web page.

document.addEventListener('DOMContentLoaded', function () {
    setupTabs();
    fetchTenders();
    fetchWebsites();
    fetchConfig();

    // Setup event listeners
    document.getElementById('refresh-btn').addEventListener('click', refreshData);
    document.getElementById('website-filter').addEventListener('change', filterTenders);
    document.getElementById('search-box').addEventListener('input', filterTenders);
    document.getElementById('dashboard-link').addEventListener('click', function (e) {
        e.preventDefault();
        showSection('dashboard');
    });
    document.getElementById('invalid-tenders-link').addEventListener('click', function (e) {
        e.preventDefault();
        showSection('invalid-tenders');
        displayInvalidTenders();
    });
    document.getElementById('settings-link').addEventListener('click', function (e) {
        e.preventDefault();
        showSection('settings');
    });
});

function setupTabs() {
    const tabsContainer = document.getElementById('tabs-container');
    tabsContainer.innerHTML = `
        <ul class="nav nav-tabs">
            <li class="nav-item">
                <a class="nav-link active" id="high-score-tab" href="#">High Match Scores</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" id="low-score-tab" href="#">Low Match Scores</a>
            </li>
        </ul>
    `;

    document.getElementById('high-score-tab').addEventListener('click', () => {
        switchTab('high');
    });

    document.getElementById('low-score-tab').addEventListener('click', () => {
        switchTab('low');
    });
}

function switchTab(tab) {
    const highTab = document.getElementById('high-score-tab');
    const lowTab = document.getElementById('low-score-tab');

    if (tab === 'high') {
        highTab.classList.add('active');
        lowTab.classList.remove('active');
        displayTenders(tenderData, 'high');
    } else {
        lowTab.classList.add('active');
        highTab.classList.remove('active');
        displayTenders(tenderData, 'low');
    }
}

function showSection(section) {
  const sections = ['dashboard', 'invalid-tenders', 'settings'];
  sections.forEach((sec) => {
    document.getElementById(`${sec}-section`).classList.add('d-none');
    document.querySelector(`#${sec}-link`).classList.remove('active');
  });

  document.getElementById(`${section}-section`).classList.remove('d-none');
  document.querySelector(`#${section}-link`).classList.add('active');
}

function fetchTenders() {
    fetch('/api/tenders')
        .then(response => response.json())
        .then(data => {
            tenderData = data;
            displayTenders(data, 'high'); // Default to high match scores
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

function displayTenders(tenders, filterType) {
    const container = document.getElementById('tenders-container');
    container.innerHTML = '';

    if (tenders.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-info">No tenders found</div></div>';
        return;
    }

    // Default sorting: by date (descending) and then by score (descending)
    const filteredTenders = filterTendersByScore(tenders, filterType).sort((a, b) => {
        const dateA = parseDMY(a.date);
        const dateB = parseDMY(b.date);
        if (dateB && dateA) {
            if (dateB - dateA !== 0) return dateB - dateA; // Sort by date descending
        }
        return (b.match_score || 0) - (a.match_score || 0); // Sort by score descending
    });

    const table = createTendersTable(filteredTenders);
    container.appendChild(table);
}

function filterTendersByScore(tenders, filterType) {
    const maxScore = Math.max(...tenders.map(t => t.match_score || 0));
    return tenders.filter(tender => {
        if (filterType === 'high') {
            return tender.match_score >= maxScore * 0.5; // High scores (>= 50% of max)
        } else {
            return tender.match_score < maxScore * 0.5; // Low scores (< 50% of max)
        }
    });
}

function createTendersTable(tenders) {
    const table = document.createElement('table');
    table.className = 'table table-striped table-bordered';

    const thead = createTableHeader();
    const tbody = createTableBody(tenders);

    table.appendChild(thead);
    table.appendChild(tbody);

    return table;
}

function createTableHeader() {
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th data-sort="index">Sl. No.</th>
            <th data-sort="title">Title</th>
            <th data-sort="score">Score</th>
            <th data-sort="date">Date</th>
            <th data-sort="source">Source</th>
            <th>Link</th>
        </tr>
    `;

    // Add sorting functionality to headers
    thead.querySelectorAll('th[data-sort]').forEach((header) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            const sortKey = header.getAttribute('data-sort');
            sortTendersByColumn(sortKey);
        });
    });

    return thead;
}

function createTableBody(tenders) {
    const tbody = document.createElement('tbody');
    const currentDate = new Date();

    tenders.forEach((tender, idx) => {
        const row = document.createElement('tr');

        row.appendChild(createCell(idx + 1)); // Sl. No.
        row.appendChild(createTitleCell(tender.title, tender.scraped_at)); // Title with "New" tag
        row.appendChild(createScoreCell(tender.match_score)); // Score
        row.appendChild(createDateCell(tender.date, currentDate)); // Date
        row.appendChild(createSourceCell(tender.tag)); // Source
        row.appendChild(createLinkCell(tender.link)); // Link

        tbody.appendChild(row);
    });

    return tbody;
}

function createCell(content) {
    const cell = document.createElement('td');
    cell.textContent = content;
    return cell;
}

function createTitleCell(title, scrapedAt) {
    const cell = document.createElement('td');
    const truncatedTitle = title.length > 200 ? title.substring(0, 250) + '...' : title;

    // Check if the tender is new (scraped within the last 24 hours)
    const isNew = scrapedAt && isNewTender(scrapedAt);

    // Add "New" tag if applicable
    const newTag = isNew
        ? `<span class="badge bg-success text-white me-2" title="New Tender" style="vertical-align: top;">New</span>`
        : '';

    cell.innerHTML = `
        ${newTag}
        <span class="d-inline-block align-top" style="vertical-align: top; max-width: 500px; cursor: pointer; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; white-space: normal;" title="Click to view full title">
        ${truncatedTitle}
        </span>
    `;
    cell.addEventListener('click', () => {
        alert(`Full Title: ${title}`);
    });
    return cell;
}

function createScoreCell(score) {
    const cell = document.createElement('td');
    const scoreText = score !== undefined ? score : 'N/A';
    const scoreClass = getScoreClass(score);
    cell.innerHTML = `<span class="px-2 py-1 rounded ${scoreClass}">${scoreText}</span>`;
    return cell;
}

function getScoreClass(score) {
    if (typeof score !== 'number') return 'bg-secondary text-white';
    const maxScore = Math.max(...tenderData.map(t => t.match_score || 0));
    if (score === maxScore && maxScore > 0) return 'bg-success text-white fw-bold';
    if (score >= maxScore * 0.75) return 'bg-primary text-white';
    if (score >= maxScore * 0.5) return 'bg-warning text-dark';
    return 'bg-secondary text-white';
}

function createDateCell(dateStr, currentDate) {
    const cell = document.createElement('td');
    const tenderDate = parseDMY(dateStr);
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    if (tenderDate) {
        if (Math.abs(tenderDate - currentDate) <= oneMonth) {
            cell.innerHTML = `<strong>${dateStr}</strong>`;
        } else if (tenderDate < currentDate) {
            cell.innerHTML = `<span class="text-danger">${dateStr}</span>`;
        } else {
            cell.innerHTML = `<span class="text-success">${dateStr}</span>`;
        }
    } else {
        cell.innerHTML = `<span class="text-muted">Invalid date</span>`;
    }
    return cell;
}

function createSourceCell(tag) {
    const cell = document.createElement('td');
    const sources = tag
        ? `<div style="max-width: 150px; white-space: wrap; overflow: hidden; text-overflow: ellipsis;">${
            tag.split(',').map(tag => `<span 
                class="badge" style="background-color: #e6f4ea; color: #2f513c; border-radius: 50px; padding: 0.5em 1em; margin: 0.2em;">
                    ${tag.trim()}</span>`).join('')}
            </div>`
        : 'N/A';
    cell.innerHTML = sources;
    return cell;
}

function createLinkCell(link) {
    const cell = document.createElement('td');
    cell.innerHTML = link ? `<a href="${link}" target="_blank">View</a>` : 'N/A';
    return cell;
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

function displayInvalidTenders() {
  const container = document.getElementById('invalid-tenders-container');
  container.innerHTML = '';

  // Filter tenders with invalid dates and match_score < 2
  const invalidTenders = tenderData.filter((tender) => {
    const tenderDate = parseDMY(tender.date);
    return (!tenderDate || isNaN(tenderDate.getTime())) && tender.match_score < 2;
  });

  if (invalidTenders.length === 0) {
    container.innerHTML = '<div class="col-12"><div class="alert alert-info">No invalid tenders found</div></div>';
    return;
  }

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

  // Create table body
  const tbody = document.createElement('tbody');
  invalidTenders.forEach((tender, idx) => {
    const row = document.createElement('tr');

    // Sl. No.
    const slNoCell = document.createElement('td');
    slNoCell.textContent = idx + 1;
    row.appendChild(slNoCell);

    // Title
    const titleCell = document.createElement('td');
    titleCell.textContent = tender.title || 'N/A';
    row.appendChild(titleCell);

    // Match Score
    const scoreCell = document.createElement('td');
    scoreCell.textContent = tender.match_score || 'N/A';
    row.appendChild(scoreCell);

    // Date
    const dateCell = document.createElement('td');
    dateCell.textContent = tender.date || 'Invalid Date';
    row.appendChild(dateCell);

    // Source
    const sourceCell = document.createElement('td');
    sourceCell.textContent = tender.tag || 'N/A';
    row.appendChild(sourceCell);

    // Link
    const linkCell = document.createElement('td');
    linkCell.innerHTML = tender.link ? `<a href="${tender.link}" target="_blank">View</a>` : 'N/A';
    row.appendChild(linkCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

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
  return isNaN(dt.getTime()) ? null : dt;
}

function sortTendersByColumn(sortKey) {
    const container = document.getElementById('tenders-container');
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    const currentDate = new Date();

    rows.sort((rowA, rowB) => {
        const cellA = rowA.querySelector(`td:nth-child(${getColumnIndex(sortKey)})`).textContent.trim();
        const cellB = rowB.querySelector(`td:nth-child(${getColumnIndex(sortKey)})`).textContent.trim();

        if (sortKey === 'date') {
            const dateA = parseDMY(cellA);
            const dateB = parseDMY(cellB);
            return (dateB || currentDate) - (dateA || currentDate); // Sort by date descending
        } else if (sortKey === 'score') {
            return parseFloat(cellB) - parseFloat(cellA); // Sort by score descending
        } else {
            return cellA.localeCompare(cellB); // Sort alphabetically for other columns
        }
    });

    const tbody = container.querySelector('tbody');
    tbody.innerHTML = '';
    rows.forEach((row) => tbody.appendChild(row));
}

function getColumnIndex(sortKey) {
    const columns = ['index', 'title', 'score', 'date', 'source'];
    return columns.indexOf(sortKey) + 1; // Column index starts from 1
}

function isNewTender(scrapedAt) {
    const scrapedDate = new Date(scrapedAt);
    const currentDate = new Date();
    const oneDay = 6 * 60 * 60 * 1000; // 24 hours in milliseconds
    return currentDate - scrapedDate <= oneDay; // Check if scraped within the last 24 hours
}