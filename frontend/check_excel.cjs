const XLSX = require('xlsx');

const filePath = "C:\\Users\\Gerald\\OneDrive - Contoso\\Gyro's Store - Finanzas de la tienda\\Control_Inventario_2026.xlsx";
const workbook = XLSX.readFile(filePath);

console.log("Sheets:", workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const in130Sales = data.filter(row => {
    return Object.values(row).some(v => String(v).includes('IN130'));
  });

  if (in130Sales.length > 0) {
    console.log(`\nFound ${in130Sales.length} IN130 entries in sheet "${sheetName}":`);
    in130Sales.forEach(row => {
      console.log(JSON.stringify(row));
    });
  }
});
