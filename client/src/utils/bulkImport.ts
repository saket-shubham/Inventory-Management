// Must match AdminProducts.tsx's BulkRow fields exactly — imported data is
// only ever a way to populate that same row shape, nothing more.
export type BulkFieldKey =
  | "name"
  | "sku"
  | "barcode"
  | "category"
  | "brand"
  | "mrp"
  | "sellingPrice"
  | "taxPercent"
  | "unit"
  | "imageUrl"
  | "stockTotal";

export const BULK_FIELD_LABELS: Record<BulkFieldKey, string> = {
  name: "Name",
  sku: "SKU",
  barcode: "Barcode",
  category: "Category",
  brand: "Brand",
  mrp: "MRP",
  sellingPrice: "Price",
  taxPercent: "Tax %",
  unit: "Unit",
  imageUrl: "Image URL",
  stockTotal: "Total stock",
};

export const BULK_FIELD_ORDER: BulkFieldKey[] = [
  "name",
  "sku",
  "barcode",
  "category",
  "brand",
  "mrp",
  "sellingPrice",
  "taxPercent",
  "unit",
  "imageUrl",
  "stockTotal",
];

// Only exact, unambiguous header aliases go here. Anything not listed here —
// e.g. "Rate", which could mean price or a tax rate — is deliberately left
// unmapped so the user has to pick it manually, rather than guessing wrong.
const COLUMN_ALIASES: Record<BulkFieldKey, string[]> = {
  name: ["name", "productname", "itemname", "product"],
  sku: ["sku", "itemcode", "productcode"],
  barcode: ["barcode", "ean", "upc", "ean13", "upccode"],
  category: ["category"],
  brand: ["brand"],
  mrp: ["mrp", "maximumretailprice"],
  sellingPrice: ["price", "sellingprice", "saleprice"],
  taxPercent: ["tax", "taxpercent", "gst", "gstpercent"],
  unit: ["unit", "uom"],
  imageUrl: ["image", "imageurl", "photo", "picture"],
  stockTotal: ["stock", "quantity", "qty", "totalstock"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Reads the first sheet of an uploaded .xlsx/.xls/.csv file into header + row
 * data. SheetJS is a large library only needed here, so it's dynamically
 * imported — every other page loads without it.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the selected file."));
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("The file has no sheets.");
        const sheet = workbook.Sheets[firstSheetName];

        // header: 1 gives raw rows-of-arrays so we control header detection
        // ourselves instead of trusting the first row blindly.
        const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
        if (raw.length === 0) throw new Error("The sheet is empty.");

        const headers = raw[0].map((h) => String(h ?? "").trim());
        if (headers.every((h) => !h)) throw new Error("Couldn't find a header row in the sheet.");

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < raw.length; i++) {
          const line = raw[i];
          if (!line || line.every((c) => String(c ?? "").trim() === "")) continue;
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            if (!h) return;
            row[h] = String(line[idx] ?? "").trim();
          });
          rows.push(row);
        }

        if (rows.length === 0) throw new Error("No data rows found below the header.");
        resolve({ headers: headers.filter(Boolean), rows });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Couldn't parse this file."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** Best-effort auto-mapping — "" means "couldn't confidently identify this column". */
export function autoMapColumns(headers: string[]): Record<string, BulkFieldKey | ""> {
  const mapping: Record<string, BulkFieldKey | ""> = {};
  const used = new Set<BulkFieldKey>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let match: BulkFieldKey | "" = "";
    for (const field of BULK_FIELD_ORDER) {
      if (used.has(field)) continue;
      if (COLUMN_ALIASES[field].includes(normalized)) {
        match = field;
        break;
      }
    }
    mapping[header] = match;
    if (match) used.add(match);
  }
  return mapping;
}

export interface MappedImportRow {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  mrp: string;
  sellingPrice: string;
  taxPercent: string;
  unit: string;
  imageUrl: string;
  stockTotal: string;
  errors: string[];
}

/** Applies the confirmed header->field mapping to every raw row. */
export function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, BulkFieldKey | "">
): Omit<MappedImportRow, "errors">[] {
  return rows.map((row) => {
    const mapped: Omit<MappedImportRow, "errors"> = {
      name: "",
      sku: "",
      barcode: "",
      category: "",
      brand: "",
      mrp: "",
      sellingPrice: "",
      taxPercent: "",
      unit: "",
      imageUrl: "",
      stockTotal: "",
    };
    for (const [header, field] of Object.entries(mapping)) {
      if (field) mapped[field] = row[header] ?? "";
    }
    return mapped;
  });
}

/**
 * Validates one mapped row against the same rules the existing manual Bulk
 * Add table already enforces (see AdminProducts.tsx handleBulkSubmit), plus
 * duplicate detection within the sheet and against already-loaded products —
 * mirrors, never replaces, that existing logic.
 */
export function validateMappedRows(
  rows: Omit<MappedImportRow, "errors">[],
  existingBarcodes: Set<string>,
  existingSkus: Set<string>
): MappedImportRow[] {
  const seenBarcodes = new Set<string>();
  const seenSkus = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];

    if (!row.name.trim()) errors.push("Name is required");
    if (!row.barcode.trim()) errors.push("Barcode is required");
    if (row.mrp.trim() === "" || Number.isNaN(Number(row.mrp))) errors.push("MRP must be a number");
    if (row.sellingPrice.trim() === "" || Number.isNaN(Number(row.sellingPrice))) errors.push("Price must be a number");
    if (row.taxPercent.trim() !== "" && (Number.isNaN(Number(row.taxPercent)) || Number(row.taxPercent) < 0 || Number(row.taxPercent) > 100)) {
      errors.push("Tax % must be between 0 and 100");
    }
    if (row.stockTotal.trim() !== "" && (Number.isNaN(Number(row.stockTotal)) || Number(row.stockTotal) < 0)) {
      errors.push("Stock must be a non-negative number");
    }

    const barcode = row.barcode.trim();
    if (barcode) {
      if (seenBarcodes.has(barcode)) errors.push("Duplicate barcode within this file");
      else if (existingBarcodes.has(barcode)) errors.push("Barcode already exists in Products");
      seenBarcodes.add(barcode);
    }

    const sku = row.sku.trim();
    if (sku) {
      if (seenSkus.has(sku)) errors.push("Duplicate SKU within this file");
      else if (existingSkus.has(sku)) errors.push("SKU already exists in Products");
      seenSkus.add(sku);
    }

    return { ...row, errors };
  });
}
