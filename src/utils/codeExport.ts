/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DwinProject, Parameter } from '../types/dwin';
import { formatVpHex, generateDwinFrame } from './hexEngine';
import * as XLSX from 'xlsx';

/**
 * Generates an embedded C/C++ header file with VP defines and struct mappings
 */
export function generateCHeader(project: DwinProject): string {
  const dateStr = new Date().toISOString();
  
  const paramDefines = project.parameters
    .map(p => {
      const hex = formatVpHex(p.vpAddress);
      const comment = `// ${p.name} (${p.dataType}, ${p.unit || 'unitless'}) - Scale: 1/${p.scale}`;
      return `#define VP_${p.identifier.padEnd(28)} ${hex}  ${comment}`;
    })
    .join('\n');

  const screenDefines = project.screens
    .map(s => {
      const idSafe = s.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      return `#define SCREEN_${idSafe.padEnd(24)} ${s.screenNumber} // 0x${s.screenNumber.toString(16).padStart(4, '0').toUpperCase()} - ${s.group}`;
    })
    .join('\n');

  return `/**
 * ============================================================================
 * DWIN DGUS HMI - Variable Pointer & Screen Definitions
 * Project: ${project.name} (v${project.version})
 * Target Hardware: ${project.dwinModel}
 * Resolution: ${project.resolution}
 * Generated: ${dateStr}
 * ============================================================================
 */

#ifndef DWIN_VP_DEFS_H_
#define DWIN_VP_DEFS_H_

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Standard DGUS II Header Bytes */
#define DWIN_FRAME_HEADER_H       0x5A
#define DWIN_FRAME_HEADER_L       0xA5

/* DGUS Commands */
#define DWIN_CMD_SYS_WRITE        0x80
#define DWIN_CMD_SYS_READ         0x81
#define DWIN_CMD_VAR_WRITE        0x82
#define DWIN_CMD_VAR_READ         0x83
#define DWIN_CMD_CURVE_WRITE      0x84

/* System Register VP Addresses */
#define DWIN_SYS_VP_PIC_ID        0x0084 /* Page Switch Register (write 5A 01 00 xx) */
#define DWIN_SYS_VP_RTC           0x0010 /* RTC Date/Time (7 bytes) */
#define DWIN_SYS_VP_BRIGHTNESS    0x0082 /* Backlight Brightness */
#define DWIN_SYS_VP_BUZZER        0x00A0 /* Buzzer Beep Control */

/* ==========================================
 * SCREEN NUMBER REGISTRY
 * ========================================== */
${screenDefines}

/* ==========================================
 * PARAMETER VARIABLE POINTER (VP) REGISTRY
 * ========================================== */
${paramDefines}

/* ==========================================
 * APPLICATION TELEMETRY STRUCT LAYOUT
 * ========================================== */
typedef struct {
${project.parameters
  .map(p => {
    let cType = 'uint16_t';
    if (p.dataType === 'INT16') cType = 'int16_t';
    else if (p.dataType === 'UINT32') cType = 'uint32_t';
    else if (p.dataType === 'INT32') cType = 'int32_t';
    else if (p.dataType === 'FLOAT32') cType = 'float';
    else if (p.dataType === 'STRING') cType = `char[${p.words * 2}]`;
    return `    ${cType.padEnd(12)} ${p.identifier.toLowerCase()}; /* VP: ${formatVpHex(p.vpAddress)}, Unit: ${p.unit} */`;
  })
  .join('\n')}
} dwin_telemetry_t;

#ifdef __cplusplus
}
#endif

#endif /* DWIN_VP_DEFS_H_ */
`;
}

/**
 * Generates a Python communication module for DWIN serial testing
 */
