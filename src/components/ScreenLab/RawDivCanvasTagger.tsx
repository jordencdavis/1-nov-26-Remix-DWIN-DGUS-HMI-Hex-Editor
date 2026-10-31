/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDwin } from '../../context/DwinContext';
import { DwinDataType, ScreenVpUsageRole, Parameter, ScreenVpBinding, Screen } from '../../types/dwin';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Tag,
  Layers, Cpu, LayoutGrid, Eye, ArrowRight, Download, RefreshCw,
  Move, Plus, Trash2, Edit3, Check, Sliders, Hash, Info, Maximize2,
  ZoomIn, ZoomOut, RotateCcw, Copy
} from 'lucide-react';
import industrialDashboardImg from '../../assets/images/dwin_hmi_industrial_dashboard_1793218798770.jpg';
import blueprintPanelImg from '../../assets/images/dwin_hmi_blueprint_panel_1793218820640.jpg';
import { TextSchemaTagger, TaggedWordItem, DEFAULT_SAMPLE_TAGS, STORAGE_TAGS_KEY, SCHEMA_PARAM_CATEGORIES } from './TextSchemaTagger';
import { ParameterSchemaBoard, ParameterSchemaRowItem } from './ParameterSchemaBoard';

export interface ParsedDivItem {
  id: string;
  rawText: string;
  rawHtml?: string;
  extractedLabel: string;
  extractedValue: string;
  inferredUnit: string;
  x: number;
  y: number;
  width: number;
  height: number;
  
  // Tagging & Assignment
  isTagged: boolean;
  taggedParamName: string;
  taggedIdentifier: string;
  assignedVpAddress: number;
  dataType: DwinDataType;
  unit: string;
  scale: number;
  min: number;
  max: number;
  role: ScreenVpUsageRole;
  targetScreenId: string; // existing screen id or 'new'
  newScreenNumber?: number;
  newScreenName?: string;
  description: string;
}

const SAMPLE_PRESETS: { [key: string]: { title: string; desc: string; text: string } } = {
  hvac: {
    title: 'HVAC Chiller DIV Dump',
    desc: 'HTML div elements with styles, values, and units for a commercial chiller plant',
    text: `<div id="chiller-1-status" class="status-indicator" style="position: absolute; left: 80px; top: 100px; width: 160px; height: 50px;">
  <span class="label">Chiller State</span>
  <span class="val">RUNNING</span>
</div>

<div id="temp-supply" class="metric-box" style="position: absolute; left: 280px; top: 100px; width: 180px; height: 60px;">
  <div class="title">Supply Water Temp</div>
  <div class="value">7.2 °C</div>
</div>

<div id="temp-return" class="metric-box" style="position: absolute; left: 500px; top: 100px; width: 180px; height: 60px;">
  <div class="title">Return Water Temp</div>
  <div class="value">12.8 °C</div>
</div>

<div id="evap-pressure" class="gauge-div" style="position: absolute; left: 80px; top: 220px; width: 180px; height: 60px;">
  <span class="label">Evaporator Pressure</span>
  <span class="val">3.45 bar</span>
</div>

<div id="pump-flow-rate" class="flow-pill" style="position: absolute; left: 280px; top: 220px; width: 180px; height: 60px;">
  <span class="lbl">Primary Flow Rate</span>
  <span class="num">185.0 L/min</span>
</div>

<div id="comp-current" class="amp-box" style="position: absolute; left: 500px; top: 220px; width: 180px; height: 60px;">
  <label>Compressor Current</label>
  <div class="reading">28.4 A</div>
</div>`
  },
  motor: {
    title: 'VFD Motor Inverter DIVs',
    desc: 'Motor drive telemetry divs with RPM, bus voltage, power, and frequency',
    text: `<div class="vfd-telemetry" style="left: 60px; top: 90px; width: 200px; height: 55px;">
  Motor Speed: 1485 RPM
</div>

<div class="vfd-telemetry" style="left: 290px; top: 90px; width: 200px; height: 55px;">
  DC Bus Voltage: 564 V
</div>

<div class="vfd-telemetry" style="left: 520px; top: 90px; width: 200px; height: 55px;">
  Output Frequency: 49.8 Hz
</div>

<div class="vfd-telemetry" style="left: 60px; top: 210px; width: 200px; height: 55px;">
  Drive Torque: 82.5 %
</div>

<div class="vfd-telemetry" style="left: 290px; top: 210px; width: 200px; height: 55px;">
  Heatsink Temp: 54.0 °C
</div>

<div class="vfd-telemetry" style="left: 520px; top: 210px; width: 200px; height: 55px;">
  Total Energy: 1240 kWh
</div>`
  },
  keyvalue: {
    title: 'Key-Value / Coordinates Dump',
    desc: 'Tabular / semi-structured div coordinates and values from logging or CAD',
    text: `div#setpoint_temp { left: 100px, top: 120px, width: 150px, height: 45px } => Target Temp: 23.5 °C
div#room_humidity { left: 300px, top: 120px, width: 150px, height: 45px } => Humidity: 48.2 %
div#co2_ppm { left: 500px, top: 120px, width: 150px, height: 45px } => CO2 Level: 640 ppm
div#fan_speed { left: 100px, top: 240px, width: 150px, height: 45px } => Blower Speed: 75 %
div#filter_dp { left: 300px, top: 240px, width: 150px, height: 45px } => Filter Delta-P: 120 Pa
div#system_alarm { left: 500px, top: 240px, width: 150px, height: 45px } => Alarm Status: 0x0000`
  }
};

