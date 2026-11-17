# Monthly report templates

Protonic's Wi-Fi Marketing Report (Word, PDF) and guest list (Excel),
with the client's details and graphs taken out. `src/marketingReport.js`
fills them in for a site and a month:

- `report.docx`: `{{MONTH}}`, `{{COMPANY}}`, `{{SUBMITTED}}`, `{{CONTACT}}`
  in the text; `word/media/image1.png` (popular times) and `image2.png`
  (new and returning guests) are the graphs
- `report.pdf`: the same pages without the title, To, Submission date,
  Dear line and graphs, which are drawn on in the same places
- `guests.xlsx`: the same file with no rows; `{{COLS}}`, `{{ROWS}}`,
  `{{DIMENSION}}` in `xl/worksheets/sheet1.xml`

To change the report's look or wording, change these files (keep the
placeholders). Poppins (Indian Type Foundry) is under the SIL Open Font
License 1.1.
