const stateSelect = document.querySelector('#state');
const constituencySelect = document.querySelector('#constituency');
const searchForm = document.querySelector('#search-form');
const clearButton = document.querySelector('#clear-button');
const nameSearch = document.querySelector('#name-search');
const resultList = document.querySelector('#result-list');
const emptyState = document.querySelector('#empty-state');
const statusMessage = document.querySelector('#status-message');

let representatives = [];

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; }
      else { quoted = !quoted; }
    } else if (character === ',' && !quoted) {
      row.push(value.trim()); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value.trim()); value = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row); }
  const headers = rows.shift();
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function normalize(value) { return value.trim().toLowerCase(); }

function toRepresentative(record) {
  return {
    id: record['Sl.No.'],
    name: record.Name,
    party: record.Party,
    constituency: record.Constituency,
    state: record.State,
    status: record.Status,
    terms: record['Lok Sabha Terms'].split(',').map((term) => term.trim()).filter(Boolean),
    phone: record.Phone,
    emails: record.Email.split(',').map((email) => email.trim()).filter(Boolean),
  };
}

function option(value, label) {
  const element = document.createElement('option');
  element.value = value; element.textContent = label;
  return element;
}

function showResults(items) {
  resultList.innerHTML = '';
  emptyState.hidden = items.length > 0;
  resultList.hidden = items.length === 0;
  if (!items.length) return;
  items.forEach((person) => {
    const card = document.createElement('article');
    card.className = 'representative-card';
    const emailLinks = person.emails.map((email) =>
      `<span class="email-row"><a href="mailto:${encodeURIComponent(email)}">${email}</a><button class="copy-button" type="button" data-email="${email}">Copy</button></span>`
    ).join('');
    card.innerHTML = `<div class="card-heading"><div><p class="eyebrow">${person.status}</p><h2>${person.name}</h2><p class="party">${person.party}</p></div><span class="badge">${person.constituency}</span></div>
      <dl class="details"><div><dt>Constituency</dt><dd>${person.constituency}</dd></div><div><dt>State</dt><dd>${person.state}</dd></div><div><dt>Lok Sabha terms</dt><dd>${person.terms.join(', ') || 'Not listed'}</dd></div><div><dt>Phone</dt><dd>${person.phone === '-' ? 'Phone number unavailable' : person.phone}</dd></div></dl>
      <div class="contact"><h3>Email addresses</h3>${emailLinks || '<p>No email address listed</p>'}</div>`;
    resultList.appendChild(card);
  });
}

function populateStates() {
  [...new Set(representatives.map((person) => person.state))].sort().forEach((state) => stateSelect.appendChild(option(state, state)));
}

function resetDetails() {
  showResults([]);
  statusMessage.textContent = '';
}

stateSelect.addEventListener('change', () => {
  constituencySelect.innerHTML = '';
  constituencySelect.appendChild(option('', 'Select a constituency'));
  constituencySelect.disabled = !stateSelect.value;
  if (stateSelect.value) {
    [...new Set(representatives.filter((person) => normalize(person.state) === normalize(stateSelect.value)).map((person) => person.constituency))]
      .sort().forEach((constituency) => constituencySelect.appendChild(option(constituency, constituency)));
  }
  resetDetails();
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const state = normalize(stateSelect.value);
  const constituency = normalize(constituencySelect.value);
  const matches = representatives.filter((person) =>
    (!state || normalize(person.state) === state) &&
    (!constituency || normalize(person.constituency) === constituency)
  );
  statusMessage.textContent = matches.length ? `${matches.length} representative${matches.length === 1 ? '' : 's'} found.` : 'No representatives match that selection.';
  showResults(matches);
});

nameSearch.addEventListener('input', () => {
  const query = normalize(nameSearch.value);
  if (!query) { resetDetails(); return; }
  const matches = representatives.filter((person) => normalize(person.name).includes(query) || normalize(person.constituency).includes(query));
  statusMessage.textContent = matches.length ? `${matches.length} match${matches.length === 1 ? '' : 'es'} found.` : 'No representatives match that search.';
  showResults(matches);
});

clearButton.addEventListener('click', () => {
  stateSelect.value = ''; constituencySelect.innerHTML = '<option value="">Select a state first</option>';
  constituencySelect.disabled = true; nameSearch.value = ''; resetDetails();
});

resultList.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-button');
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.email);
    button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1400);
  } catch (error) {
    statusMessage.textContent = 'Copy failed. Please select the email address manually.';
  }
});

fetch('data/representatives.csv')
  .then((response) => { if (!response.ok) throw new Error('Dataset could not be loaded'); return response.text(); })
  .then((csv) => { representatives = parseCsv(csv).map(toRepresentative); populateStates(); })
  .catch((error) => { statusMessage.textContent = error.message; });
