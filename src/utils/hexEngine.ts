/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DecodedByte, DecodedFrame, HexCompareResult, Parameter, ProtocolMode } from '../types/dwin';

/**
 * Normalizes any hex string into clean uppercase space-separated pairs
 * Supports: "5AA50782", "5A A5 07", "0x5A, 0xA5", "5a,a5,7,82"
 */
export function normalizeHexString(input: string): string {
  const clean = input
    .replace(/0x/gi, '')
    .replace(/[^0-9a-fA-F]/g, ' ')
    .trim();

  const tokens = clean.split(/\s+/).filter(Boolean);
  const bytes: string[] = [];

  for (const token of tokens) {
    if (token.length === 1) {
      bytes.push('0' + token.toUpperCase());
    } else if (token.length === 2) {
      bytes.push(token.toUpperCase());
    } else if (token.length > 2) {
      // Split into 2-char chunks
      for (let i = 0; i < token.length; i += 2) {
        const sub = token.substring(i, i + 2);
        bytes.push(sub.length === 1 ? '0' + sub.toUpperCase() : sub.toUpperCase());
      }
    }
  }

  return bytes.join(' ');
}

/**
 * Parses normalized hex string to byte array
 */
export function hexStringToBytes(hexStr: string): number[] {
  const norm = normalizeHexString(hexStr);
  if (!norm) return [];
  return norm.split(' ').map(h => parseInt(h, 16));
}

/**
 * Converts byte array to spaced hex string
 */
