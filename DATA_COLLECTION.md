# Data Collection (Aggregated Per Question)

This project can optionally send **anonymous, aggregated** question results to a Google Sheet (no student IDs).

## What Gets Sent

For each revive-question attempt:
- `questionId` (from `data/questions_isat.json`)
- `correct` (`true`/`false`)

## Setup (Google Sheets + Apps Script)

1. Create a Google Sheet.
2. Rename (or create) a tab named: `Responses`
3. Open **Extensions → Apps Script**.
4. Paste the script below.
5. Click **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL.
7. In `src/main.js`, set `DATA_ENDPOINT` to that URL.

## Apps Script (paste into Code.gs)

```js
const SHEET_NAME = 'Responses';

function ensureHeader(sheet) {
  const header = ['questionId', 'correctCount', 'wrongCount', 'lastUpdated'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    return;
  }
  const first = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const match = header.every((h, i) => String(first[i] || '').trim() === h);
  if (!match) sheet.insertRowBefore(1).appendRow(header);
}

function getOrCreateRow(sheet, questionId) {
  const last = sheet.getLastRow();
  if (last < 2) {
    sheet.appendRow([questionId, 0, 0, new Date()]);
    return sheet.getLastRow();
  }
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === questionId) return i + 2;
  }
  sheet.appendRow([questionId, 0, 0, new Date()]);
  return sheet.getLastRow();
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActive().insertSheet(SHEET_NAME);
  ensureHeader(sheet);

  const body = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
  const data = JSON.parse(body);
  const questionId = String(data.questionId || '').trim();
  const correct = Boolean(data.correct);

  if (!questionId) {
    return ContentService.createTextOutput('missing questionId');
  }

  const row = getOrCreateRow(sheet, questionId);
  const correctCell = sheet.getRange(row, 2);
  const wrongCell = sheet.getRange(row, 3);
  const updatedCell = sheet.getRange(row, 4);

  if (correct) correctCell.setValue(Number(correctCell.getValue() || 0) + 1);
  else wrongCell.setValue(Number(wrongCell.getValue() || 0) + 1);
  updatedCell.setValue(new Date());

  return ContentService.createTextOutput('ok');
}
```

## Notes

- This is intentionally simple and unauthenticated. Anyone with the endpoint URL could send fake counts, so keep the URL private.
- To compute percentages in Sheets, add columns like:
  - `%Correct = correctCount / (correctCount + wrongCount)`