export function generatePythonDriver(project: DwinProject): string {
  return `"""
DWIN DGUS II Protocol Driver & VP Dictionary
Project: ${project.name}
Model: ${project.dwinModel}
"""

import struct
from typing import Union, List, Tuple

HEADER = bytes([0x5A, 0xA5])

# Screen IDs
SCREENS = {
${project.screens.map(s => `    "${s.name.replace(/[^a-zA-Z0-9_]/g, '_')}": ${s.screenNumber},`).join('\n')}
}

# Parameter VP Registry
PARAMETERS = {
${project.parameters
  .map(
    p =>
      `    "${p.identifier}": {"name": "${p.name}", "vp": ${formatVpHex(p.vpAddress)}, "type": "${p.dataType}", "words": ${p.words}, "scale": ${p.scale}, "unit": "${p.unit}"},`
  )
  .join('\n')}
}


def build_write_vp_frame(vp_address: int, value: Union[int, float], data_type: str = "UINT16") -> bytes:
    """Encodes a 0x82 variable memory write packet."""
    if data_type == "UINT16":
        payload = struct.pack(">H", int(value))
    elif data_type == "INT16":
        payload = struct.pack(">h", int(value))
    elif data_type == "UINT32":
        payload = struct.pack(">I", int(value))
    elif data_type == "INT32":
        payload = struct.pack(">i", int(value))
    elif data_type == "FLOAT32":
        payload = struct.pack(">f", float(value))
    else:
        payload = struct.pack(">H", int(value))

    # Length byte = Command (1) + VP (2) + payload length
    cmd = 0x82
    vp_high = (vp_address >> 8) & 0xFF
    vp_low = vp_address & 0xFF
    length = 1 + 2 + len(payload)

    return HEADER + bytes([length, cmd, vp_high, vp_low]) + payload


def build_page_switch_frame(screen_id: int) -> bytes:
    """Sends page jump command to DWIN system VP 0x0084."""
    # 5A A5 07 82 00 84 5A 01 [Page_High] [Page_Low]
    payload = bytes([0x5A, 0x01, (screen_id >> 8) & 0xFF, screen_id & 0xFF])
    return HEADER + bytes([0x07, 0x82, 0x00, 0x84]) + payload


def decode_response(frame: bytes) -> dict:
    """Decodes DWIN response with length checking."""
    if len(frame) < 3 or frame[:2] != HEADER:
        raise ValueError("Invalid DWIN header")
    
    declared_len = frame[2]
    actual_len = len(frame) - 3
    if declared_len != actual_len:
        print(f"Warning: Frame length mismatch! Declared {declared_len}, got {actual_len}")

    cmd = frame[3]
    vp = (frame[4] << 8) | frame[5]
    data = frame[6:]
    return {"command": hex(cmd), "vp": hex(vp), "data": data.hex().upper()}
`;
}

/**
 * Generates CSV parameter dictionary for DGUS import / documentation
 */