export function bytesToHexString(bytes: number[]): string {
  return bytes.map(b => (b & 0xff).toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/**
 * Formats a 16-bit address as hex (e.g. 0x1000)
 */
export function formatVpHex(vp: number): string {
  return '0x' + (vp & 0xffff).toString(16).padStart(4, '0').toUpperCase();
}

/**
 * Generates a DWIN DGUS frame
 */
export function generateDwinFrame(options: {
  header?: string; // default "5A A5"
  command: number; // 0x82 (Write), 0x83 (Read), 0x80 (Write Sys), etc.
  vpAddress: number; // 16-bit VP
  dataType?: string;
  value?: number | string;
  wordCount?: number; // for read request or read response with length byte
  protocolMode?: ProtocolMode;
}): {
  rawHex: string;
  bytes: number[];
  dissection: DecodedByte[];
  explanation: string;
} {
  const headerBytes = hexStringToBytes(options.header || '5A A5');
  const cmd = options.command & 0xff;
  const vpHdr = (options.vpAddress >> 8) & 0xff;
  const vpLdr = options.vpAddress & 0xff;

  const payloadBytes: number[] = [cmd, vpHdr, vpLdr];
  const dissection: DecodedByte[] = [];

  // Header bytes
  headerBytes.forEach((b, idx) => {
    dissection.push({
      index: dissection.length,
      byte: b,
      hex: (b & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      role: 'header',
      description: `Frame Header Byte ${idx + 1}`
    });
  });

  // Decide payload based on command
  if (cmd === 0x83) {
    // Read command or read response
    if (options.protocolMode === 'standard_dgus2') {
      // If generating a Read Request: cmd (0x83) + VP (2 bytes) + wordCount (1 byte)
      // e.g. 5A A5 04 83 10 00 02 (Read 2 words from 0x1000)
      const count = Math.max(1, options.wordCount || 1);
      payloadBytes.push(count & 0xff);
    } else {
      const count = Math.max(1, options.wordCount || 1);
      payloadBytes.push(count & 0xff);
    }
  } else if (cmd === 0x82) {
    // Write Variable Memory
    const dataBytes = encodeValueToBytes(options.value ?? 0, options.dataType || 'UINT16', options.wordCount || 1);
    payloadBytes.push(...dataBytes);
  } else if (cmd === 0x80) {
    // Write System Register
    const dataBytes = encodeValueToBytes(options.value ?? 0, options.dataType || 'UINT16', options.wordCount || 1);
    payloadBytes.push(...dataBytes);
  } else if (cmd === 0x81) {
    // Read System Register
    payloadBytes.push((options.wordCount || 1) & 0xff);
  }

  // Length byte = payloadBytes.length
  const lenByte = payloadBytes.length & 0xff;

  // Add length to dissection
  dissection.push({
    index: dissection.length,
    byte: lenByte,
    hex: lenByte.toString(16).padStart(2, '0').toUpperCase(),
    role: 'length',
    description: `Payload Length (${lenByte} bytes follow)`
  });

  // Add command
  dissection.push({
    index: dissection.length,
    byte: cmd,
    hex: cmd.toString(16).padStart(2, '0').toUpperCase(),
    role: 'command',
    description: getCommandDescription(cmd)
  });

  // Add VP bytes
  dissection.push({
    index: dissection.length,
    byte: vpHdr,
    hex: vpHdr.toString(16).padStart(2, '0').toUpperCase(),
    role: 'vp',
    description: `VP High Byte (${formatVpHex(options.vpAddress)})`
  });
  dissection.push({
    index: dissection.length,
    byte: vpLdr,
    hex: vpLdr.toString(16).padStart(2, '0').toUpperCase(),
    role: 'vp',
    description: `VP Low Byte (${formatVpHex(options.vpAddress)})`
  });

  // Add remaining payload bytes
  const remainingData = payloadBytes.slice(3);
  remainingData.forEach((b, idx) => {
    dissection.push({
      index: dissection.length,
      byte: b,
      hex: b.toString(16).padStart(2, '0').toUpperCase(),
      role: cmd === 0x83 && idx === 0 ? 'word_count' : 'data',
      description: cmd === 0x83 && idx === 0 ? `Word Count (${b} words)` : `Data Byte ${idx + 1}`
    });
  });

  const fullBytes = [...headerBytes, lenByte, ...payloadBytes];
  const rawHex = bytesToHexString(fullBytes);

  let explanation = '';
  if (cmd === 0x82) {
    explanation = `Write VP ${formatVpHex(options.vpAddress)} with value ${options.value} (${options.dataType || 'UINT16'}), length 0x${lenByte.toString(16).padStart(2, '0').toUpperCase()} (${lenByte} bytes payload).`;
  } else if (cmd === 0x83) {
    explanation = `Read ${options.wordCount || 1} word(s) from VP ${formatVpHex(options.vpAddress)}.`;
  } else {
    explanation = `Command 0x${cmd.toString(16).toUpperCase()} to VP ${formatVpHex(options.vpAddress)}.`;
  }

  return {
    rawHex,
    bytes: fullBytes,
    dissection,
    explanation
  };
}

/**
 * Parses numeric or hex string value safely
 */
export function parseNumericValue(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (/^0x[0-9a-fA-F]+$/i.test(str)) {
    return parseInt(str, 16) || 0;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Encodes a numeric/string value to raw bytes according to DWIN big-endian DGUS conventions
 */
export function encodeValueToBytes(value: number | string | undefined | null, dataType: string, wordCount: number = 1): number[] {
  const bytes: number[] = [];
  const dt = (dataType || 'UINT16').toUpperCase();

  if (dt === 'STRING') {
    const str = String(value ?? '');
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) & 0xff);
    }
    const targetLength = Math.max(2, (wordCount || 1) * 2);
    while (bytes.length < targetLength) {
      bytes.push(0x00);
    }
    return bytes.slice(0, targetLength);
  }

  const num = parseNumericValue(value);

  if (dt === 'UINT8' || dt === 'BYTE' || dt.includes('8') || dt.includes('2 DIGIT') || dt.includes('2-DIGIT')) {
    const v = Math.max(0, Math.min(255, Math.round(num)));
    bytes.push(v & 0xff);
    return bytes;
  }

  if (dt === 'INT8') {
    const v = Math.max(-128, Math.min(127, Math.round(num)));
    const unsigned = (v < 0 ? (0x100 + v) : v) & 0xff;
    bytes.push(unsigned & 0xff);
    return bytes;
  }

  switch (dt) {
    case 'UINT16': {
      const v = Math.max(0, Math.min(65535, Math.round(num)));
      bytes.push((v >> 8) & 0xff, v & 0xff);
      break;
    }
    case 'INT16': {
      const v = Math.max(-32768, Math.min(32767, Math.round(num)));
      const unsigned = (v < 0 ? (0x10000 + v) : v) & 0xffff;
      bytes.push((unsigned >> 8) & 0xff, unsigned & 0xff);
      break;
    }
    case 'UINT32': {
      const v = Math.max(0, Math.min(4294967295, Math.round(num)));
      bytes.push(
        (v >>> 24) & 0xff,
        (v >>> 16) & 0xff,
        (v >>> 8) & 0xff,
        v & 0xff
      );
      break;
    }
    case 'INT32': {
      const v = Math.max(-2147483648, Math.min(2147483647, Math.round(num)));
      const unsigned = (v >>> 0);
      bytes.push(
        (unsigned >>> 24) & 0xff,
        (unsigned >>> 16) & 0xff,
        (unsigned >>> 8) & 0xff,
        unsigned & 0xff
      );
      break;
    }
    case 'FLOAT32': {
      const buf = new ArrayBuffer(4);
      const view = new DataView(buf);
      view.setFloat32(0, num, false); // Big-endian
      for (let i = 0; i < 4; i++) {
        bytes.push(view.getUint8(i));
      }
      break;
    }
    case 'BITFIELD': {
      const v = Math.max(0, Math.min(65535, Math.round(num)));
      bytes.push((v >> 8) & 0xff, v & 0xff);
      break;
    }
    default: {
      if (wordCount >= 2) {
        const v = Math.max(0, Math.min(4294967295, Math.round(num)));
        bytes.push(
          (v >>> 24) & 0xff,
          (v >>> 16) & 0xff,
          (v >>> 8) & 0xff,
          v & 0xff
        );
      } else {
        const v = Math.max(0, Math.min(65535, Math.round(num)));
        bytes.push((v >> 8) & 0xff, v & 0xff);
      }
      break;
    }
  }

  return bytes;
}

/**
 * Returns human label for DGUS command
 */
export function getCommandDescription(cmd: number): string {
  switch (cmd) {
    case 0x80: return '0x80: Write DGUS System Register';
    case 0x81: return '0x81: Read DGUS System Register';
    case 0x82: return '0x82: Write to VP (RAM / Variable memory)';
    case 0x83: return '0x83: Read from VP (RAM / Variable memory)';
    case 0x84: return '0x84: Curve Buffer Write / Touch Return';
    default: return `0x${cmd.toString(16).toUpperCase()}: Custom / Vendor Command`;
  }
}

/**
 * Decodes and inspects any arbitrary DWIN HEX frame with comprehensive length validation
 * and protocol anomaly detection (such as 0x06 vs 7 bytes in read responses).
 */
export function decodeDwinFrame(rawInput: string, parameters: Parameter[] = []): DecodedFrame {
  const bytes = hexStringToBytes(rawInput);
  const normalized = bytesToHexString(bytes);

  const dissectedBytes: DecodedByte[] = [];
  const diagnostics = {
    status: 'success' as 'success' | 'warning' | 'error',
    summary: '',
    details: [] as string[],
    isProtocolAnomaly: false,
    suggestedFix: '',
    suggestedLength: 0
  };

  if (bytes.length < 3) {
    return {
      rawHex: normalized,
      bytes,
      isValid: false,
      headerValid: false,
      lengthByte: 0,
      actualPayloadLength: 0,
      lengthMatches: false,
      command: 0,
      commandName: 'Unknown',
      dataBytes: [],
      diagnostics: {
        status: 'error',
        summary: 'Frame too short',
        details: [`Encountered ${bytes.length} bytes. Minimum DWIN frame requires at least 4 bytes (Header + Length + Command).`]
      },
      dissectedBytes: bytes.map((b, idx) => ({
        index: idx,
        byte: b,
        hex: b.toString(16).padStart(2, '0').toUpperCase(),
        role: 'trailing',
        description: `Byte ${idx + 1}`
      }))
    };
  }

  // Check header (usually 5A A5)
  const is5AA5 = bytes[0] === 0x5a && bytes[1] === 0xa5;
  dissectedBytes.push({
    index: 0,
    byte: bytes[0],
    hex: bytes[0].toString(16).padStart(2, '0').toUpperCase(),
    role: 'header',
    description: is5AA5 ? 'Frame Header 1 (0x5A standard)' : `Custom Header Byte 1 (0x${bytes[0].toString(16).toUpperCase()})`
  });
  dissectedBytes.push({
    index: 1,
    byte: bytes[1],
    hex: bytes[1].toString(16).padStart(2, '0').toUpperCase(),
    role: 'header',
    description: is5AA5 ? 'Frame Header 2 (0xA5 standard)' : `Custom Header Byte 2 (0x${bytes[1].toString(16).toUpperCase()})`
  });

  const lengthByte = bytes[2];
  const actualPayloadLength = bytes.length - 3;
  const lengthMatches = lengthByte === actualPayloadLength;

  dissectedBytes.push({
    index: 2,
    byte: lengthByte,
    hex: lengthByte.toString(16).padStart(2, '0').toUpperCase(),
    role: 'length',
    description: `Length Byte: declares 0x${lengthByte.toString(16).padStart(2, '0').toUpperCase()} (${lengthByte} bytes payload)`
  });

  let command = 0;
  let commandName = 'Unknown';
  let vpAddress: number | undefined;
  let wordCount: number | undefined;
  const dataBytes: number[] = [];

  if (bytes.length >= 4) {
    command = bytes[3];
    commandName = getCommandDescription(command);
    dissectedBytes.push({
      index: 3,
      byte: command,
      hex: command.toString(16).padStart(2, '0').toUpperCase(),
      role: 'command',
      description: commandName
    });
  }

  if (bytes.length >= 6) {
    vpAddress = (bytes[4] << 8) | bytes[5];
    dissectedBytes.push({
      index: 4,
      byte: bytes[4],
      hex: bytes[4].toString(16).padStart(2, '0').toUpperCase(),
      role: 'vp',
      description: `VP High Byte (${formatVpHex(vpAddress)})`
    });
    dissectedBytes.push({
      index: 5,
      byte: bytes[5],
      hex: bytes[5].toString(16).padStart(2, '0').toUpperCase(),
      role: 'vp',
      description: `VP Low Byte (${formatVpHex(vpAddress)})`
    });
  }

  // Handle remaining bytes based on command
  if (bytes.length > 6) {
    if (command === 0x83) {
      // Could be Read Request (5A A5 04 83 10 00 02)
      // Or Read Response (5A A5 08 83 10 00 02 00 01 86 A0)
      // Or Compact Read Response without word count (5A A5 07 83 10 00 00 01 86 A0)
      // Or the user's specific inconsistent example: 5A A5 06 83 10 00 00 01 86 A0
      const remaining = bytes.slice(6);
      
      // Check if user's read-response anomaly is detected
      // Example: length=06, command=83, but 7 bytes follow (Cmd + 2 VP + 4 data = 7)
      if (lengthByte === 0x06 && actualPayloadLength === 7) {
        diagnostics.isProtocolAnomaly = true;
        diagnostics.status = 'warning';
        diagnostics.suggestedLength = 0x07;
        diagnostics.suggestedFix = `Change length byte from 0x06 to 0x07 (for compact payload) or 0x08 (if standard DGUS II word count byte 0x02 is included).`;
        diagnostics.details.push(
          `Protocol Discrepancy: The length byte is 0x06 (declaring 6 bytes), but 7 bytes follow in the frame.`,
          `If this is a 4-byte read response (e.g. 0x000186A0 = 100,000):`,
          `- Standard DWIN DGUS II read response format includes: 1 byte cmd (0x83) + 2 bytes VP (0x1000) + 1 byte word count (0x02) + 4 bytes data. Total = 8 bytes. Header: 5A A5 08 83 10 00 02 00 01 86 A0`,
          `- Compact T5L response without word count has: 1 byte cmd (0x83) + 2 bytes VP (0x1000) + 4 bytes data. Total = 7 bytes. Header: 5A A5 07 83 10 00 00 01 86 A0`
        );
      }

      // Dissect remaining bytes
      remaining.forEach((b, idx) => {
        dataBytes.push(b);
        dissectedBytes.push({
          index: 6 + idx,
          byte: b,
          hex: b.toString(16).padStart(2, '0').toUpperCase(),
          role: 'data',
          description: `Payload Data Byte ${idx + 1}`
        });
      });
    } else {
      // General data bytes (e.g. 0x82 Write)
      const remaining = bytes.slice(6);
      remaining.forEach((b, idx) => {
        dataBytes.push(b);
        dissectedBytes.push({
          index: 6 + idx,
          byte: b,
          hex: b.toString(16).padStart(2, '0').toUpperCase(),
          role: 'data',
          description: `Data Byte ${idx + 1}`
        });
      });
    }
  }

  // Check matched parameter
  const matchedParameter = vpAddress !== undefined 
    ? parameters.find(p => p.vpAddress === vpAddress)
    : undefined;

  // Interpret payload value
  const interpretedValue: DecodedFrame['interpretedValue'] = {
    rawHex: bytesToHexString(dataBytes)
  };

  if (dataBytes.length === 2) {
    const u16 = (dataBytes[0] << 8) | dataBytes[1];
    const i16 = u16 > 32767 ? u16 - 65536 : u16;
    interpretedValue.asUint16 = u16;
    interpretedValue.asInt16 = i16;
    interpretedValue.formatted = matchedParameter && matchedParameter.scale > 1
      ? (u16 / matchedParameter.scale).toFixed(1) + ' ' + matchedParameter.unit
      : `${u16}${matchedParameter ? ' ' + matchedParameter.unit : ''}`;
  } else if (dataBytes.length === 4) {
    const u32 = ((dataBytes[0] << 24) >>> 0) | (dataBytes[1] << 16) | (dataBytes[2] << 8) | dataBytes[3];
    const i32 = (u32 | 0);
    interpretedValue.asUint32 = u32;
    interpretedValue.asInt32 = i32;

    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    dataBytes.forEach((b, i) => view.setUint8(i, b));
    interpretedValue.asFloat = parseFloat(view.getFloat32(0, false).toFixed(4));

    interpretedValue.formatted = matchedParameter && matchedParameter.scale > 1
      ? (u32 / matchedParameter.scale).toFixed(1) + ' ' + matchedParameter.unit
      : `${u32}${matchedParameter ? ' ' + matchedParameter.unit : ''}`;
  } else if (dataBytes.length > 0) {
    // Attempt ASCII interpretation
    interpretedValue.asAscii = dataBytes.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
    interpretedValue.formatted = `[${dataBytes.length} bytes] "${interpretedValue.asAscii}"`;
  }

  // Diagnostics check
  if (!lengthMatches && !diagnostics.isProtocolAnomaly) {
    diagnostics.status = 'warning';
    diagnostics.summary = `Length mismatch: declares ${lengthByte} bytes, but frame contains ${actualPayloadLength} payload bytes.`;
    diagnostics.details.push(
      `Declared length (byte index 2): 0x${lengthByte.toString(16).padStart(2, '0').toUpperCase()} (${lengthByte} bytes).`,
      `Actual trailing bytes count: ${actualPayloadLength} bytes.`,
      `Valid frame must have length byte equal to the exact count of bytes following it.`
    );
    diagnostics.suggestedLength = actualPayloadLength;
    diagnostics.suggestedFix = `Set length byte to 0x${actualPayloadLength.toString(16).padStart(2, '0').toUpperCase()}`;
  } else if (lengthMatches && !diagnostics.isProtocolAnomaly) {
    diagnostics.status = 'success';
    if (command === 0x82 && vpAddress !== undefined) {
      diagnostics.summary = `Valid Write VP frame to ${formatVpHex(vpAddress)}`;
      if (matchedParameter) {
        diagnostics.details.push(`Matched registered parameter: "${matchedParameter.name}" (${matchedParameter.dataType})`);
      }
    } else if (command === 0x83) {
      diagnostics.summary = `Valid Read frame targeting VP ${vpAddress !== undefined ? formatVpHex(vpAddress) : 'Unknown'}`;
    } else {
      diagnostics.summary = `Valid DWIN frame (${commandName})`;
    }
  }

  return {
    rawHex: normalized,
    bytes,
    isValid: is5AA5 && (lengthMatches || diagnostics.isProtocolAnomaly),
    headerValid: is5AA5,
    lengthByte,
    actualPayloadLength,
    lengthMatches,
    command,
    commandName,
    vpAddress,
    wordCount,
    dataBytes,
    interpretedValue,
    matchedParameter,
    diagnostics,
    dissectedBytes
  };
}

/**
 * Compares Expected vs Actual HEX frames byte-by-byte
 */
export function compareHexFrames(expectedHex: string, actualHex: string): HexCompareResult {
  const expectedBytes = hexStringToBytes(expectedHex);
  const actualBytes = hexStringToBytes(actualHex);

  const maxLen = Math.max(expectedBytes.length, actualBytes.length);
  const diffIndices: number[] = [];
  const detailedAnalysis: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const exp = expectedBytes[i];
    const act = actualBytes[i];
    if (exp !== act) {
      diffIndices.push(i);
    }
  }

  const match = diffIndices.length === 0 && expectedBytes.length === actualBytes.length;
  const lengthMismatch = expectedBytes.length !== actualBytes.length;

  if (match) {
    detailedAnalysis.push('All bytes strictly match (100% frame identity).');
  } else {
    if (lengthMismatch) {
      detailedAnalysis.push(`Frame length difference: Expected ${expectedBytes.length} bytes, received ${actualBytes.length} bytes.`);
    }

    diffIndices.forEach(idx => {
      const expHex = expectedBytes[idx] !== undefined ? '0x' + expectedBytes[idx].toString(16).padStart(2, '0').toUpperCase() : '<missing>';
      const actHex = actualBytes[idx] !== undefined ? '0x' + actualBytes[idx].toString(16).padStart(2, '0').toUpperCase() : '<extra>';
      let fieldRole = 'Payload';
      if (idx === 0 || idx === 1) fieldRole = 'Header Byte';
      else if (idx === 2) fieldRole = 'Length Byte';
      else if (idx === 3) fieldRole = 'Command Byte';
      else if (idx === 4 || idx === 5) fieldRole = 'VP Address Byte';

      detailedAnalysis.push(`Offset [${idx}] (${fieldRole}): Expected ${expHex}, got ${actHex}`);
    });
  }

  return {
    expectedBytes,
    actualBytes,
    match,
    diffIndices,
    lengthMismatch,
    summary: match ? 'Frames match perfectly' : `${diffIndices.length} byte difference(s) detected`,
    detailedAnalysis
  };
}
