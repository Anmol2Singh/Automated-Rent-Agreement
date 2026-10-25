// Chrome Extension Popup Script

let currentCase = null;
let fieldMap = null;

async function loadFieldMap() {
  if (fieldMap) return fieldMap;
  try {
    const res = await fetch(chrome.runtime.getURL('igr-field-map.json'));
    fieldMap = await res.json();
    return fieldMap;
  } catch (err) {
    console.error('Failed to load igr-field-map.json', err);
    return {};
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadFieldMap();

  // Restore session data
  if (chrome.storage && chrome.storage.session) {
    chrome.storage.session.get(['currentCase', 'tokenInput', 'backendUrl', 'staffSecret'], (items) => {
      if (items.tokenInput) document.getElementById('tokenInput').value = items.tokenInput;
      if (items.backendUrl) document.getElementById('backendUrl').value = items.backendUrl;
      if (items.staffSecret) document.getElementById('staffSecret').value = items.staffSecret;
      if (items.currentCase) {
        currentCase = items.currentCase;
        renderChecklist(currentCase);
      }
    });
  }

  // Load Case
  document.getElementById('btnLoadCase').addEventListener('click', async () => {
    const token = document.getElementById('tokenInput').value.trim();
    const backend = document.getElementById('backendUrl').value.trim() || 'http://localhost:3000';
    const secret = document.getElementById('staffSecret').value.trim();

    if (!token) {
      alert('Please enter a case token number (e.g. PNE-2026-0001)');
      return;
    }

    logResult(`Fetching case ${token} from ${backend}...`);

    try {
      const headers = {};
      if (secret) headers['x-staff-token'] = secret;

      const res = await fetch(`${backend}/api/cases/${token}/igr-export`, { headers });
      const data = await res.json();

      if (data.success && data.igrPayload) {
        currentCase = data.igrPayload;
        if (chrome.storage && chrome.storage.session) {
          chrome.storage.session.set({
            currentCase,
            tokenInput: token,
            backendUrl: backend,
            staffSecret: secret,
          });
        }
        renderChecklist(currentCase);
        logResult(`✅ Loaded case ${token} with ${currentCase.tenants?.length || 0} tenant(s) and 2 identifiers.`);
      } else {
        alert(data.error || 'Failed to load case. Verify token or staff credentials.');
      }
    } catch (err) {
      alert('Network error connecting to backend API: ' + err.message);
    }
  });

  // Fill Current Page
  document.getElementById('btnFillPage').addEventListener('click', async () => {
    if (!currentCase) {
      alert('Please load a case first.');
      return;
    }

    const tab = await getActiveTab();
    if (!tab?.id) return;

    logResult('Detecting page and filling controls...');

    // Try property page fill first
    chrome.tabs.sendMessage(
      tab.id,
      {
        action: 'FILL_PROPERTY',
        propertyData: currentCase.property,
        fieldMap,
      },
      (res) => {
        if (res && res.results) {
          displayFillResults('Property', res.results);
        } else {
          // If property controls not on page, try filling owner party
          chrome.tabs.sendMessage(
            tab.id,
            {
              action: 'FILL_PARTY',
              partyData: currentCase.owner,
              role: 'owner',
              fieldMap,
            },
            (partyRes) => {
              if (partyRes && partyRes.results) {
                displayFillResults('Owner', partyRes.results);
                handleAutoAddOption(tab.id);
              } else {
                logResult('⚠️ No matching Property or Party fields found on active page.');
              }
            }
          );
        }
      }
    );
  });

  // Fill Specific Party
  document.getElementById('btnFillParty').addEventListener('click', async () => {
    if (!currentCase) return;
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const selected = document.getElementById('selectParty').value;
    let targetParty = null;
    let role = 'party';

    if (selected === 'owner') {
      targetParty = currentCase.owner;
      role = 'owner';
    } else if (selected.startsWith('tenant_')) {
      const idx = parseInt(selected.split('_')[1], 10);
      targetParty = currentCase.tenants?.[idx];
      role = 'tenant';
    } else if (selected.startsWith('identifier_')) {
      const idx = parseInt(selected.split('_')[1], 10);
      targetParty = currentCase.identifiers?.[idx];
      role = 'identifier';
    }

    if (!targetParty) {
      alert('Selected party data not found in case.');
      return;
    }

    logResult(`Filling ${selected}...`);

    chrome.tabs.sendMessage(
      tab.id,
      {
        action: 'FILL_PARTY',
        partyData: targetParty,
        role,
        fieldMap,
      },
      (res) => {
        if (res && res.results) {
          displayFillResults(selected, res.results);
          handleAutoAddOption(tab.id);
        }
      }
    );
  });

  // Capture GRN from Portal Header
  document.getElementById('btnCaptureGrn').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    logResult('Reading Token No from header on portal page...');

    chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_GRN' }, async (res) => {
      if (res && res.grnToken) {
        logResult(`🎯 Captured Token/GRN: ${res.grnToken}`);

        if (currentCase && currentCase.tokenNo) {
          const backend = document.getElementById('backendUrl').value.trim() || 'http://localhost:3000';
          const secret = document.getElementById('staffSecret').value.trim();
          const headers = { 'Content-Type': 'application/json' };
          if (secret) headers['x-staff-token'] = secret;

          try {
            const apiRes = await fetch(`${backend}/api/cases/${currentCase.tokenNo}/grn`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ grnNo: res.grnToken }),
            });
            const d = await apiRes.json();
            if (d.success) {
              logResult(`✅ GRN ${res.grnToken} saved to DB and Google Sheet cell!`);
            }
          } catch (e) {
            console.warn('GRN save notice:', e);
          }
        }
      } else {
        logResult('❌ No "Token No:" header found on current tab.');
      }
    });
  });

  // Scan This Page Controls Dump
  document.getElementById('btnScanPage').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { action: 'SCAN_PAGE' }, (res) => {
      if (res && res.controls) {
        const jsonDump = JSON.stringify(res.controls, null, 2);
        navigator.clipboard.writeText(jsonDump);
        logResult(`✅ Scanned ${res.count} controls. Copied control dump JSON to clipboard!`);
      } else {
        logResult('⚠️ Scan returned no controls or tab does not match content script.');
      }
    });
  });
});