export const RawDivCanvasTagger: React.FC = () => {
  const { project, addScreen, updateScreen, addParameter, setActiveTab, setSelectedScreenId } = useDwin();

  // Screen resolution parse
  const screenDimensions = useMemo(() => {
    const parts = (project.resolution || '800x480').toLowerCase().split('x');
    const width = parseInt(parts[0], 10) || 800;
    const height = parseInt(parts[1], 10) || 480;
    return { width, height };
  }, [project.resolution]);

  // Safe base VP generator
  const getSafeNextVp = (offset = 0): number => {
    let highest = 0x1000;
    project.parameters.forEach(p => {
      if (p.vpAddress > highest) highest = p.vpAddress;
    });
    project.screens.forEach(s => {
      s.vpBindings.forEach(b => {
        if (b.vpAddress > highest) highest = b.vpAddress;
      });
    });
    const base = Math.max(0x1100, Math.ceil((highest + 2) / 2) * 2);
    return base + (offset * 2);
  };

  const formatVpHex = (addr: number): string => {
    return '0x' + (addr || 0).toString(16).padStart(4, '0').toUpperCase();
  };

  const parseHexOrDec = (str: string, fallback: number): number => {
    const clean = str.trim();
    if (!clean) return fallback;
    let val: number;
    if (clean.toLowerCase().startsWith('0x')) {
      val = parseInt(clean.substring(2), 16);
    } else {
      val = parseInt(clean, 10);
    }
    return isNaN(val) || val < 0 || val > 0xFFFF ? fallback : val;
  };

  // Storage key for persistent user uploads across tab switching & reloads
  const RAW_DIV_TAGGER_STORAGE_KEY = 'dwin_raw_div_tagger_state_v2';

  // Persistent state
  const [rawText, setRawText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(RAW_DIV_TAGGER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.rawText === 'string') {
          return parsed.rawText;
        }
      }
    } catch {
      // ignore
    }
    return SAMPLE_PRESETS.hvac.text;
  });

  const [parsedItems, setParsedItems] = useState<ParsedDivItem[]>(() => {
    try {
      const saved = localStorage.getItem(RAW_DIV_TAGGER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.parsedItems) && parsed.parsedItems.length > 0) {
          return parsed.parsedItems;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [canvasZoom, setCanvasZoom] = useState<number>(0.9);
  const [canvasBg, setCanvasBg] = useState<'blueprint' | 'dashboard' | 'grid_dark' | 'grid_light'>('blueprint');
  const [viewMode, setViewMode] = useState<'canvas' | 'split' | 'table'>('split');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Shared tagged parameters across TextSchemaTagger and ParameterSchemaBoard
  const [taggedWords, setTaggedWords] = useState<TaggedWordItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TAGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return DEFAULT_SAMPLE_TAGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TAGS_KEY, JSON.stringify(taggedWords));
    } catch { }
  }, [taggedWords]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RAW_DIV_TAGGER_STORAGE_KEY, JSON.stringify({
        rawText,
        parsedItems
      }));
    } catch {
      // ignore
    }
  }, [rawText, parsedItems]);

  // Dragging state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    itemId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safe identifier generator
  const createIdentifierFromName = (name: string): string => {
    const clean = name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_');
    return clean.startsWith('PARAM_') ? clean : `PARAM_${clean || 'VALUE'}`;
  };

  // Parse raw text into div items
  const parseRawDivData = (input: string) => {
    if (!input.trim()) {
      setParsedItems([]);
      setSelectedItemId(null);
      return;
    }

    const defaultScreenId = project.screens[0]?.id || 'new';
    const items: ParsedDivItem[] = [];
    const divRegex = /<div\b([\s\S]*?)>([\s\S]*?)<\/div>/gi;
    let match: RegExpExecArray | null;

    let index = 0;
    const matchedIndices = new Set<number>();

    // 1. Try HTML <div> regex extraction
    while ((match = divRegex.exec(input)) !== null) {
      matchedIndices.add(match.index);
      const attrsStr = match[1] || '';
      const innerHtml = match[2] || '';

      // Extract left, top, width, height from style="..." or inline coords
      let x = 40 + (index % 3) * 220;
      let y = 80 + Math.floor(index / 3) * 90;
      let width = 160;
      let height = 50;

      const leftMatch = attrsStr.match(/left:\s*([0-9.]+)\s*px?/i) || attrsStr.match(/x[:=]\s*([0-9.]+)/i);
      const topMatch = attrsStr.match(/top:\s*([0-9.]+)\s*px?/i) || attrsStr.match(/y[:=]\s*([0-9.]+)/i);
      const widthMatch = attrsStr.match(/width:\s*([0-9.]+)\s*px?/i) || attrsStr.match(/w[:=]\s*([0-9.]+)/i);
      const heightMatch = attrsStr.match(/height:\s*([0-9.]+)\s*px?/i) || attrsStr.match(/h[:=]\s*([0-9.]+)/i);

      if (leftMatch) x = Math.round(parseFloat(leftMatch[1]));
      if (topMatch) y = Math.round(parseFloat(topMatch[1]));
      if (widthMatch) width = Math.round(parseFloat(widthMatch[1]));
      if (heightMatch) height = Math.round(parseFloat(heightMatch[1]));

      // Extract id or class as name hint
      const idMatch = attrsStr.match(/id=["']([^"']+)["']/i);
      const classMatch = attrsStr.match(/class=["']([^"']+)["']/i);
      const fallbackName = idMatch ? idMatch[1].replace(/[-_]/g, ' ') : classMatch ? classMatch[1].replace(/[-_]/g, ' ') : `DIV Value #${index + 1}`;

      // Clean inner text to extract label, value, and unit
      // Strip html tags for plain text inspection
      const plainText = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // Detect value & unit
      const parsedUnitMatch = plainText.match(/([-+]?[0-9]*\.?[0-9]+)\s*([°a-zA-Z%/\^]+)/) ||
                              plainText.match(/\b(0x[0-9a-fA-F]+)\b/) ||
                              plainText.match(/\b(RUNNING|STOPPED|ALARM|TRIP|ON|OFF|OK)\b/i);

      let extractedValue = '0';
      let inferredUnit = '';
      let extractedLabel = fallbackName;

      if (parsedUnitMatch) {
        if (parsedUnitMatch[2]) {
          extractedValue = parsedUnitMatch[1];
          inferredUnit = parsedUnitMatch[2].trim();
        } else if (parsedUnitMatch[1]) {
          extractedValue = parsedUnitMatch[1];
        }
        // Label is remaining text
        const labelCandidate = plainText.replace(parsedUnitMatch[0], '').replace(/[:=\-_]/g, ' ').trim();
        if (labelCandidate) {
          extractedLabel = labelCandidate;
        }
      } else if (plainText) {
        extractedValue = plainText;
      }

      // Infer data type
      let inferredType: DwinDataType = 'UINT16';
      let scale = 1;
      let min = 0;
      let max = 65535;

      if (extractedValue.includes('.')) {
        inferredType = 'FLOAT32';
        scale = 10;
        min = -1000;
        max = 10000;
      } else if (extractedValue.toLowerCase().startsWith('0x')) {
        inferredType = 'UINT16';
      } else if (/^(RUNNING|STOPPED|ON|OFF|ALARM)$/i.test(extractedValue)) {
        inferredType = 'BITFIELD';
        max = 1;
      }

      const assignedVp = getSafeNextVp(index);
      const formattedLabel = extractedLabel.replace(/\b\w/g, c => c.toUpperCase()).trim();

      items.push({
        id: `div_item_${index}_${Date.now()}`,
        rawText: plainText || attrsStr,
        rawHtml: match[0],
        extractedLabel: formattedLabel,
        extractedValue,
        inferredUnit,
        x: Math.max(0, Math.min(x, screenDimensions.width - 40)),
        y: Math.max(0, Math.min(y, screenDimensions.height - 30)),
        width: Math.max(80, Math.min(width, 400)),
        height: Math.max(30, Math.min(height, 200)),
        isTagged: true,
        taggedParamName: formattedLabel,
        taggedIdentifier: createIdentifierFromName(formattedLabel),
        assignedVpAddress: assignedVp,
        dataType: inferredType,
        unit: inferredUnit,
        scale,
        min,
        max,
        role: inferredType === 'BITFIELD' ? 'status_icon' : 'data_display',
        targetScreenId: defaultScreenId,
        newScreenNumber: project.screens.length,
        newScreenName: 'Imported Screen',
        description: `Parsed from DIV dump: ${attrsStr ? attrsStr.slice(0, 45) : plainText.slice(0, 45)}`
      });

      index++;
    }

    // 2. Fallback: If no HTML tags were found, parse line by line (key-value, CSV, or style lines)
    if (items.length === 0) {
      const lines = input.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      lines.forEach((line, lineIdx) => {
        let x = 50 + (lineIdx % 3) * 220;
        let y = 80 + Math.floor(lineIdx / 3) * 80;
        let width = 160;
        let height = 48;

        const leftMatch = line.match(/left[:=]\s*([0-9.]+)/i) || line.match(/x[:=]\s*([0-9.]+)/i);
        const topMatch = line.match(/top[:=]\s*([0-9.]+)/i) || line.match(/y[:=]\s*([0-9.]+)/i);
        const widthMatch = line.match(/width[:=]\s*([0-9.]+)/i) || line.match(/w[:=]\s*([0-9.]+)/i);
        const heightMatch = line.match(/height[:=]\s*([0-9.]+)/i) || line.match(/h[:=]\s*([0-9.]+)/i);

        if (leftMatch) x = Math.round(parseFloat(leftMatch[1]));
        if (topMatch) y = Math.round(parseFloat(topMatch[1]));
        if (widthMatch) width = Math.round(parseFloat(widthMatch[1]));
        if (heightMatch) height = Math.round(parseFloat(heightMatch[1]));

        // Split label and value by '=>', ':', '=', or '-'
        let label = `Item ${lineIdx + 1}`;
        let value = '0';
        let unit = '';

        if (line.includes('=>')) {
          const parts = line.split('=>');
          const valuePart = parts[1].trim();
          const valMatch = valuePart.match(/([-+]?[0-9]*\.?[0-9]+)\s*([°a-zA-Z%/\^]+)?/);
          if (valMatch) {
            value = valMatch[1];
            unit = valMatch[2] || '';
            label = valuePart.replace(valMatch[0], '').replace(/[:=]/g, '').trim() || parts[0].trim();
          } else {
            value = valuePart;
            label = parts[0].trim();
          }
        } else if (line.includes(':')) {
          const parts = line.split(':');
          label = parts[0].trim();
          const valuePart = parts.slice(1).join(':').trim();
          const valMatch = valuePart.match(/([-+]?[0-9]*\.?[0-9]+)\s*([°a-zA-Z%/\^]+)?/);
          if (valMatch) {
            value = valMatch[1];
            unit = valMatch[2] || '';
          } else {
            value = valuePart;
          }
        } else {
          // generic line
          const numMatch = line.match(/([-+]?[0-9]*\.?[0-9]+)\s*([°a-zA-Z%/\^]+)?/);
          if (numMatch) {
            value = numMatch[1];
            unit = numMatch[2] || '';
            label = line.replace(numMatch[0], '').trim() || `Token ${lineIdx + 1}`;
          } else {
            label = line;
          }
        }

        const assignedVp = getSafeNextVp(lineIdx);
        const cleanLabel = label.replace(/[#._\-{}<>]/g, ' ').replace(/\s+/g, ' ').trim() || `Parameter ${lineIdx + 1}`;

        items.push({
          id: `div_item_${lineIdx}_${Date.now()}`,
          rawText: line,
          extractedLabel: cleanLabel,
          extractedValue: value,
          inferredUnit: unit,
          x: Math.max(0, Math.min(x, screenDimensions.width - 40)),
          y: Math.max(0, Math.min(y, screenDimensions.height - 30)),
          width: Math.max(80, Math.min(width, 400)),
          height: Math.max(30, Math.min(height, 200)),
          isTagged: true,
          taggedParamName: cleanLabel,
          taggedIdentifier: createIdentifierFromName(cleanLabel),
          assignedVpAddress: assignedVp,
          dataType: value.includes('.') ? 'FLOAT32' : 'UINT16',
          unit,
          scale: value.includes('.') ? 10 : 1,
          min: 0,
          max: 65535,
          role: 'data_display',
          targetScreenId: defaultScreenId,
          newScreenNumber: project.screens.length,
          newScreenName: 'Imported Screen',
          description: `Extracted from raw line: ${line.slice(0, 50)}`
        });
      });
    }

    setParsedItems(items);
    if (items.length > 0) {
      setSelectedItemId(items[0].id);
      setStatusMessage({
        type: 'success',
        text: `Extracted ${items.length} div elements & values. Ready to inspect on canvas and tag parameters.`
      });
    } else {
      setSelectedItemId(null);
      setStatusMessage({
        type: 'info',
        text: 'No elements could be extracted. Please paste HTML divs or coordinate lines.'
      });
    }
  };

  // Run initial parse on mount only if parsedItems is not already populated
  useEffect(() => {
    if (parsedItems.length === 0 && rawText) {
      parseRawDivData(rawText);
    } else if (parsedItems.length > 0 && !selectedItemId) {
      setSelectedItemId(parsedItems[0].id);
    }
  }, []);

  // Selected item reference
  const selectedItem = useMemo(() => {
    return parsedItems.find(it => it.id === selectedItemId) || null;
  }, [parsedItems, selectedItemId]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        parseRawDivData(content);
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Update a single item
  const updateParsedItem = (id: string, updates: Partial<ParsedDivItem>) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        if (updates.taggedParamName && !updates.taggedIdentifier) {
          updated.taggedIdentifier = createIdentifierFromName(updates.taggedParamName);
        }
        return updated;
      }
      return item;
    }));
  };

  // Auto-tag all with sequential VPs
  const handleAutoTagAll = () => {
    const startBaseVp = getSafeNextVp(0);
    setParsedItems(prev => prev.map((item, idx) => {
      const vp = startBaseVp + (idx * 2);
      const name = item.extractedLabel || `Item ${idx + 1}`;
      return {
        ...item,
        isTagged: true,
        assignedVpAddress: vp,
        taggedParamName: name,
        taggedIdentifier: createIdentifierFromName(name),
        role: item.dataType === 'BITFIELD' ? 'status_icon' : 'data_display'
      };
    }));
    setStatusMessage({
      type: 'success',
      text: `Auto-tagged all ${parsedItems.length} elements with consecutive word-aligned VPs starting at ${formatVpHex(startBaseVp)}.`
    });
  };

  // Canvas mouse handlers for dragging elements
  const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setSelectedItemId(itemId);

    const item = parsedItems.find(it => it.id === itemId);
    if (!item) return;

    setDragState({
      itemId,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    const dx = (e.clientX - dragState.startX) / canvasZoom;
    const dy = (e.clientY - dragState.startY) / canvasZoom;

    const newX = Math.max(0, Math.min(Math.round(dragState.origX + dx), screenDimensions.width - 40));
    const newY = Math.max(0, Math.min(Math.round(dragState.origY + dy), screenDimensions.height - 30));

    updateParsedItem(dragState.itemId, { x: newX, y: newY });
  };

  const handleCanvasMouseUp = () => {
    if (dragState) {
      setDragState(null);
    }
  };

  // Import to project (Screen Registry & Parameter Registry)
  const handleCommitToProject = () => {
    if (parsedItems.length === 0) return;

    // Group items by target screen
    const targetScreenMap = new Map<string, ParsedDivItem[]>();
    parsedItems.forEach(item => {
      const scrKey = item.targetScreenId || project.screens[0]?.id || 'new';
      if (!targetScreenMap.has(scrKey)) {
        targetScreenMap.set(scrKey, []);
      }
      targetScreenMap.get(scrKey)!.push(item);
    });

    let createdScreensCount = 0;
    let boundVpsCount = 0;
    let createdParamsCount = 0;
    let lastActiveScreenId = project.screens[0]?.id || '';

    targetScreenMap.forEach((items, screenKey) => {
      if (screenKey === 'new' || !project.screens.some(s => s.id === screenKey)) {
        // Create new screen
        const nextScreenNum = project.screens.length + createdScreensCount;
        const newScreenBindings: ScreenVpBinding[] = items.map(it => ({
          id: `bind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          vpAddress: it.assignedVpAddress,
          role: it.role,
          label: it.taggedParamName,
          x: it.x,
          y: it.y,
          width: it.width,
          height: it.height,
          notes: `Imported from DIV dump: ${it.rawText.slice(0, 30)}`
        }));

        const newScreen = addScreen({
          screenNumber: nextScreenNum,
          name: items[0]?.newScreenName || `Screen ${nextScreenNum} (Imported)`,
          group: 'Imported DIVs',
          resolution: project.resolution,
          bgImageIndex: nextScreenNum,
          bgImageUrl: canvasBg === 'blueprint' ? blueprintPanelImg : industrialDashboardImg,
          description: `Created via SCREEN Lab Raw DIV Visual Parser with ${items.length} mapped controls.`,
          vpBindings: newScreenBindings,
          navigations: []
        });

        lastActiveScreenId = newScreen.id;
        createdScreensCount++;
        boundVpsCount += items.length;
      } else {
        // Add bindings to existing screen
        const targetScreen = project.screens.find(s => s.id === screenKey);
        if (targetScreen) {
          const newBindings: ScreenVpBinding[] = items.map(it => ({
            id: `bind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            vpAddress: it.assignedVpAddress,
            role: it.role,
            label: it.taggedParamName,
            x: it.x,
            y: it.y,
            width: it.width,
            height: it.height,
            notes: `Imported from DIV: ${it.rawText.slice(0, 30)}`
          }));

          updateScreen(screenKey, {
            vpBindings: [...targetScreen.vpBindings, ...newBindings]
          });
          lastActiveScreenId = screenKey;
          boundVpsCount += items.length;
        }
      }

      // Add all parameters to parameter registry
      items.forEach(it => {
        addParameter({
          vpAddress: it.assignedVpAddress,
          name: it.taggedParamName,
          identifier: it.taggedIdentifier,
          dataType: it.dataType,
          words: it.dataType === 'FLOAT32' || it.dataType === 'UINT32' || it.dataType === 'INT32' ? 2 : 1,
          unit: it.unit,
          scale: it.scale,
          min: it.min,
          max: it.max,
          defaultValue: it.extractedValue.includes('.') ? parseFloat(it.extractedValue) || 0 : parseInt(it.extractedValue, 10) || 0,
          role: 'read_write',
          group: 'Screen Lab Imports',
          description: it.description
        });
        createdParamsCount++;
      });
    });

    if (lastActiveScreenId) {
      setSelectedScreenId(lastActiveScreenId);
    }

    setStatusMessage({
      type: 'success',
      text: `Successfully imported ${boundVpsCount} VP bindings across ${createdScreensCount > 0 ? `${createdScreensCount} new screen(s)` : 'existing screens'} and added ${createdParamsCount} parameters to the project registry!`
    });
  };

  // Finish and Add newly tagged parameters to main registries (Screen + Parameters)
  const handleFinishCommitToMain = (configuredRows?: ParameterSchemaRowItem[]) => {
    // 1. If configuredRows are passed directly from ParameterSchemaBoard (10-parameter matrix)
    if (configuredRows && configuredRows.length > 0) {
      let addedParamsCount = 0;
      let boundCount = 0;
      const screenNameToIdMap = new Map<string, string>();
      
      // Map existing screens
      project.screens.forEach(s => {
        screenNameToIdMap.set(s.name.toLowerCase().trim(), s.id);
      });

      // Group rows by target screen
      const screenGroups = new Map<string, ParameterSchemaRowItem[]>();
      configuredRows.forEach(row => {
        const scrName = row.screen?.trim() || 'Imported Schema Screen';
        if (!screenGroups.has(scrName)) {
          screenGroups.set(scrName, []);
        }
        screenGroups.get(scrName)!.push(row);
      });

      screenGroups.forEach((rowsInScreen, scrName) => {
        const lowerName = scrName.toLowerCase();
        let targetScreenId = screenNameToIdMap.get(lowerName);

        const newBindings: ScreenVpBinding[] = rowsInScreen.map((row, idx) => {
          const numVal = parseFloat(row.value) || 0;
          const identifier = createIdentifierFromName(row.parameterName);

          // Add to Parameter Registry
          addParameter({
            name: row.parameterName,
            identifier: identifier,
            vpAddress: row.vpAddress,
            dataType: row.dataType,
            words: row.dataType === 'UINT32' || row.dataType === 'INT32' || row.dataType === 'FLOAT32' ? 2 : 1,
            unit: row.unit,
            scale: row.scale || 1,
            min: 0,
            max: 65535,
            defaultValue: numVal,
            role: row.readWrite.toLowerCase().includes('read only') ? 'read_only' : 'read_write',
            group: 'Schema Matrix Parameters',
            description: `Serial #${row.serialNumber} • Device: ${row.device || 'DWIN'} • Date: ${row.time || 'dd/mm/yy'} • FBST: ${row.fbst || '-'} • MCU ID: ${row.mcuId || '-'} • VP: ${row.vpHex} • Hex: ${row.hexValue}`
          });
          addedParamsCount++;

          return {
            id: `bind_row_${row.serialNumber}_${Date.now()}_${idx}`,
            vpAddress: row.vpAddress,
            role: row.readWrite.toLowerCase().includes('read only') ? 'data_display' : 'touch_input',
            label: row.parameterName,
            x: 40 + (idx % 4) * 170,
            y: 80 + Math.floor(idx / 4) * 70,
            width: 150,
            height: 48,
            notes: `Serial #${row.serialNumber} (1:1 with ${row.vpHex})`
          };
        });

        boundCount += newBindings.length;

        if (targetScreenId) {
          const existingScreen = project.screens.find(s => s.id === targetScreenId);
          if (existingScreen) {
            updateScreen(targetScreenId, {
              vpBindings: [...existingScreen.vpBindings, ...newBindings]
            });
            setSelectedScreenId(targetScreenId);
          }
        } else {
          // Create new screen for this group
          const nextScreenNum = project.screens.length;
          const newScreen = addScreen({
            screenNumber: nextScreenNum,
            name: scrName,
            group: 'Imported Schema',
            resolution: project.resolution,
            bgImageIndex: nextScreenNum,
            bgImageUrl: canvasBg === 'blueprint' ? blueprintPanelImg : industrialDashboardImg,
            description: `Auto-created for 10-Parameter Schema with ${rowsInScreen.length} parameters.`,
            vpBindings: newBindings,
            navigations: []
          });
          screenNameToIdMap.set(lowerName, newScreen.id);
          setSelectedScreenId(newScreen.id);
        }
      });

      setStatusMessage({
        type: 'success',
        text: `Successfully finished! Added ${addedParamsCount} parameter(s) mapped 1-to-1 across ${screenGroups.size} screen(s). Each Serial Number is assigned to its unique VP address with live Hex command frames.`
      });
      return;
    }

    // 2. Fallback if called without configuredRows
    if (taggedWords.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'No tagged parameters available to add. Please tag or add parameters first.'
      });
      return;
    }

    const paramNames = taggedWords.filter(t => t.categoryId === 'parameterName');
    const vps = taggedWords.filter(t => t.categoryId === 'vp');
    const units = taggedWords.filter(t => t.categoryId === 'unit');
    const scales = taggedWords.filter(t => t.categoryId === 'scale');
    const dataTypes = taggedWords.filter(t => t.categoryId === 'dataType');
    const values = taggedWords.filter(t => t.categoryId === 'value');
    const readWrites = taggedWords.filter(t => t.categoryId === 'readWrite');

    const recordCount = Math.max(paramNames.length, vps.length, values.length, 1);
    const targetScreenId = project.screens[0]?.id || 'new';
    let addedParamsCount = 0;
    const baseVp = getSafeNextVp(0);
    const newBindings: ScreenVpBinding[] = [];

    for (let i = 0; i < recordCount; i++) {
      const rawName = paramNames[i]?.text || `Parameter #${i + 1}`;
      const rawVpStr = vps[i]?.text || '';
      const vpAddress = parseHexOrDec(rawVpStr, baseVp + i * 2);
      const unit = units[i]?.text || '';
      const scaleVal = parseFloat(scales[i]?.text || '1') || 1;
      const rawType = (dataTypes[i]?.text || 'UINT16').toUpperCase();
      const validDataType: DwinDataType = 
        ['UINT8','INT8','UINT16','INT16','UINT32','INT32','FLOAT32','STRING','BITFIELD'].includes(rawType)
          ? rawType as DwinDataType
          : 'UINT16';
      const rawVal = values[i]?.text || '0';
      const numVal = rawVal.includes('.') ? parseFloat(rawVal) || 0 : parseInt(rawVal, 10) || 0;
      const rawRole = (readWrites[i]?.text || 'Read/Write').toLowerCase();
      const identifier = createIdentifierFromName(rawName);

      // Add to parameter registry
      addParameter({
        name: rawName,
        identifier: identifier,
        vpAddress: vpAddress,
        dataType: validDataType,
        words: validDataType === 'UINT32' || validDataType === 'INT32' || validDataType === 'FLOAT32' ? 2 : 1,
        unit: unit,
        scale: scaleVal,
        min: 0,
        max: 65535,
        defaultValue: numVal,
        role: rawRole.includes('read only') ? 'read_only' : 'read_write',
        group: 'Tagged Schema Parameters',
        description: `Imported via 10-Parameter Schema Registry.`
      });
      addedParamsCount++;

      // Create screen binding
      newBindings.push({
        id: `bind_tag_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        vpAddress: vpAddress,
        role: rawRole.includes('read only') ? 'data_display' : 'touch_input',
        label: rawName,
        x: 40 + (i % 4) * 170,
        y: 80 + Math.floor(i / 4) * 70,
        width: 150,
        height: 48,
        notes: `Imported from Tagged Schema Board`
      });
    }

    // Add bindings to target screen or create screen
    if (project.screens.length > 0 && targetScreenId !== 'new') {
      const existingScreen = project.screens.find(s => s.id === targetScreenId) || project.screens[0];
      updateScreen(existingScreen.id, {
        vpBindings: [...existingScreen.vpBindings, ...newBindings]
      });
      setSelectedScreenId(existingScreen.id);
    } else {
      const newScreen = addScreen({
        screenNumber: project.screens.length,
        name: 'Tagged Parameters Screen',
        group: 'Tagged UI',
        resolution: project.resolution,
        bgImageIndex: 0,
        description: 'Screen created with newly tagged parameters.',
        vpBindings: newBindings,
        navigations: []
      });
      setSelectedScreenId(newScreen.id);
    }

    setStatusMessage({
      type: 'success',
      text: `Successfully finished! Added ${addedParamsCount} newly tagged parameter(s) to Parameter Registry & Screen Registry. They can now be used as normal user data parameters across all tabs.`
    });
  };

  // Export structured JSON
  const handleExportJson = () => {
    const exportData = {
      source: 'DWIN DGUS SCREEN Lab Raw DIV Parser',
      timestamp: new Date().toISOString(),
      screenResolution: project.resolution,
      itemsCount: parsedItems.length,
      structuredItems: parsedItems.map(it => ({
        token: it.extractedLabel,
        rawValue: it.extractedValue,
        unit: it.unit,
        vpAddressHex: formatVpHex(it.assignedVpAddress),
        vpAddressDec: it.assignedVpAddress,
        parameterName: it.taggedParamName,
        identifier: it.taggedIdentifier,
        dataType: it.dataType,
        scale: it.scale,
        role: it.role,
        coordinates: { x: it.x, y: it.y, width: it.width, height: it.height },
        targetScreen: it.targetScreenId
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dwin_tagged_div_parameters_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export structured CSV
  const handleExportCsv = () => {
    const headers = ['Token Label', 'Raw Value', 'Unit', 'VP Address (HEX)', 'VP (DEC)', 'Parameter Name', 'Identifier', 'Data Type', 'Scale', 'Role', 'X', 'Y', 'Width', 'Height'];
    const rows = parsedItems.map(it => [
      `"${it.extractedLabel.replace(/"/g, '""')}"`,
      `"${it.extractedValue}"`,
      `"${it.unit}"`,
      `"${formatVpHex(it.assignedVpAddress)}"`,
      it.assignedVpAddress,
      `"${it.taggedParamName.replace(/"/g, '""')}"`,
      `"${it.taggedIdentifier}"`,
      `"${it.dataType}"`,
      it.scale,
      `"${it.role}"`,
      it.x,
      it.y,
      it.width,
      it.height
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dwin_tagged_div_parameters_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Status Bar */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in shadow-xs ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : statusMessage.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-indigo-50 border-indigo-200 text-indigo-900'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {statusMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-600 shrink-0" />}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('screens')}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer shadow-2xs"
                >
                  View Screens →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('parameters')}
                  className="px-2.5 py-1 rounded bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-medium cursor-pointer"
                >
                  View Parameters →
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}



      {/* 3. Parameter Schema Board with 10 Parameters on Top, Tagged Parameters Under Each Header, Mix & Match Dropdowns, and Finish Button */}
      <ParameterSchemaBoard
        taggedWords={taggedWords}
        setTaggedWords={setTaggedWords}
        onFinishCommit={handleFinishCommitToMain}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
      />
    </div>
  );
};
