/**
 * GOOGLE APPS SCRIPT FOR AUTOMATED RENT AGREEMENT AUTO-ENTRY (7-ROW BLOCK LAYOUT)
 *
 * Instructions:
 * 1. Open your Google Sheet in Browser.
 * 2. Click "Extensions" -> "Apps Script".
 * 3. Replace the existing code with this updated script.
 * 4. Click "Deploy" -> "Manage deployments" -> "Edit" -> New version -> "Deploy".
 * 5. Ensure "Who has access" is set to "Anyone".
 * 6. Copy the Web App URL into .env.local as GOOGLE_SHEETS_WEBHOOK_URL.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var payload = JSON.parse(e.postData.contents);

    // 1. Check or Initialize Header Row
    var headerRowIndex = 1;
    var defaultHeaders = [
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
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(defaultHeaders);
      var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#e8f0fe");
    }

    // 2. Map Column Indices from Header Text
    var lastCol = Math.max(sheet.getLastColumn(), defaultHeaders.length);
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = mapHeaders(currentHeaders);

    // 3. Handle GRN Update Action (Task 5: Enter GRN/PRN)
    if (payload.action === "UPDATE_GRN") {
      var tokenToFind = payload.tokenNumber;
      var grnValue = payload.grnNo || payload.prnNo || "";
      var rows = sheet.getDataRange().getValues();
      var found = false;

      for (var r = 1; r < rows.length; r++) {
        // Look for row 0 of agreement containing serial number or token
        var grnCol = colMap.grn >= 0 ? colMap.grn : 5;
        var dateCol = colMap.date >= 0 ? colMap.date : 1;
        // In the block, row 0 has the GRN cell
        if (payload.srNo && String(rows[r][colMap.srNo || 0]) === String(payload.srNo)) {
          sheet.getRange(r + 1, grnCol + 1).setValue(grnValue);
          sheet.getRange(r + 1, grnCol + 1).setBackground("#fff2cc");
          found = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: "success", updated: found }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Construct 7-Row Block
    var block = payload.block;
    if (!block || !Array.isArray(block) || block.length !== 7) {
      return ContentService.createTextOutput(JSON.stringify({ result: "error", message: "Payload must include 7-row block array" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var startRow = sheet.getLastRow() + 1;
    var maxCols = 12;

    // Convert block arrays into full row arrays matching dynamic header columns
    var grid = [];
    for (var i = 0; i < 7; i++) {
      var rowData = new Array(maxCols).fill("");
      var sourceRow = block[i] || {};

      setCell(rowData, colMap.srNo, sourceRow.srNo || sourceRow.rent || sourceRow.deposit || sourceRow.tenure || "");
      setCell(rowData, colMap.date, sourceRow.date || sourceRow.propertyType || sourceRow.flatNo || sourceRow.area || "");
      setCell(rowData, colMap.owner, sourceRow.ownerName || sourceRow.ownerAadhaar || sourceRow.ownerPan || sourceRow.ownerAge || sourceRow.ownerMobile || sourceRow.ownerAddress || "");
      setCell(rowData, colMap.witness1, sourceRow.witness1Name || sourceRow.witness1Aadhaar || sourceRow.witness1Age || sourceRow.witness1Address || "");
      setCell(rowData, colMap.witness2, sourceRow.witness2Name || sourceRow.witness2Aadhaar || sourceRow.witness2Age || sourceRow.witness2Address || "");
      setCell(rowData, colMap.grn, sourceRow.grn || "");
      setCell(rowData, colMap.receipt, sourceRow.receiptDate || "");
      setCell(rowData, colMap.property, sourceRow.propertyAddress || "");

      // Tenant columns
      var tenants = sourceRow.tenants || [];
      for (var t = 0; t < tenants.length; t++) {
        var tCol = colMap.tenants[t];
        if (tCol !== undefined && tCol >= 0) {
          setCell(rowData, tCol, tenants[t] || "");
        }
      }

      grid.push(rowData);
    }

    // Write the 7 rows
    var range = sheet.getRange(startRow, 1, 7, maxCols);
    range.setNumberFormat("@"); // Format all as plain text to avoid scientific notation
    range.setValues(grid);

    // Style Row 0: Light Green Header Row
    var row0Range = sheet.getRange(startRow, 1, 1, maxCols);
    row0Range.setBackground("#b6d7a8");
    row0Range.setFontWeight("bold");

    // Highlight Cell F (GRN/PRN) in Yellow
    var grnColIndex = (colMap.grn >= 0 ? colMap.grn : 5) + 1;
    sheet.getRange(startRow, grnColIndex).setBackground("#fff2cc");

    // Style Row 6: Tall, Wrap Text
    var row6Index = startRow + 6;
    sheet.setRowHeight(row6Index, 65);
    sheet.getRange(row6Index, 1, 1, maxCols).setWrap(true);

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      startRow: startRow,
      rowsAppended: 7
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function setCell(rowArray, colIdx, value) {
  if (colIdx !== undefined && colIdx >= 0 && colIdx < rowArray.length) {
    rowArray[colIdx] = value != null ? String(value) : "";
  }
}

function mapHeaders(headers) {
  var map = {
    srNo: 0,
    date: 1,
    owner: 2,
    witness1: 3,
    witness2: 4,
    grn: 5,
    receipt: 6,
    property: 7,
    tenants: [8, 9, 10, 11]
  };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase();
    if (h.indexOf("sr.") >= 0 || h.indexOf("rent") >= 0) map.srNo = i;
    else if (h.indexOf("date") >= 0 && (h.indexOf("flat") >= 0 || h.indexOf("shop") >= 0)) map.date = i;
    else if (h.indexOf("owner") >= 0 || h.indexOf("landlord") >= 0) map.owner = i;
    else if (h.indexOf("witness 1") >= 0) map.witness1 = i;
    else if (h.indexOf("witness 2") >= 0) map.witness2 = i;
    else if (h.indexOf("token") >= 0 || h.indexOf("grn") >= 0 || h.indexOf("pwd") >= 0) map.grn = i;
    else if (h.indexOf("since") >= 0 || h.indexOf("receipt") >= 0) map.receipt = i;
    else if (h.indexOf("properties") >= 0 || h.indexOf("property") >= 0) map.property = i;
    else if (h.indexOf("tenant") >= 0 || h.indexOf("no.") >= 0) {
      if (h.indexOf("no.1") >= 0 || h.indexOf("tenant 1") >= 0) map.tenants[0] = i;
      else if (h.indexOf("no.2") >= 0 || h.indexOf("tenant 2") >= 0) map.tenants[1] = i;
      else if (h.indexOf("no.3") >= 0 || h.indexOf("tenant 3") >= 0) map.tenants[2] = i;
      else if (h.indexOf("no.4") >= 0 || h.indexOf("tenant 4") >= 0) map.tenants[3] = i;
    }
  }

  return map;
}