export function generateCsvExport(project: DwinProject): string {
  const headers = [
    'Parameter Name',
    'Identifier',
    'VP Address (Hex)',
    'VP Address (Dec)',
    'Data Type',
    'Word Count',
    'Scale Factor',
    'Engineering Unit',
    'Min',
    'Max',
    'Default',
    'VP Role',
    'Group',
    'Description'
  ];

  const rows = project.parameters.map(p => [
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.identifier}"`,
    `"${formatVpHex(p.vpAddress)}"`,
    p.vpAddress,
    p.dataType,
    p.words,
    p.scale,
    `"${p.unit}"`,
    p.min,
    p.max,
    p.defaultValue,
    p.role,
    `"${p.group}"`,
    `"${p.description.replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export interface SchemaColumnDef {
  id: string;
  key: keyof ParameterSchemaRow;
  label: string;
  defaultWidth: number;
}

export const SCHEMA_COLUMNS: SchemaColumnDef[] = [
  { id: 'serialNumber', key: 'serialNumber', label: 'Serial Number', defaultWidth: 14 },
  { id: 'screen', key: 'screen', label: 'Screen', defaultWidth: 28 },
  { id: 'vp', key: 'vp', label: 'VP', defaultWidth: 12 },
  { id: 'parameterName', key: 'parameterName', label: 'Parameter Name', defaultWidth: 26 },
  { id: 'unit', key: 'unit', label: 'Unit', defaultWidth: 10 },
  { id: 'scale', key: 'scale', label: 'Scale', defaultWidth: 10 },
  { id: 'dataType', key: 'dataType', label: 'Data Type', defaultWidth: 14 },
  { id: 'value', key: 'value', label: 'Value', defaultWidth: 14 },
  { id: 'readWrite', key: 'readWrite', label: 'Read/Write', defaultWidth: 14 },
  { id: 'hexValue', key: 'hexValue', label: 'Hex Value', defaultWidth: 32 }
];

export interface ParameterSchemaRow {
  serialNumber: number;
  screen: string;
  vp: string;
  parameterName: string;
  unit: string;
  scale: number | string;
  dataType: string;
  value: number | string;
  scaledValue: string;
  rawHexWord: string;
  readWrite: string;
  hexValue: string;
}

export function formatReadWrite(role: string): string {
  switch (role) {
    case 'write_only':
      return 'Write Only';
    case 'read_only':
      return 'Read Only';
    case 'read_write':
      return 'Read/Write';
    case 'touch_return':
      return 'Read/Write (Touch Return)';
    case 'system_reg':
      return 'Read/Write (System Reg)';
    default:
      return 'Read/Write';
  }
}

export function formatParamScaledValue(val: number | string, scale: number, unit?: string): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) {
    return `${val}${unit ? ` ${unit}` : ''}`;
  }

  const s = scale || 1;
  const scaled = s > 1 ? (num / s) : num;
  const decimals = s === 10 ? 1 : s === 100 ? 2 : s === 1000 ? 3 : s === 2 ? 1 : s === 5 ? 1 : 0;
  const formatted = decimals > 0 ? scaled.toFixed(decimals) : String(scaled);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatParamHexWord(val: number | string, dataType: string): string {
  const num = typeof val === 'number' ? Math.round(val) : parseInt(String(val), 10);
  if (isNaN(num)) return '0x0000';
  const is32Bit = dataType === 'UINT32' || dataType === 'INT32' || dataType === 'FLOAT32';
  if (is32Bit) {
    return '0x' + (num >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
  return '0x' + (num & 0xffff).toString(16).padStart(4, '0').toUpperCase();
}

export function getParameterSchemaRows(project: DwinProject): ParameterSchemaRow[] {
  return project.parameters.map((p, index) => {
    // Find screens associated with this VP
    const matchingScreens = project.screens.filter(s =>
      s.vpBindings.some(b => b.vpAddress === p.vpAddress)
    );

    let screenLabel = 'Global / Unassigned';
    if (matchingScreens.length > 0) {
      screenLabel = matchingScreens
        .map(s => `Screen #${s.screenNumber} (${s.name})`)
        .join('; ');
    }

    const vpHex = formatVpHex(p.vpAddress);

    let hexValue = '';
    try {
      const frame = generateDwinFrame({
        header: project.headerHex || '5A A5',
        command: 0x82,
        vpAddress: p.vpAddress,
        value: p.defaultValue,
        dataType: p.dataType,
        wordCount: p.words
      });
      hexValue = frame.rawHex;
    } catch {
      hexValue = `${project.headerHex || '5A A5'} 05 82 ${(p.vpAddress >> 8).toString(16).padStart(2, '0').toUpperCase()} ${(p.vpAddress & 0xff).toString(16).padStart(2, '0').toUpperCase()} 00 00`;
    }

    const defVal = p.defaultValue ?? 0;
    const scaledVal = formatParamScaledValue(defVal, p.scale, p.unit);
    const hexWord = formatParamHexWord(defVal, p.dataType);

    return {
      serialNumber: index + 1,
      screen: screenLabel,
      vp: vpHex,
      parameterName: p.name,
      unit: p.unit || '',
      scale: p.scale ?? 1,
      dataType: p.dataType,
      value: defVal,
      scaledValue: scaledVal,
      rawHexWord: hexWord,
      readWrite: formatReadWrite(p.role),
      hexValue: hexValue
    };
  });
}

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateParameterSchemaCsv(
  project: DwinProject,
  selectedColumnIds?: string[],
  valueFormat: 'standard' | 'scaled' | 'raw' | 'hex' = 'standard'
): string {
  const activeCols = SCHEMA_COLUMNS.filter(c => !selectedColumnIds || selectedColumnIds.includes(c.id));
  const headers = activeCols.map(c => c.label);

  const rows = getParameterSchemaRows(project).map(r => {
    return activeCols.map(c => {
      let val: any = r[c.key];
      if (c.id === 'value') {
        if (valueFormat === 'scaled') val = r.scaledValue;
        else if (valueFormat === 'raw') val = r.value;
        else if (valueFormat === 'hex') val = r.rawHexWord;
      }
      return escapeCsvField(val);
    });
  });

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function generateParameterSchemaTxt(
  project: DwinProject,
  selectedColumnIds?: string[],
  valueFormat: 'standard' | 'scaled' | 'raw' | 'hex' = 'standard'
): string {
  const activeCols = SCHEMA_COLUMNS.filter(c => !selectedColumnIds || selectedColumnIds.includes(c.id));
  const csvContent = generateParameterSchemaCsv(project, selectedColumnIds, valueFormat);
  return `# ==============================================================================
# DWIN DGUS HMI - Parameter Registry Schema File
# Project: ${project.name} (${project.dwinModel})
# Resolution: ${project.resolution} | Protocol Header: ${project.headerHex || '5A A5'}
# Total Parameters: ${project.parameters.length} | Export Date: ${new Date().toISOString()}
# Format: Comma-Separated Values (.txt schema)
# Value Format View: ${valueFormat.toUpperCase()}
# Active Columns (${activeCols.length}): ${activeCols.map(c => c.label).join(', ')}
# ==============================================================================
${csvContent}`;
}

export function generateParameterSchemaXlsxBlob(
  project: DwinProject,
  selectedColumnIds?: string[],
  valueFormat: 'standard' | 'scaled' | 'raw' | 'hex' = 'standard'
): Blob {
  const activeCols = SCHEMA_COLUMNS.filter(c => !selectedColumnIds || selectedColumnIds.includes(c.id));
  const rows = getParameterSchemaRows(project).map(r => {
    const obj: Record<string, any> = {};
    activeCols.forEach(c => {
      let val: any = r[c.key];
      if (c.id === 'value') {
        if (valueFormat === 'scaled') val = r.scaledValue;
        else if (valueFormat === 'raw') val = r.value;
        else if (valueFormat === 'hex') val = r.rawHexWord;
      }
      obj[c.label] = val;
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = activeCols.map(c => ({ wch: c.defaultWidth }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Parameter Registry Schema');
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function parseParameterSchemaCsv(csvText: string): {
  parameters: Parameter[];
  errors: string[];
} {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  if (lines.length < 2) {
    return { parameters: [], errors: ['File contains no data rows.'] };
  }

  const parseCsvLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headerRow = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const vpIdx = headerRow.findIndex(h => h.includes('vp'));
  const nameIdx = headerRow.findIndex(h => h.includes('name'));
  const unitIdx = headerRow.findIndex(h => h.includes('unit'));
  const scaleIdx = headerRow.findIndex(h => h.includes('scale'));
  const typeIdx = headerRow.findIndex(h => h.includes('type'));
  const valIdx = headerRow.findIndex(h => h.includes('val'));
  const rwIdx = headerRow.findIndex(h => h.includes('read') || h.includes('rw') || h.includes('write'));

  const parameters: Parameter[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;

    const vpRaw = vpIdx >= 0 ? cols[vpIdx] : cols[2];
    let vpAddress = 0;
    if (vpRaw.toLowerCase().startsWith('0x')) {
      vpAddress = parseInt(vpRaw.substring(2), 16);
    } else if (/^[0-9a-fA-F]{4}$/.test(vpRaw)) {
      vpAddress = parseInt(vpRaw, 16);
    } else {
      vpAddress = parseInt(vpRaw, 10);
    }

    if (isNaN(vpAddress) || vpAddress <= 0) {
      continue;
    }

    const name = (nameIdx >= 0 && cols[nameIdx]) ? cols[nameIdx] : `VP_${vpAddress.toString(16).toUpperCase()}`;
    const unit = (unitIdx >= 0 && cols[unitIdx]) ? cols[unitIdx] : '';
    const scale = (scaleIdx >= 0 && !isNaN(Number(cols[scaleIdx]))) ? Number(cols[scaleIdx]) : 1;
    const rawType = (typeIdx >= 0 && cols[typeIdx]) ? cols[typeIdx].toUpperCase() : 'UINT16';
    const dataType: any = ['UINT8', 'INT8', 'UINT16', 'INT16', 'UINT32', 'INT32', 'FLOAT32', 'STRING', 'BITFIELD'].includes(rawType)
      ? rawType
      : 'UINT16';
    const defaultValue = (valIdx >= 0 && cols[valIdx] !== undefined) ? cols[valIdx] : 0;
    const rwRaw = (rwIdx >= 0 && cols[rwIdx]) ? cols[rwIdx].toLowerCase() : 'read/write';
    let role: any = 'read_write';
    if (rwRaw.includes('write only') || rwRaw === 'w') role = 'write_only';
    else if (rwRaw.includes('read only') || rwRaw === 'r') role = 'read_only';

    parameters.push({
      id: `param_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      identifier: name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/^_+|_+$/g, ''),
      vpAddress,
      dataType,
      words: dataType === 'UINT32' || dataType === 'INT32' || dataType === 'FLOAT32' ? 2 : 1,
      unit,
      scale,
      min: 0,
      max: 65535,
      defaultValue: isNaN(Number(defaultValue)) ? defaultValue : Number(defaultValue),
      role,
      group: 'Imported',
      description: `Imported parameter for VP 0x${vpAddress.toString(16).padStart(4, '0').toUpperCase()}`,
      updatedAt: new Date().toISOString()
    });
  }

  return { parameters, errors };
}
