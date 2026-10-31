/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useDwin } from '../../context/DwinContext';
import { 
  generateCHeader, 
  generatePythonDriver, 
  generateCsvExport,
  getParameterSchemaRows,
  generateParameterSchemaCsv,
  generateParameterSchemaTxt,
  generateParameterSchemaXlsxBlob,
  parseParameterSchemaCsv,
  SCHEMA_COLUMNS
} from '../../utils/codeExport';
import { DwinProject } from '../../types/dwin';
import { 
  Download, Upload, Copy, Check, FileCode, FileText, 
  RotateCcw, CheckCircle2, AlertTriangle, FileSpreadsheet,
  Search, Table, Code2, Layers, Cpu, Hash, FileCheck2
} from 'lucide-react';

export const ImportExport: React.FC = () => {
  const { project, importProject, resetProjectToDefault } = useDwin();
  const [activeExportTab, setActiveExportTab] = useState<'schema_export' | 'project_json' | 'c_header' | 'python' | 'csv'>('schema_export');
  const [copied, setCopied] = useState<string | null>(null);
  const [schemaViewMode, setSchemaViewMode] = useState<'table' | 'raw_csv' | 'raw_txt'>('table');
  const [schemaSearchQuery, setSchemaSearchQuery] = useState('');
  
  // Column tick marks for export design (all 10 active by default)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'serialNumber', 'screen', 'vp', 'parameterName', 'unit',
    'scale', 'dataType', 'value', 'readWrite', 'hexValue'
  ]);

  // Adjusted value view mode
  const [valueViewMode, setValueViewMode] = useState<'standard' | 'scaled' | 'raw' | 'hex'>('scaled');

  const [importStatus, setImportStatus] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });

  const cHeaderCode = generateCHeader(project);
  const pythonCode = generatePythonDriver(project);
  const legacyCsvData = generateCsvExport(project);
  const projectJson = JSON.stringify(project, null, 2);

  // Parameter Registry Schema Generation with dynamic column and value adjustments
  const schemaRows = useMemo(() => getParameterSchemaRows(project), [project]);
  const schemaCsv = useMemo(() => generateParameterSchemaCsv(project, selectedColumns, valueViewMode), [project, selectedColumns, valueViewMode]);
  const schemaTxt = useMemo(() => generateParameterSchemaTxt(project, selectedColumns, valueViewMode), [project, selectedColumns, valueViewMode]);

  // Filtered rows for the schema table view
  const filteredSchemaRows = useMemo(() => {
    if (!schemaSearchQuery.trim()) return schemaRows;
    const q = schemaSearchQuery.toLowerCase();
    return schemaRows.filter(r => 
      r.parameterName.toLowerCase().includes(q) ||
      r.vp.toLowerCase().includes(q) ||
      r.screen.toLowerCase().includes(q) ||
      r.dataType.toLowerCase().includes(q) ||
      r.readWrite.toLowerCase().includes(q) ||
      String(r.serialNumber).includes(q) ||
      r.scaledValue.toLowerCase().includes(q) ||
      r.rawHexWord.toLowerCase().includes(q)
    );
  }, [schemaRows, schemaSearchQuery]);

  const toggleColumn = (colId: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev; // Keep at least one column
        return prev.filter(c => c !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  const selectAllColumns = () => {
    setSelectedColumns(SCHEMA_COLUMNS.map(c => c.id));
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadXlsx = () => {
    try {
      const blob = generateParameterSchemaXlsxBlob(project, selectedColumns, valueViewMode);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_parameter_schema.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setImportStatus({
        status: 'error',
        message: `Excel export error: ${err.message || 'Failed to generate XLSX spreadsheet.'}`
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = event => {
      try {
        const text = event.target?.result as string;

        // Check if file is CSV or TXT schema
        if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
          const { parameters: parsedParams } = parseParameterSchemaCsv(text);
          if (parsedParams.length === 0) {
            throw new Error('No valid parameters found in schema file. Expected columns: Serial Number, Screen, VP, Parameter Name, etc.');
          }

          // Merge or add parameters into current project
          const newParams = [...project.parameters];
          let addedCount = 0;
          let updatedCount = 0;

          for (const p of parsedParams) {
            const existingIdx = newParams.findIndex(ep => ep.vpAddress === p.vpAddress);
            if (existingIdx >= 0) {
              newParams[existingIdx] = { ...newParams[existingIdx], ...p, id: newParams[existingIdx].id };
              updatedCount++;
            } else {
              newParams.push(p);
              addedCount++;
            }
          }

          importProject({
            ...project,
            parameters: newParams,
            updatedAt: new Date().toISOString()
          });

          setImportStatus({
            status: 'success',
            message: `Schema imported successfully: ${addedCount} new parameters added, ${updatedCount} existing updated (${parsedParams.length} total from "${file.name}").`
          });
          return;
        }

        // Standard JSON project import
        const parsed: DwinProject = JSON.parse(text);
        if (!parsed.screens || !parsed.parameters) {
          throw new Error('Missing screens or parameters array in JSON project.');
        }
        importProject(parsed);
        setImportStatus({
          status: 'success',
          message: `Successfully imported project "${parsed.name}" (${parsed.screens.length} screens, ${parsed.parameters.length} parameters).`
        });
      } catch (err: any) {
        setImportStatus({
          status: 'error',
          message: `Import failed: ${err.message || 'Invalid project or schema format.'}`
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Import &amp; Export
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Export parameter registry schemas (.csv, .txt, .xlsx) for sharing across other GUIs and HMIs, or download production C/C++ firmware headers and JSON backups.
          </p>
        </div>

        <button
          onClick={() => {
            resetProjectToDefault();
            setImportStatus({ status: 'success', message: 'Project reset to default sample project.' });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Default</span>
        </button>
      </div>

      {/* Import File Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" />
          <span>Import Project or Schema File (.json, .csv, .txt, .dwinhex)</span>
        </h2>

        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 bg-slate-50/50 transition-colors">
          <input
            type="file"
            accept=".json,.dwinhex,.csv,.txt"
            onChange={handleFileUpload}
            id="file-upload"
            className="hidden"
          />
          <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-900">
              Click to select a Project (.json) or Parameter Schema (.csv / .txt) file
            </div>
            <div className="text-[11px] text-slate-500">
              Transfer parameter registries from other GUIs or restore full screens and VP memory architectures.
            </div>
          </label>
        </div>

        {importStatus.status === 'success' && (
          <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importStatus.message}</span>
          </div>
        )}

        {importStatus.status === 'error' && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{importStatus.message}</span>
          </div>
        )}
      </div>

      {/* Export Tabs Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Export Project &amp; Code
            </h2>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto text-xs border border-slate-200 p-1 rounded-lg bg-slate-50">
            <button
              onClick={() => setActiveExportTab('schema_export')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeExportTab === 'schema_export'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>GUI Schema (.csv / .txt / .xlsx)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activeExportTab === 'schema_export' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {project.parameters.length}
              </span>
            </button>
            <button
              onClick={() => setActiveExportTab('project_json')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                activeExportTab === 'project_json'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Project JSON
            </button>
            <button
              onClick={() => setActiveExportTab('c_header')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                activeExportTab === 'c_header'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              C/C++ Header (.h)
            </button>
            <button
              onClick={() => setActiveExportTab('python')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                activeExportTab === 'python'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Python Driver (.py)
            </button>
            <button
              onClick={() => setActiveExportTab('csv')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                activeExportTab === 'csv'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Legacy CSV Table
            </button>
          </div>
        </div>

        {/* 1. GUI Schema Export (.csv / .txt / .xlsx) */}
        {activeExportTab === 'schema_export' && (
          <div className="space-y-4">
            {/* Top Toolbar: Action Download Buttons & Copy */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Universal Parameter Registry Schema</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {selectedColumns.length}/10 Columns Exported
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Customizable schema export with column tick marks and variable pointer value formatting.
                </p>
              </div>

              {/* Download Buttons for CSV, TXT, XLSX, and Copy */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleDownload(schemaCsv, `${project.name.toLowerCase().replace(/\s+/g, '_')}_schema.csv`, 'text/csv;charset=utf-8;')}
                  className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors"
                  title="Download comma-separated .csv file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .CSV</span>
                </button>

                <button
                  onClick={() => handleDownload(schemaTxt, `${project.name.toLowerCase().replace(/\s+/g, '_')}_schema.txt`, 'text/plain;charset=utf-8;')}
                  className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors"
                  title="Download formatted text schema .txt file"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download .TXT</span>
                </button>

                <button
                  onClick={handleDownloadXlsx}
                  className="px-2.5 py-1.5 rounded bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors"
                  title="Download genuine Microsoft Excel (.xlsx) spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download .XLSX</span>
                </button>

                <button
                  onClick={() => handleCopy(schemaCsv, 'schema_csv')}
                  className="px-2.5 py-1.5 rounded border border-slate-300 hover:bg-white bg-slate-100 flex items-center gap-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors"
                  title="Copy comma-separated values to clipboard"
                >
                  {copied === 'schema_csv' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copy Comma Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CSS SELECTOR 1: Schema Field Definition Checklist Badge Bar with Tick Marks */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-slate-700 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-blue-600" />
                  <span>Design Export File Schema — Tick Marks on Each Column ({selectedColumns.length}/10 Included):</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColumns(SCHEMA_COLUMNS.map(c => c.id))}
                    className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:bg-white border border-slate-200 transition-colors cursor-pointer"
                  >
                    Reset (All 10)
                  </button>
                </div>
              </div>

              {/* Tick Mark on Each Column based on designing the export file */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {SCHEMA_COLUMNS.map((col, idx) => {
                  const isChecked = selectedColumns.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => toggleColumn(col.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100 ring-1 ring-emerald-400/30'
                          : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-600 opacity-60'
                      }`}
                      title={isChecked ? `Column "${col.label}" is ticked (click to untick)` : `Column "${col.label}" is unticked (click to tick)`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>{idx + 1}. {col.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CSS SELECTOR 2: View Mode & Filter Controls with Adjusted View of Values */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* File / Tab View Switcher */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setSchemaViewMode('table')}
                    className={`px-3 py-1 font-medium rounded transition-colors flex items-center gap-1.5 ${
                      schemaViewMode === 'table'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Table Grid View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchemaViewMode('raw_csv')}
                    className={`px-3 py-1 font-medium rounded transition-colors flex items-center gap-1.5 ${
                      schemaViewMode === 'raw_csv'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Raw Comma CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchemaViewMode('raw_txt')}
                    className={`px-3 py-1 font-medium rounded transition-colors flex items-center gap-1.5 ${
                      schemaViewMode === 'raw_txt'
                        ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Text Schema (.txt)</span>
                  </button>
                </div>

                {/* Adjusted View of the Values Controls */}
                <div className="flex items-center gap-1 p-1 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs">
                  <span className="text-[11px] font-bold text-emerald-950 px-1.5 select-none flex items-center gap-1">
                    <span>Value Display:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setValueViewMode('scaled')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      valueViewMode === 'scaled'
                        ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                        : 'text-emerald-900 hover:bg-emerald-100'
                    }`}
                    title="Scaled Engineering value with Units (e.g. 25.4 °C, 1500 RPM)"
                  >
                    Scaled + Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setValueViewMode('raw')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      valueViewMode === 'raw'
                        ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                        : 'text-emerald-900 hover:bg-emerald-100'
                    }`}
                    title="Raw unscaled memory integer (e.g. 254)"
                  >
                    Raw Int
                  </button>
                  <button
                    type="button"
                    onClick={() => setValueViewMode('hex')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      valueViewMode === 'hex'
                        ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                        : 'text-emerald-900 hover:bg-emerald-100'
                    }`}
                    title="16-bit / 32-bit Hex Word (e.g. 0x00FE)"
                  >
                    Hex Word
                  </button>
                  <button
                    type="button"
                    onClick={() => setValueViewMode('standard')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      valueViewMode === 'standard'
                        ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                        : 'text-emerald-900 hover:bg-emerald-100'
                    }`}
                    title="Dual Comprehensive view (Scaled + Raw Hex together)"
                  >
                    Dual View
                  </button>
                </div>
              </div>

              {schemaViewMode === 'table' && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={schemaSearchQuery}
                    onChange={e => setSchemaSearchQuery(e.target.value)}
                    placeholder="Filter parameter, VP, screen..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* CSS SELECTOR 3: Clean Interactive Table with Tick Marks on Columns and Adjusted Value View */}
            {schemaViewMode === 'table' && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200 font-semibold">
                      <tr>
                        {selectedColumns.includes('serialNumber') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>#</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('screen') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Screen</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('vp') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>VP</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('parameterName') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Parameter Name</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('unit') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Unit</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('scale') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Scale</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('dataType') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Data Type</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('value') && (
                          <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-50/50">
                            <span className="inline-flex items-center gap-1 text-emerald-900 font-bold">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Value ({valueViewMode})</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('readWrite') && (
                          <th className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Read/Write</span>
                            </span>
                          </th>
                        )}
                        {selectedColumns.includes('hexValue') && (
                          <th className="py-2.5 px-3 whitespace-nowrap text-right">
                            <span className="inline-flex items-center gap-1 text-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                              <span>Hex Value</span>
                            </span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSchemaRows.map(row => (
                        <tr key={row.serialNumber} className="hover:bg-blue-50/40 transition-colors">
                          {selectedColumns.includes('serialNumber') && (
                            <td className="py-2 px-3 font-mono text-slate-500 font-medium">
                              {row.serialNumber}
                            </td>
                          )}
                          {selectedColumns.includes('screen') && (
                            <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={row.screen}>
                              <span className="font-medium text-slate-900">{row.screen}</span>
                            </td>
                          )}
                          {selectedColumns.includes('vp') && (
                            <td className="py-2 px-3">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                                {row.vp}
                              </span>
                            </td>
                          )}
                          {selectedColumns.includes('parameterName') && (
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {row.parameterName}
                            </td>
                          )}
                          {selectedColumns.includes('unit') && (
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {row.unit || <span className="text-slate-300">-</span>}
                            </td>
                          )}
                          {selectedColumns.includes('scale') && (
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {row.scale}
                            </td>
                          )}
                          {selectedColumns.includes('dataType') && (
                            <td className="py-2 px-3">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {row.dataType}
                              </span>
                            </td>
                          )}
                          {selectedColumns.includes('value') && (
                            <td className="py-2 px-3 bg-emerald-50/20">
                              {/* Adjusted View of the Values */}
                              {valueViewMode === 'scaled' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-mono font-bold text-xs text-emerald-950 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs inline-block w-fit">
                                    {row.scaledValue}
                                  </span>
                                  {Number(row.scale) > 1 && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Raw: {String(row.value)} · Scale: 1/{row.scale}
                                    </span>
                                  )}
                                </div>
                              )}

                              {valueViewMode === 'raw' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded shadow-2xs inline-block w-fit">
                                    {String(row.value)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Unit: {row.unit || 'None'}
                                  </span>
                                </div>
                              )}

                              {valueViewMode === 'hex' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-mono font-bold text-xs text-blue-900 bg-blue-100/80 border border-blue-300 px-2 py-0.5 rounded shadow-2xs inline-block w-fit">
                                    {row.rawHexWord}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {row.dataType}
                                  </span>
                                </div>
                              )}

                              {valueViewMode === 'standard' && (
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="font-bold text-xs text-emerald-950 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs">
                                    {row.scaledValue}
                                  </span>
                                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                                    {row.rawHexWord}
                                  </span>
                                </div>
                              )}
                            </td>
                          )}
                          {selectedColumns.includes('readWrite') && (
                            <td className="py-2 px-3">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                row.readWrite === 'Read/Write'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : row.readWrite === 'Read Only'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {row.readWrite}
                              </span>
                            </td>
                          )}
                          {selectedColumns.includes('hexValue') && (
                            <td className="py-2 px-3 text-right">
                              <span 
                                onClick={() => handleCopy(row.hexValue, `hex_${row.serialNumber}`)}
                                className="font-mono text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs font-semibold inline-block"
                                title={`Click to copy: ${row.hexValue}`}
                              >
                                {copied === `hex_${row.serialNumber}` ? 'COPIED!' : row.hexValue}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}

                      {filteredSchemaRows.length === 0 && (
                        <tr>
                          <td colSpan={selectedColumns.length || 1} className="py-8 text-center text-xs text-slate-500">
                            No parameters match your search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div>
                    Showing <strong>{filteredSchemaRows.length}</strong> parameters across <strong>{selectedColumns.length}</strong> ticked columns
                  </div>
                  <div className="font-mono text-[11px] flex items-center gap-2">
                    <span>Value Mode: <strong className="text-emerald-700 uppercase">{valueViewMode}</strong></span>
                    <span>·</span>
                    <span>Formats: <strong>.csv</strong>, <strong>.txt</strong>, <strong>.xlsx</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* View Mode 2: Raw Comma CSV */}
            {schemaViewMode === 'raw_csv' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Standard comma-separated file format (.csv) with {selectedColumns.length} active columns</span>
                  <button
                    onClick={() => handleCopy(schemaCsv, 'raw_csv')}
                    className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700 text-xs cursor-pointer"
                  >
                    {copied === 'raw_csv' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy CSV</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-50 text-slate-800 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-300 shadow-inner whitespace-pre">
                  {schemaCsv}
                </pre>
              </div>
            )}

            {/* View Mode 3: Text Schema */}
            {schemaViewMode === 'raw_txt' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Annotated parameter schema text file (.txt) with project header definitions and {selectedColumns.length} active columns</span>
                  <button
                    onClick={() => handleCopy(schemaTxt, 'raw_txt')}
                    className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700 text-xs cursor-pointer"
                  >
                    {copied === 'raw_txt' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Text</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-50 text-slate-800 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-300 shadow-inner whitespace-pre">
                  {schemaTxt}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* 2. Project JSON */}
        {activeExportTab === 'project_json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Complete design file with {project.screens.length} screens and {project.parameters.length} parameters</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(projectJson, 'json')}
                  className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700"
                >
                  {copied === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy JSON</span>
                </button>
                <button
                  onClick={() => handleDownload(projectJson, `${project.name.toLowerCase().replace(/\s+/g, '_')}_dwin.json`, 'application/json')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-medium shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .json</span>
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-50 text-slate-800 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-300 shadow-inner">
              {projectJson}
            </pre>
          </div>
        )}

        {/* 3. C/C++ Header */}
        {activeExportTab === 'c_header' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Embedded C/C++ macro header file for STM32, ESP32, Arduino, or NXP MCU firmware</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(cHeaderCode, 'c')}
                  className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700"
                >
                  {copied === 'c' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Header</span>
                </button>
                <button
                  onClick={() => handleDownload(cHeaderCode, 'dwin_vp_defs.h', 'text/x-c')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-medium shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download dwin_vp_defs.h</span>
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-50 text-slate-800 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-300 shadow-inner">
              {cHeaderCode}
            </pre>
          </div>
        )}

        {/* 4. Python Driver */}
        {activeExportTab === 'python' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Python driver script with packet builders and dictionaries for serial UART bench testing</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(pythonCode, 'py')}
                  className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700"
                >
                  {copied === 'py' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Python</span>
                </button>
                <button
                  onClick={() => handleDownload(pythonCode, 'dwin_protocol.py', 'text/x-python')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-medium shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download dwin_protocol.py</span>
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-50 text-slate-800 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-300 shadow-inner">
              {pythonCode}
            </pre>
          </div>
        )}

        {/* 5. Legacy CSV */}
        {activeExportTab === 'csv' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Comma-separated table ready for Excel, Google Sheets, or DGUS design documentation</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(legacyCsvData, 'csv')}
                  className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700"
                >
                  {copied === 'csv' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy CSV</span>
                </button>
                <button
                  onClick={() => handleDownload(legacyCsvData, `${project.name.toLowerCase().replace(/\s+/g, '_')}_parameters.csv`, 'text/csv')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-medium shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .csv</span>
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-50 text-slate-800 rounded-lg font-mono text-xs max-h-96 overflow-y-auto border border-slate-300 whitespace-pre-wrap shadow-inner">
              {legacyCsvData}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
