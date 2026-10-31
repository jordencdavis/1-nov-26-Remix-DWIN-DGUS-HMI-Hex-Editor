/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DwinDataType = 
  | 'UINT8'
  | 'INT8'
  | 'UINT16' 
  | 'INT16' 
  | 'UINT32' 
  | 'INT32' 
  | 'FLOAT32' 
  | 'STRING' 
  | 'BITFIELD';

export type VpRole = 
  | 'read_write' 
  | 'read_only' 
  | 'write_only' 
  | 'system_reg' 
  | 'touch_return';

export type ScreenVpUsageRole = 
  | 'data_display' 
  | 'touch_input' 
  | 'slider_control' 
  | 'rtc_display' 
  | 'popup_entry' 
  | 'status_icon' 
  | 'trend_curve';

export type NavTrigger = 
  | 'touch_button' 
  | 'timeout' 
  | 'return_prev' 
  | 'alarm_jump' 
  | 'system_trigger';

export interface ScreenVpBinding {
  id: string;
  vpAddress: number; // e.g. 0x1000
  role: ScreenVpUsageRole;
  label: string;
  x?: number; // Screen coordinate (px)
  y?: number;
  width?: number;
  height?: number;
  notes?: string;
}

export interface ScreenNavigation {
  id: string;
  targetScreenNumber: number;
  trigger: NavTrigger;
  buttonLabel?: string;
  triggerVp?: number; // Optional VP associated with touch return
  description?: string;
}

export interface Screen {
  id: string;
  screenNumber: number; // 0 to 65535, usually 0x0000 to 0x0FFF
  name: string;
  group: string; // e.g. "Main UI", "Diagnostics", "Settings", "Alarms"
  resolution: string; // e.g. "800x480", "1024x600"
  bgImageIndex: number; // e.g. 0, 1, 2 (00.bmp)
  bgImageUrl?: string; // HMI background graphic URL or template
  description: string;
  vpBindings: ScreenVpBinding[];
  navigations: ScreenNavigation[];
  updatedAt: string;
}

export interface Parameter {
  id: string;
  name: string; // e.g. "Target_Temperature"
  identifier: string; // e.g. "CMD_TARGET_TEMP"
  vpAddress: number; // 0x1000
  dataType: DwinDataType;
  words: number; // 1 word = 2 bytes, 2 words = 4 bytes
  unit: string; // "°C", "RPM", "%", "bar", etc.
  scale: number; // 1 = 1:1, 10 = 1 decimal place (value 254 -> 25.4)
  min: number;
  max: number;
  defaultValue: number | string;
  role: VpRole;
  group: string; // "Thermal", "Motor", "Alarms", "System"
  description: string;
  updatedAt: string;
}

export type DwinCommandCode = 
  | 0x80 // Write System Register
  | 0x81 // Read System Register
  | 0x82 // Write Variable Memory (VP)
  | 0x83 // Read Variable Memory (VP) / Read Response
  | 0x84; // Curve Buffer Write

export type ProtocolMode = 'standard_dgus2' | 'compact_t5l' | 'relaxed';

export interface DecodedByte {
  index: number;
  hex: string;
  byte: number;
  role: 'header' | 'length' | 'command' | 'vp' | 'word_count' | 'data' | 'trailing';
  description: string;
}

export interface DecodedFrame {
  rawHex: string;
  bytes: number[];
  isValid: boolean;
  headerValid: boolean;
  lengthByte: number;
  actualPayloadLength: number;
  lengthMatches: boolean;
  command: number;
  commandName: string;
  vpAddress?: number;
  wordCount?: number;
  dataBytes: number[];
  interpretedValue?: {
    rawHex: string;
    asUint16?: number;
    asInt16?: number;
    asUint32?: number;
    asInt32?: number;
    asFloat?: number;
    asAscii?: string;
    formatted?: string;
  };
  matchedParameter?: Parameter;
  diagnostics: {
    status: 'success' | 'warning' | 'error';
    summary: string;
    details: string[];
    isProtocolAnomaly?: boolean;
    suggestedFix?: string;
    suggestedLength?: number;
  };
  dissectedBytes: DecodedByte[];
}

export interface HexCompareResult {
  expectedBytes: number[];
  actualBytes: number[];
  match: boolean;
  diffIndices: number[];
  lengthMismatch: boolean;
  summary: string;
  detailedAnalysis: string[];
}

export interface DwinProject {
  id: string;
  name: string;
  version: string;
  description: string;
  dwinModel: string; // e.g. "DMG80480C070_03WTC (T5L2 ASIC)"
  resolution: string;
  headerHex: string; // e.g. "5A A5"
  screens: Screen[];
  parameters: Parameter[];
  updatedAt: string;
}
