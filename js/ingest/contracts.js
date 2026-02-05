/**
 * REQUIRED COLUMN CONTRACTS
 * If any column is missing → hard fail
 */

export const CONTRACTS = {
  sale30D: [
    "MP",
    "Date",
    "SKU",
    "Channel ID",
    "Quantity",
    "Warehouse Id",
    "Fulfillment Type",
    "Uniware SKU",
    "Style ID",
    "Size"
  ],

  fcStock: [
    "MP",
    "Warehouse Id",
    "SKU",
    "Channel ID",
    "Quantity"
  ],

  uniwareStock: [
    "Uniware SKU",
    "Quantity"
  ],

  companyRemarks: [
    "Style ID",
    "Category",
    "Company Remark"
  ]
};

export function validateContract(rows, contractName) {
  if (!rows.length) return;

  const required = CONTRACTS[contractName];
  const columns = Object.keys(rows[0]);

  required.forEach(col => {
    if (!columns.includes(col)) {
      throw new Error(
        `Contract violation in ${contractName}: missing column "${col}"`
      );
    }
  });
}
