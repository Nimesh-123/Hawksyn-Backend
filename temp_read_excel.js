const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'doc/hip -doc/00 Hawksyn_HIP_Content_MasterTable.xlsx');
const workbook = xlsx.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length > 1) {
        console.log(`Row 1 for sheet '${sheetName}':`, data[1]);
        console.log(`Row 2 for sheet '${sheetName}':`, data[2]);
    }
}
