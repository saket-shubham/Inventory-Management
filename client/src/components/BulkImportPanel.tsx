import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload, X } from "lucide-react";
import {
  applyMapping,
  autoMapColumns,
  BULK_FIELD_LABELS,
  BULK_FIELD_ORDER,
  parseSpreadsheetFile,
  validateMappedRows,
  type BulkFieldKey,
  type MappedImportRow,
  type ParsedSheet,
} from "../utils/bulkImport";

interface BulkImportPanelProps {
  existingBarcodes: Set<string>;
  existingSkus: Set<string>;
  onConfirm: (rows: MappedImportRow[]) => void;
  onClose: () => void;
}

type Step = "upload" | "mapping" | "preview";

export function BulkImportPanel({ existingBarcodes, existingSkus, onConfirm, onClose }: BulkImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, BulkFieldKey | "">>({});

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParsing(true);
    setError(null);
    try {
      const result = await parseSpreadsheetFile(file);
      setParsed(result);
      setMapping(autoMapColumns(result.headers));
      setFileName(file.name);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse this file.");
    } finally {
      setParsing(false);
    }
  }

  const mappedFieldsUsed = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const nameMapped = mappedFieldsUsed.has("name");
  const barcodeMapped = mappedFieldsUsed.has("barcode");

  const previewRows: MappedImportRow[] = useMemo(() => {
    if (!parsed || step !== "preview") return [];
    const mappedOnly = applyMapping(parsed.rows, mapping);
    return validateMappedRows(mappedOnly, existingBarcodes, existingSkus);
  }, [parsed, mapping, step, existingBarcodes, existingSkus]);

  const invalidCount = previewRows.filter((r) => r.errors.length > 0).length;

  function updateMapping(header: string, field: BulkFieldKey | "") {
    setMapping((prev) => ({ ...prev, [header]: field }));
  }

  return (
    <div className="admin-form bulk-import-panel">
      <div className="section-header">
        <h3>
          <FileSpreadsheet size={16} /> Import from Excel/CSV
        </h3>
        <button type="button" className="link-button" onClick={onClose}>
          <X size={14} /> Close
        </button>
      </div>

      {step === "upload" && (
        <>
          <p className="help-text">
            Upload an Excel (.xlsx/.xls) or CSV file. Nothing is saved yet — the file only populates the Bulk add
            products table below for you to review and edit, exactly like typing the rows in by hand. It's only
            saved when you click <strong>Save all</strong>.
          </p>
          <button type="button" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> {parsing ? "Reading file..." : "Choose file"}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
          {error && (
            <p className="error-text">
              <TriangleAlert size={14} /> {error}
            </p>
          )}
        </>
      )}

      {step === "mapping" && parsed && (
        <>
          <p className="help-text">
            <strong>{fileName}</strong> — {parsed.rows.length} row(s) found. Columns we recognized are mapped
            automatically; check any marked "Select field" and pick the right one yourself.
          </p>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Column in file</th>
                <th>Sample value</th>
                <th>Maps to</th>
              </tr>
            </thead>
            <tbody>
              {parsed.headers.map((header) => (
                <tr key={header}>
                  <td>{header}</td>
                  <td className="muted small">{parsed.rows[0]?.[header] || "—"}</td>
                  <td>
                    <select value={mapping[header] ?? ""} onChange={(e) => updateMapping(header, e.target.value as BulkFieldKey | "")}>
                      <option value="">— Select field —</option>
                      {BULK_FIELD_ORDER.map((field) => (
                        <option key={field} value={field} disabled={mappedFieldsUsed.has(field) && mapping[header] !== field}>
                          {BULK_FIELD_LABELS[field]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!nameMapped || !barcodeMapped) && (
            <p className="error-text">
              <TriangleAlert size={14} /> Map at least one column to Name and one to Barcode to continue — both are
              required for every product.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="button" className="primary" disabled={!nameMapped || !barcodeMapped} onClick={() => setStep("preview")}>
              Continue to preview
            </button>
            <button type="button" className="link-button" onClick={() => setStep("upload")}>
              Back
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <p className={invalidCount > 0 ? "error-text" : "success-text"}>
            {invalidCount > 0 ? <TriangleAlert size={14} /> : <CheckCircle2 size={14} />}
            {previewRows.length} row(s) — {previewRows.length - invalidCount} ready, {invalidCount} need correction
            (fixable after import, in the table itself).
          </p>
          <div className="bulk-table-wrap">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>MRP</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className={row.errors.length > 0 ? "bulk-row-error" : ""}>
                    <td>{row.name || "—"}</td>
                    <td>{row.sku || <span className="muted small">auto</span>}</td>
                    <td>{row.barcode || "—"}</td>
                    <td>{row.mrp || "—"}</td>
                    <td>{row.sellingPrice || "—"}</td>
                    <td>{row.stockTotal || "—"}</td>
                    <td>
                      {row.errors.length === 0 ? (
                        <span className="discount-badge">ok</span>
                      ) : (
                        <span className="out-of-stock-badge" title={row.errors.join(", ")}>
                          {row.errors.length} issue(s)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="button" className="primary" onClick={() => onConfirm(previewRows)}>
              <CheckCircle2 size={14} /> Confirm import ({previewRows.length} row{previewRows.length === 1 ? "" : "s"})
            </button>
            <button type="button" className="link-button" onClick={() => setStep("mapping")}>
              Back to mapping
            </button>
          </div>
        </>
      )}
    </div>
  );
}
