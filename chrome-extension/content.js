// Chrome Extension Content Script for IGR Maharashtra Autofill
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTOFILL_IGR" && request.data) {
    const data = request.data;
    
    // Auto-fill Licensor (Landlord) fields
    if (data.licensor) {
      setInputValue('#txtPartyName', data.licensor.fullName);
      setInputValue('#txtUID', data.licensor.aadhaar);
      setInputValue('#txtPAN', data.licensor.pan);
      setInputValue('#txtAddress', data.licensor.address);
    }
    
    // Auto-fill Property fields
    if (data.property) {
      setInputValue('#txtBuildingName', data.property.buildingName);
      setInputValue('#txtFlatNo', data.property.flatNo);
      setInputValue('#txtFloor', data.property.floorNo);
      setInputValue('#txtSurveyNo', data.property.surveyNo);
      setInputValue('#txtArea', data.property.areaSqFt);
      setInputValue('#txtPinCode', data.property.pincode);
    }

    sendResponse({ status: "Autofill execution complete" });
  }
});

function setInputValue(selector, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
