// Chrome Extension Content Script for Maharashtra IGR WebForms Autofill

let isPostbackInProgress = false;
let postbackResolvers = [];

// Listen to events from MAIN world hook (webforms-hook.js)
window.addEventListener('IGR_ASYNC_POSTBACK_START', () => {
  isPostbackInProgress = true;
});

window.addEventListener('IGR_ASYNC_POSTBACK_END', () => {
  isPostbackInProgress = false;
  while (postbackResolvers.length > 0) {
    const resolve = postbackResolvers.shift();
    if (typeof resolve === 'function') resolve();
  }
});

function waitForPostback(timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!isPostbackInProgress) {
      setTimeout(resolve, 600);
      return;
    }
    const timer = setTimeout(() => {
      resolve();
    }, timeoutMs);

    postbackResolvers.push(() => {
      clearTimeout(timer);
      setTimeout(resolve, 400);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Find control by label cell or id pattern
function findControlByLabel(labelText, container = document) {
  const cleanLabel = labelText.toLowerCase().trim();
  const allLabels = container.querySelectorAll('label, td, span, th');

  for (const el of allLabels) {
    const text = el.textContent ? el.textContent.toLowerCase().trim() : '';
    if (text.includes(cleanLabel)) {
      // Check for associated 'for' attribute
      if (el.htmlFor) {
        const target = document.getElementById(el.htmlFor);
        if (target) return target;
      }

      // Check next sibling element or child
      const inputInCell = el.querySelector('input, select, textarea');
      if (inputInCell) return inputInCell;

      // Look in next table cell
      const parentRow = el.closest('tr');
      if (parentRow) {
        const inputs = parentRow.querySelectorAll('input:not([type="hidden"]), select, textarea');
        if (inputs.length > 0) return inputs[0];
      }
    }
  }

  return null;
}

function findControl(config, container = document) {
  // 1. Try id patterns
  if (config.idPatterns && Array.isArray(config.idPatterns)) {
    for (const pat of config.idPatterns) {
      const el = document.querySelector(`[id*="${pat}" i]`);
      if (el) return el;
    }
  }
  // 2. Try label text
  if (config.label) {
    const el = findControlByLabel(config.label, container);
    if (el) return el;
  }
  // 3. Try english key
  if (config.english) {
    const el = document.querySelector(`[id*="${config.english}" i], [name*="${config.english}" i]`);
    if (el) return el;
  }

  return null;
}

// Find Marathi sibling in same table row
function findMarathiSibling(englishInput) {
  if (!englishInput) return null;
  const parentRow = englishInput.closest('tr');
  if (parentRow) {
    const inputs = Array.from(parentRow.querySelectorAll('input[type="text"], textarea'));
    const englishIndex = inputs.indexOf(englishInput);
    if (englishIndex !== -1 && englishIndex + 1 < inputs.length) {
      return inputs[englishIndex + 1];
    }
  }
  return null;
}

// Simulate typing in English input
async function fillEnglishInput(input, value, fillMode = 'set') {
  if (!input || value === undefined || value === null) return;
  const strVal = String(value);

  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();

  if (fillMode === 'type') {
    // Character by character typing with ~15ms delay
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    let current = '';
    for (let i = 0; i < strVal.length; i++) {
      current += strVal[i];
      if (nativeSetter) {
        nativeSetter.call(input, current);
      } else {
        input.value = current;
      }
      input.dispatchEvent(new KeyboardEvent('keydown', { key: strVal[i], bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: strVal[i], bubbles: true }));
      await sleep(15);
    }
  } else {
    // Native setter mode
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, strVal);
    } else {
      input.value = strVal;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

// Wait for Marathi sibling box to be auto-populated by the portal
async function waitForMarathiSibling(marathiInput, timeoutMs = 5000) {
  if (!marathiInput) return { success: false, text: '' };

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (marathiInput.value && marathiInput.value.trim().length > 0) {
      return { success: true, text: marathiInput.value.trim() };
    }
    await sleep(250);
  }

  return { success: false, text: marathiInput.value || '' };
}

// Select dropdown option by text or alias
async function selectDropdownOption(select, desiredValue, aliases = []) {
  if (!select) return false;
  const desired = String(desiredValue).toLowerCase().trim();
  const allDesired = [desired, ...(aliases || []).map((a) => String(a).toLowerCase().trim())];

  let matchedIndex = -1;
  for (let i = 0; i < select.options.length; i++) {
    const optText = select.options[i].text.toLowerCase().trim();
    const optVal = select.options[i].value.toLowerCase().trim();

    if (allDesired.some((d) => optText.includes(d) || d.includes(optText) || optVal === d)) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex !== -1) {
    select.selectedIndex = matchedIndex;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (select.getAttribute('onchange') || select.getAttribute('autopostback')) {
      await waitForPostback();
    }
    return true;
  }

  return false;
}

// Fill Property Page Chain
async function fillPropertyPage(propData, fieldMap) {
  const results = [];
  const pMap = fieldMap.property || {};

  // 1. Taluka (Wait for postback to load Villages)
  if (propData.taluka) {
    const talukaEl = findControl(pMap.taluka);
    if (talukaEl) {
      const ok = await selectDropdownOption(talukaEl, propData.taluka);
      results.push({ field: 'Taluka', success: ok });
      await waitForPostback(5000);
    }
  }

  // 2. Village (Wait for postback to load limits)
  if (propData.village) {
    const villageEl = findControl(pMap.village);
    if (villageEl) {
      const ok = await selectDropdownOption(villageEl, propData.village);
      results.push({ field: 'Village', success: ok });
      await waitForPostback(5000);
    }
  }

  // 3. Property in Area (Urban/Rural radio)
  const areaRadio = document.querySelector(`input[name*="Area" i][value*="${propData.propertyInArea || 'Urban'}" i]`);
  if (areaRadio) {
    areaRadio.click();
    areaRadio.dispatchEvent(new Event('change', { bubbles: true }));
    results.push({ field: 'Property in Area', success: true });
    await waitForPostback(3000);
  }

  // 4. Local Limit Type & Name
  if (propData.localLimitType) {
    const limitTypeEl = findControl(pMap.localLimitType);
    if (limitTypeEl) {
      const ok = await selectDropdownOption(limitTypeEl, propData.localLimitType);
      results.push({ field: 'Local Limit Type', success: ok });
      await waitForPostback(4000);
    }
  }

  if (propData.localLimitName) {
    const limitNameEl = findControl(pMap.localLimitName);
    if (limitNameEl) {
      const ok = await selectDropdownOption(limitNameEl, propData.localLimitName);
      results.push({ field: 'Local Limit Name', success: ok });
    }
  }

  // 5. Unit Type & Area
  if (propData.unitType) {
    const unitEl = findControl(pMap.unitType);
    const aliases = fieldMap.optionAliases?.unitType?.[propData.unitType] || [];
    const ok = await selectDropdownOption(unitEl, propData.unitType, aliases);
    results.push({ field: 'Unit Type', success: ok });
  }

  if (propData.unitArea) {
    const areaEl = findControl(pMap.unitArea);
    if (areaEl) {
      await fillEnglishInput(areaEl, propData.unitArea, 'set');
      results.push({ field: 'Unit Area', success: true });
    }
  }

  // 6. Text Fields with Sibling Marathi Auto-Transliteration
  const textFields = [
    { key: 'attribute1Number', val: propData.attribute1Number, name: 'Attribute 1 Number' },
    { key: 'building', val: propData.building, name: 'Building Name' },
    { key: 'flatNo', val: propData.flatNo, name: 'Flat No' },
    { key: 'floorNo', val: propData.floorNo, name: 'Floor' },
    { key: 'road', val: propData.road, name: 'Road' },
    { key: 'location', val: propData.location, name: 'Location' },
  ];

  for (const item of textFields) {
    if (!item.val) continue;
    const cfg = pMap[item.key] || {};
    const input = findControl(cfg);
    if (input) {
      await fillEnglishInput(input, item.val, cfg.fillMode || 'type');
      input.style.border = '2px solid #10b981';

      // Check Marathi sibling
      const marathiSibling = findMarathiSibling(input);
      if (marathiSibling) {
        const marathiRes = await waitForMarathiSibling(marathiSibling, 4000);
        results.push({
          field: item.name,
          success: true,
          marathiGenerated: marathiRes.text,
          marathiWarning: !marathiRes.success,
        });
      } else {
        results.push({ field: item.name, success: true });
      }
    } else {
      results.push({ field: item.name, success: false, error: 'Control not found' });
    }
  }

  return results;
}

// Fill Party or Identifier Details Page
async function fillPartyPage(partyData, role, fieldMap) {
  const results = [];
  const pMap = fieldMap.party || {};
  const isIdentifier = role === 'identifier';

  // 1. Choose Party or Identifier Radio
  const radioName = isIdentifier ? 'Identifier' : 'Party';
  const roleRadio = document.querySelector(`input[name*="Party" i][value*="${radioName}" i], input[id*="${radioName}" i]`);
  if (roleRadio && !roleRadio.checked) {
    roleRadio.click();
    roleRadio.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForPostback(3000);
  }

  // 2. Party/Identifier Number
  if (partyData.partyNumber || partyData.identifierNumber) {
    const num = String(partyData.partyNumber || partyData.identifierNumber);
    const numSelect = findControl(isIdentifier ? fieldMap.identifier?.identifierNumber : pMap.partyNumber);
    if (numSelect) {
      await selectDropdownOption(numSelect, num);
      await waitForPostback(3000);
    }
  }

  // 3. Party Type (licensor/Owner vs licencee/Tenant)
  if (!isIdentifier && partyData.partyType) {
    const ptSelect = findControl(pMap.partyType);
    const aliases = fieldMap.optionAliases?.partyType?.[partyData.partyType.includes('Owner') ? 'owner' : 'tenant'] || [];
    await selectDropdownOption(ptSelect, partyData.partyType, aliases);
  }

  // 4. Entity Type (Individual)
  if (!isIdentifier) {
    const entitySelect = findControl(pMap.partyEntityType);
    if (entitySelect) await selectDropdownOption(entitySelect, 'Individual');
  }

  // 5. Fill Names (English only, let portal transliterate to Marathi)
  const nameFields = [
    { key: 'first', val: partyData.first, name: 'First Name' },
    { key: 'middle', val: partyData.middle, name: 'Middle Name' },
    { key: 'surname', val: partyData.surname, name: 'Surname' },
  ];

  for (const n of nameFields) {
    if (!n.val) continue;
    const cfg = pMap[n.key] || {};
    const input = findControl(cfg);
    if (input) {
      await fillEnglishInput(input, n.val, 'type');
      input.style.border = '2px solid #10b981';

      const marathiSibling = findMarathiSibling(input);
      if (marathiSibling) {
        const mRes = await waitForMarathiSibling(marathiSibling, 4000);
        results.push({
          field: n.name,
          value: n.val,
          marathi: mRes.text,
          verified: mRes.success,
        });
      }
    }
  }

  // 6. Age & Gender
  if (partyData.age) {
    const ageEl = findControl(pMap.age);
    if (ageEl) await fillEnglishInput(ageEl, partyData.age, 'set');
  }

  if (partyData.gender) {
    const gRadio = document.querySelector(`input[name*="Gender" i][value*="${partyData.gender}" i]`);
    if (gRadio) gRadio.click();
  }

  if (partyData.salutation) {
    const salSelect = findControl(pMap.salutation);
    if (salSelect) await selectDropdownOption(salSelect, partyData.salutation);
  }

  // 7. PAN & Contact
  if (partyData.pan) {
    const panEl = findControl(pMap.pan);
    if (panEl) await fillEnglishInput(panEl, partyData.pan, 'set');
  }
  if (partyData.contact) {
    const contactEl = findControl(pMap.contact);
    if (contactEl) await fillEnglishInput(contactEl, partyData.contact, 'set');
  }
  if (partyData.email) {
    const emailEl = findControl(pMap.email);
    if (emailEl) await fillEnglishInput(emailEl, partyData.email, 'set');
  }

  // 8. Address Block
  const addr = partyData.address || {};
  const addrMap = pMap.address || {};
  const addressItems = [
    { key: 'building', val: addr.building, name: 'Address Building' },
    { key: 'flatNo', val: addr.flatNo, name: 'Address Flat No' },
    { key: 'floorNo', val: addr.floorNo, name: 'Address Floor' },
    { key: 'road', val: addr.road, name: 'Address Road' },
    { key: 'location', val: addr.location, name: 'Address Location' },
    { key: 'villageCity', val: addr.villageCity, name: 'Address Village/City' },
    { key: 'district', val: addr.district || 'Pune', name: 'Address District' },
    { key: 'state', val: addr.state || 'Maharashtra', name: 'Address State' },
    { key: 'pincode', val: addr.pincode, name: 'Address Pincode' },
  ];

  for (const a of addressItems) {
    if (!a.val) continue;
    const cfg = addrMap[a.key] || {};
    const input = findControl(cfg);
    if (input) {
      await fillEnglishInput(input, a.val, cfg.fillMode || 'type');
      input.style.border = '2px solid #10b981';

      const marathiSibling = findMarathiSibling(input);
      if (marathiSibling) {
        const mRes = await waitForMarathiSibling(marathiSibling, 3500);
        results.push({ field: a.name, marathi: mRes.text, verified: mRes.success });
      }
    }
  }

  // 9. Executing = Self, Document Presentor (Owner only)
  if (!isIdentifier) {
    const execSelect = findControl(pMap.executing);
    if (execSelect) await selectDropdownOption(execSelect, 'Self');

    const presChk = findControl(pMap.documentPresentor);
    if (presChk && partyData.documentPresentor) {
      if (!presChk.checked && !presChk.disabled) {
        presChk.click();
      }
    }
  }

  return results;
}

// Scan mode: dumps controls and events
function scanPageControls() {
  const controls = [];
  const inputs = document.querySelectorAll('input, select, textarea');

  inputs.forEach((el) => {
    if (el.type === 'hidden') return;

    let labelText = '';
    const parentRow = el.closest('tr');
    if (parentRow) {
      const headerCell = parentRow.querySelector('td:first-child, th:first-child');
      if (headerCell) labelText = headerCell.textContent?.trim() || '';
    }

    const marathiSibling = findMarathiSibling(el);

    controls.push({
      id: el.id || '',
      name: el.name || '',
      type: el.type || el.tagName.toLowerCase(),
      labelText: labelText.slice(0, 50),
      disabled: el.disabled,
      maxlength: el.maxLength > 0 ? el.maxLength : undefined,
      hasAutoPostBack: !!(el.getAttribute('onchange')?.includes('__doPostBack') || el.getAttribute('autopostback')),
      marathiSiblingId: marathiSibling ? marathiSibling.id : undefined,
      events: {
        onchange: !!el.onchange || !!el.getAttribute('onchange'),
        onblur: !!el.onblur || !!el.getAttribute('onblur'),
        onkeyup: !!el.onkeyup || !!el.getAttribute('onkeyup'),
      },
    });
  });

  return controls;
}

// Read Token No from Header
function captureHeaderGRN() {
  const headerTexts = document.querySelectorAll('h1, h2, h3, h4, span, td, div');
  for (const el of headerTexts) {
    const text = el.textContent || '';
    const match = text.match(/Token\s*No\s*[:\-\s]*([A-Z0-9]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCAN_PAGE') {
    const report = scanPageControls();
    sendResponse({ success: true, count: report.length, controls: report });
    return true;
  }

  if (request.action === 'CAPTURE_GRN') {
    const grn = captureHeaderGRN();
    sendResponse({ success: !!grn, grnToken: grn });
    return true;
  }

  if (request.action === 'FILL_PROPERTY') {
    fillPropertyPage(request.propertyData, request.fieldMap).then((results) => {
      sendResponse({ success: true, results });
    });
    return true;
  }

  if (request.action === 'FILL_PARTY') {
    fillPartyPage(request.partyData, request.role, request.fieldMap).then((results) => {
      sendResponse({ success: true, results });
    });
    return true;
  }

  if (request.action === 'CLICK_ADD_BUTTON') {
    // Only clicks the draft 'Add' button once
    const btn = document.querySelector(
      'input[value*="Add" i], button:contains("Add"), input[id*="btnAdd" i]'
    );
    if (btn) {
      btn.click();
      waitForPostback().then(() => {
        sendResponse({ success: true, clicked: true });
      });
      return true;
    }
    sendResponse({ success: false, message: 'Add button not found on page' });
    return true;
  }
});
