/**
 * Google Apps Script for Guest List
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Google Sheet with two columns:
 *    - Column A header: "guest"
 *    - Column B header: "present"
 *    - Mark present guests with "x" in column B
 *
 * 2. Open Extensions → Apps Script
 *
 * 3. Delete any existing code and paste this entire file
 *
 * 4. Click "Deploy" → "New deployment"
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 *
 * 5. Copy the Web App URL and paste it into index.html (replace YOUR_APPS_SCRIPT_URL_HERE)
 *
 * 6. After any code changes, create a NEW deployment (don't edit existing)
 */

// Handle GET requests - returns all guests as JSON
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    // Skip header row, map to objects
    const guests = data.slice(1).map(row => ({
      guest: row[0],
      present: row[1] === 'x' || row[1] === 'X'
    }));

    return createJsonResponse(guests);
  } catch (error) {
    return createJsonResponse({ error: error.message }, 500);
  }
}

// Handle POST requests - updates presence or adds new guest
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'update';

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (action === 'add') {
      // Add new guest
      const guestName = payload.guest;
      if (!guestName || !guestName.trim()) {
        return createJsonResponse({ error: 'Guest name is required' }, 400);
      }

      // Check if guest already exists
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toLowerCase() === guestName.trim().toLowerCase()) {
          return createJsonResponse({ error: 'Guest already exists' }, 400);
        }
      }

      // Add new row
      sheet.appendRow([guestName.trim(), '']);
      return createJsonResponse({ success: true });
    }

    // Default: update presence
    const guestName = payload.guest;
    const present = payload.present;
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === guestName) {
        sheet.getRange(i + 1, 2).setValue(present ? 'x' : '');
        return createJsonResponse({ success: true });
      }
    }

    return createJsonResponse({ error: 'Guest not found' }, 404);
  } catch (error) {
    return createJsonResponse({ error: error.message }, 500);
  }
}

// Helper to create JSON response with CORS headers
function createJsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
