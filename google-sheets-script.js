/**
 * GOOGLE APPS SCRIPT FOR AUTOMATED RENT AGREEMENT AUTO-ENTRY
 * 
 * Instructions:
 * 1. Open your Google Sheet in Browser.
 * 2. Click on "Extensions" -> "Apps Script".
 * 3. Delete existing code and paste this script below.
 * 4. Click "Deploy" -> "New deployment".
 * 5. Select type: "Web app".
 * 6. Set "Execute as": "Me".
 * 7. Set "Who has access": "Anyone".
 * 8. Click "Deploy" and copy the Web App URL into your .env.local file as:
 *    GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Sr. No./Rent/Dep./Tennure",
        "Date/Flat/Shop No./fee",
        "Owner's Name & Address",
        "witness 1",
        "witness 2",
        "Token No/Pwd/GRN/PRN(DHC)",
        "Since/Date of receipt",
        "Properties Address",
        "No.1,Tenant's Name,Address",
        "No.2,Tenant's Name,Address",
        "No.3,Tenant's Name,Address",
        "No.4,Tenant's Name,Address"
      ]);
    }
    
    var newRow = [
      data["Sr. No./Rent/Dep./Tennure"] || "",
      data["Date/Flat/Shop No./fee"] || "",
      data["Owner's Name & Address"] || "",
      data["witness 1"] || "",
      data["witness 2"] || "",
      data["Token No/Pwd/GRN/PRN(DHC)"] || "",
      data["Since/Date of receipt"] || "",
      data["Properties Address"] || "",
      data["No.1,Tenant's Name,Address"] || "",
      data["No.2,Tenant's Name,Address"] || "",
      data["No.3,Tenant's Name,Address"] || "",
      data["No.4,Tenant's Name,Address"] || ""
    ];
    
    sheet.appendRow(newRow);
    
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