async function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

function renderChecklist(caseData) {
  const container = document.getElementById('checklistContainer');
  const selectParty = document.getElementById('selectParty');
  container.innerHTML = '';
  selectParty.innerHTML = '';

  document.getElementById('checklistCard').style.display = 'block';

  // 1. Property
  addChecklistItem(container, 'Property Details (Haveli, Area, Limits)', 'dot-ready');

  // 2. Owner
  addChecklistItem(container, `Owner (Licensor): ${caseData.owner?.first || ''} ${caseData.owner?.surname || ''}`, 'dot-ready');
  addOption(selectParty, 'owner', `Owner: ${caseData.owner?.first || ''} ${caseData.owner?.surname || ''}`);

  // 3. Tenants
  const tenants = caseData.tenants || [];
  tenants.forEach((t, idx) => {
    addChecklistItem(container, `Tenant #${idx + 1}: ${t.first || ''} ${t.surname || ''}`, 'dot-ready');
    addOption(selectParty, `tenant_${idx}`, `Tenant #${idx + 1}: ${t.first || ''} ${t.surname || ''}`);
  });

  // 4. Identifiers
  const idents = caseData.identifiers || [];
  idents.forEach((id, idx) => {
    addChecklistItem(container, `Identifier #${idx + 1}: ${id.first || ''} ${id.surname || ''}`, 'dot-ready');
    addOption(selectParty, `identifier_${idx}`, `Identifier #${idx + 1}: ${id.first || ''} ${id.surname || ''}`);
  });
}

function addChecklistItem(container, text, dotClass) {
  const row = document.createElement('div');
  row.className = 'checklist-item';
  row.innerHTML = `<span><span class="status-dot ${dotClass}"></span>${text}</span><span style="color:#10b981;font-weight:bold;">Ready</span>`;
  container.appendChild(row);
}

function addOption(select, value, label) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
}

function logResult(msg) {
  const box = document.getElementById('resultsBox');
  box.textContent = msg;
}

function displayFillResults(sectionName, results) {
  const box = document.getElementById('resultsBox');
  let html = `<div><strong>[${sectionName}] Fill Results:</strong></div>`;

  let emptyMarathiCount = 0;

  results.forEach((r) => {
    const isOk = r.success !== false;
    const marathiText = r.marathi || r.marathiGenerated || '';
    const hasMarathi = !!marathiText;

    if (r.marathiWarning) emptyMarathiCount++;

    html += `<div>
      <span class="${isOk ? 'item-green' : 'item-red'}">• ${r.field}:</span> 
      ${r.value ? r.value + ' ' : ''}
      ${hasMarathi ? `<span style="color:#0369a1;">[MR: ${marathiText}]</span>` : ''}
      ${r.marathiWarning ? '<span class="item-red">[MR empty - verify]</span>' : ''}
    </div>`;
  });

  if (emptyMarathiCount > 0) {
    html += `<div class="item-amber" style="margin-top:4px;">⚠️ ${emptyMarathiCount} Marathi field(s) did not auto-populate after blur. Please check.</div>`;
  }

  box.innerHTML = html;
}

function handleAutoAddOption(tabId) {
  const autoAdd = document.getElementById('chkAutoAdd').checked;
  if (autoAdd && tabId) {
    logResult('Auto-click Add enabled: Clicking "Add Details" draft button once...');
    chrome.tabs.sendMessage(tabId, { action: 'CLICK_ADD_BUTTON' }, (res) => {
      if (res && res.clicked) {
        logResult('✅ Clicked Add button draft. You can now select and fill the next party.');
      }
    });
  }
}
