/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useDwin } from '../../context/DwinContext';
import { 
  Sliders, ArrowLeft, ArrowRight, RotateCcw, Check, CheckCircle2, 
  ListOrdered, Sparkles, Layers, Table, Info, Save, ChevronsLeft, 
  ChevronsRight, Eye, Settings, RefreshCw, Cpu, Radio, Hash
} from 'lucide-react';
import {
  HeaderColumnDef,
  HEADER_COLUMNS_CATALOG,
  HEADER_COLUMN_BY_NUM,
  DEFAULT_DEVICE_HEADER_ORDERS,
  NATURAL_HEADER_ORDER
} from '../ScreenLab/DeviceOrderConfigModal';
import {
  DEFAULT_DEVICES,
  STORAGE_DEVICE_ORDERS_KEY,
  STORAGE_SELECTED_DEVICE_PROFILE_KEY
} from '../ScreenLab/ParameterSchemaBoard';

export const HeaderConfigTab: React.FC = () => {
  const { project, setActiveTab } = useDwin();

  // Available devices
  const availableDevices = useMemo(() => {
    const list = [...DEFAULT_DEVICES];
    if (project?.dwinModel && !list.includes(project.dwinModel)) {
      list.unshift(project.dwinModel);
    }
    return list;
  }, [project?.dwinModel]);

  // Selected device profile
  const [activeDevice, setActiveDevice] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SELECTED_DEVICE_PROFILE_KEY);
      if (saved && saved !== 'all') return saved;
    } catch { }
    return availableDevices[0] || 'DWIN DMG80480C070_03WTR';
  });

  // Device sequence orders map
  const [deviceOrders, setDeviceOrders] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DEVICE_ORDERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_DEVICE_HEADER_ORDERS, ...parsed };
        }
      }
    } catch { }
    return DEFAULT_DEVICE_HEADER_ORDERS;
  });

  // Text representation for quick formula editing
  const [inputText, setInputText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Current active sequence for the selected device
  const currentSequence = useMemo(() => {
    return deviceOrders[activeDevice] || DEFAULT_DEVICE_HEADER_ORDERS[activeDevice] || NATURAL_HEADER_ORDER;
  }, [deviceOrders, activeDevice]);

  // Sync input text when active device or its sequence changes
  useEffect(() => {
    setInputText(currentSequence.join(', '));
    setParseError(null);
  }, [currentSequence, activeDevice]);

  // Handle switching active device tab
  const handleDeviceChange = (dev: string) => {
    setActiveDevice(dev);
    try {
      localStorage.setItem(STORAGE_SELECTED_DEVICE_PROFILE_KEY, dev);
      window.dispatchEvent(new CustomEvent('dwin_header_order_updated'));
    } catch { }
  };

  // Move column left or right
  const handleMove = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentSequence.length) return;

    const newSeq = [...currentSequence];
    const temp = newSeq[index];
    newSeq[index] = newSeq[targetIndex];
    newSeq[targetIndex] = temp;

    const updated = {
      ...deviceOrders,
      [activeDevice]: newSeq
    };
    setDeviceOrders(updated);
    saveAndNotify(updated, activeDevice);
  };

  // Move column to start or end
  const handleJump = (index: number, position: 'start' | 'end') => {
    const item = currentSequence[index];
    const rest = currentSequence.filter((_, idx) => idx !== index);
    const newSeq = position === 'start' ? [item, ...rest] : [...rest, item];

    const updated = {
      ...deviceOrders,
      [activeDevice]: newSeq
    };
    setDeviceOrders(updated);
    saveAndNotify(updated, activeDevice);
  };

  // Parse text expression (e.g. "1, 5, 2, 3, 4, 7, 8, 12, 14, 6, 9, 10, 11, 13")
  const handleParseApplyText = () => {
    setParseError(null);
    const rawTokens = inputText.split(/[,\s]+/).filter(Boolean);
    const numbers = rawTokens.map(t => parseInt(t.replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n));

    if (numbers.length === 0) {
      setParseError('Please enter comma-separated numbers (e.g. 1, 5, 2, 3, 4, 7, 8, 12, 14, 6, 9, 10, 11, 13).');
      return;
    }

    // Filter valid numbers between 1 and 14
    const valid = numbers.filter(n => n >= 1 && n <= 14);
    const unique = Array.from(new Set(valid));

    // Append any missing numbers from 1..14 to ensure all columns exist
    const missing = NATURAL_HEADER_ORDER.filter(n => !unique.includes(n));
    const finalSeq = [...unique, ...missing];

    const updated = {
      ...deviceOrders,
      [activeDevice]: finalSeq
    };
    setDeviceOrders(updated);
    saveAndNotify(updated, activeDevice);

    if (missing.length > 0) {
      setSavedFeedback(`Applied sequence! Note: Appended missing columns (${missing.map(n => `#${n}`).join(', ')}) at the end.`);
    } else {
      setSavedFeedback(`Applied sequence formula for ${activeDevice}!`);
    }
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  // Apply a preset sequence
  const handleApplyPreset = (presetSeq: number[], label: string) => {
    const updated = {
      ...deviceOrders,
      [activeDevice]: [...presetSeq]
    };
    setDeviceOrders(updated);
    saveAndNotify(updated, activeDevice);
    setSavedFeedback(`Preset applied: ${label}`);
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  // Reset to default
  const handleResetCurrent = () => {
    const defaultSeq = DEFAULT_DEVICE_HEADER_ORDERS[activeDevice] || NATURAL_HEADER_ORDER;
    const updated = {
      ...deviceOrders,
      [activeDevice]: [...defaultSeq]
    };
    setDeviceOrders(updated);
    saveAndNotify(updated, activeDevice);
    setSavedFeedback(`Reset ${activeDevice} to default sequence.`);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  // Reset all devices to defaults
  const handleResetAllDevices = () => {
    setDeviceOrders(DEFAULT_DEVICE_HEADER_ORDERS);
    saveAndNotify(DEFAULT_DEVICE_HEADER_ORDERS, activeDevice);
    setSavedFeedback('Reset all device sequences to official factory defaults.');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  // Persistence helper
  const saveAndNotify = (orders: Record<string, number[]>, profile: string) => {
    try {
      localStorage.setItem(STORAGE_DEVICE_ORDERS_KEY, JSON.stringify(orders));
      localStorage.setItem(STORAGE_SELECTED_DEVICE_PROFILE_KEY, profile);
      window.dispatchEvent(new CustomEvent('dwin_header_order_updated', {
        detail: { deviceOrders: orders, selectedDeviceProfile: profile }
      }));
    } catch { }
  };

  // Manual save button handler
  const handleManualSave = () => {
    saveAndNotify(deviceOrders, activeDevice);
    setSavedFeedback(`Saved sequence configuration for all devices!`);
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  // Sample preview data to show columns live in action
  const samplePreviewRows = useMemo(() => [
    {
      serialNumber: 1,
      mcuId: 'MCU-001-1020',
      device: activeDevice,
      time: '31/10/26',
      fbst: '1793447194000',
      screen: 'Chiller Plant System',
      vp: '0x1020',
      parameterName: 'Supply Water Temp',
      unit: '°C',
      scale: '10',
      dataType: 'UINT16',
      value: '7.2',
      readWrite: 'Read/Write',
      hexValue: '5A A5 05 82 10 20 00 48'
    },
    {
      serialNumber: 2,
      mcuId: 'MCU-002-1022',
      device: activeDevice,
      time: '31/10/26',
      fbst: '1793447194000',
      screen: 'Chiller Plant System',
      vp: '0x1022',
      parameterName: 'Return Water Temp',
      unit: '°C',
      scale: '10',
      dataType: 'UINT16',
      value: '12.4',
      readWrite: 'Read/Write',
      hexValue: '5A A5 05 82 10 22 00 7C'
    },
    {
      serialNumber: 3,
      mcuId: 'MCU-003-1024',
      device: activeDevice,
      time: '31/10/26',
      fbst: '1793447194000',
      screen: 'Chiller Plant System',
      vp: '0x1024',
      parameterName: 'Evaporator Flow Rate',
      unit: 'm³/h',
      scale: '1',
      dataType: 'UINT16',
      value: '185',
      readWrite: 'Read/Write',
      hexValue: '5A A5 05 82 10 24 00 B9'
    },
    {
      serialNumber: 4,
      mcuId: 'MCU-004-1026',
      device: activeDevice,
      time: '31/10/26',
      fbst: '1793447194000',
      screen: 'Chiller Plant System',
      vp: '0x1026',
      parameterName: 'Compressor Run State',
      unit: 'status',
      scale: '1',
      dataType: 'UINT16',
      value: '1',
      readWrite: 'Read/Write',
      hexValue: '5A A5 05 82 10 26 00 01'
    }
  ], [activeDevice]);

  return (
    <div className="space-y-6">
      {/* Workspace Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Configure Header Sequence
                </h1>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Separate Tab Workspace
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  14 Total Columns
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rearrange header parameter column sequence per device profile. Every parameter strictly preserves its <strong>original number (#1 to #14)</strong> while display order shifts to match your hardware specification (e.g. DWIN &rarr; <strong>1, 5, 2, 3, 4...</strong>).
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleManualSave}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-2xs cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Sequence</span>
          </button>


        </div>
      </div>

      {/* Toast Feedback */}
      {savedFeedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Section 1: Device Profile Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3" style={{ backgroundColor: '#ffd250' }}>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-50 text-blue-700">
              <Cpu className="w-4 h-4" />
            </span>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800" style={{ fontSize: '18px', borderColor: '#dac46b', color: '#ff3faf' }}>
              1. Select Target Device Profile
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Active: <strong className="text-indigo-700 font-mono">{activeDevice}</strong>
          </span>
        </div>

        {/* Device Selection Radio Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {availableDevices.map((dev, devIdx) => {
            const isSelected = dev === activeDevice;
            const seq = deviceOrders[dev] || DEFAULT_DEVICE_HEADER_ORDERS[dev] || NATURAL_HEADER_ORDER;
            const seqPreview = seq.slice(0, 5).join(', ') + '...';

            return (
              <button
                key={dev}
                type="button"
                onClick={() => handleDeviceChange(dev)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="headerConfigDevice"
                      checked={isSelected}
                      onChange={() => handleDeviceChange(dev)}
                      className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-slate-900 leading-snug line-clamp-1" style={devIdx === 0 ? { fontSize: '14px' } : undefined}>
                      {dev}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white shrink-0">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                  <span className="text-slate-400">Order:</span>
                  <span className="font-bold text-indigo-700 truncate max-w-[150px]">
                    {seqPreview}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Active Sequence Formula & 1-Click Presets */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2" style={{ fontSize: '18px' }}>
            <span className="p-1 rounded bg-indigo-50 text-indigo-700">
              <ListOrdered className="w-4 h-4" />
            </span>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              2. Sequence Formula &amp; 1-Click Presets
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCurrent}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset Profile</span>
            </button>
            <button
              type="button"
              onClick={handleResetAllDevices}
              className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-red-500" />
              <span>Reset All</span>
            </button>
          </div>
        </div>

        {/* Current Sequence Pill Sequence */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2" style={{ backgroundColor: '#ffbdf1' }}>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5" style={{ fontSize: '15px', backgroundColor: '#ffffff' }}>
              <Hash className="w-3.5 h-3.5 text-indigo-400" />
              <span style={{ fontSize: '15px', backgroundColor: '#ffffff' }}>Active Column Sequence for <strong className="text-white" style={{ borderColor: '#7d2c2c', color: '#030202' }}>{activeDevice}</strong>:</span>
            </span>
            <span className="text-indigo-400 font-bold">14 Positions</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {currentSequence.map((num, idx) => {
              const def = HEADER_COLUMN_BY_NUM[num];
              const isFirst5 = idx < 5;
              return (
                <div
                  key={`${num}-${idx}`}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-xs whitespace-nowrap shrink-0 transition-transform ${
                    isFirst5
                      ? 'bg-indigo-900/60 border-indigo-500/80 text-indigo-200 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <span className="text-[10px] text-slate-400">{idx + 1}.</span>
                  <span className="px-1 py-0.2 rounded bg-indigo-500 text-white text-[10px] font-bold">
                    #{num}
                  </span>
                  <span className="text-xs">{def?.shortLabel || `Col ${num}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            One-Click Sequence Presets:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleApplyPreset([1, 5, 2, 3, 4, 7, 8, 12, 14, 6, 9, 10, 11, 13], 'DWIN Standard (1, 5, 2, 3, 4...)')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>DWIN DGUS Standard: 1, 5, 2, 3, 4...</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset(NATURAL_HEADER_ORDER, 'Natural (1..14)')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium cursor-pointer transition-colors"
            >
              <span>Default Natural (1, 2, 3, 4, 5... 14)</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset([5, 4, 3, 1, 2, 7, 8, 12, 14, 11, 10, 9, 6, 13], 'MCU & Telemetry First')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-medium cursor-pointer transition-colors"
            >
              <span>MCU ID &amp; Telemetry First (5, 4, 3, 1, 2...)</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset([1, 7, 12, 14, 8, 2, 5, 3, 4, 11, 10, 9, 6, 13], 'VP & Values First')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-medium cursor-pointer transition-colors"
            >
              <span>VP &amp; Hex Values First (1, 7, 12, 14...)</span>
            </button>
          </div>
        </div>

        {/* Text Formula Editor */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700">
            Edit Sequence Formula (Comma-Separated Original Numbers #1..#14):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="e.g. 1, 5, 2, 3, 4, 7, 8, 12, 14, 6, 9, 10, 11, 13"
              style={{ fontSize: '15px' }}
              className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            />
            <button
              type="button"
              onClick={handleParseApplyText}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-2xs transition-colors whitespace-nowrap"
            >
              Apply Formula
            </button>
          </div>
          {parseError && (
            <p className="text-[11px] text-red-600 font-semibold">{parseError}</p>
          )}
        </div>
      </div>

      {/* Section 3: Visual Interactive Column Cards (Reorder Cards) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3" style={{ backgroundColor: '#d6e575' }}>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-emerald-50 text-emerald-700">
              <Table className="w-4 h-4" />
            </span>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800" style={{ textAlign: 'center' }}>
              3. Interactive Column Reordering Cards
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Use <strong>← / →</strong> or <strong>⇤ / ⇥</strong> to shift position
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {currentSequence.map((colNum, index) => {
            const def = HEADER_COLUMN_BY_NUM[colNum] || {
              key: `col_${colNum}`,
              originalNumber: colNum,
              name: `Column ${colNum}`,
              shortLabel: `Col ${colNum}`,
              colorName: 'slate'
            };

            const isFirst = index === 0;
            const isLast = index === currentSequence.length - 1;

            return (
              <div
                key={`col_card_${colNum}_${index}`}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5"
              >
                {/* Header: Display Position vs Original Number */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    Position #{index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-mono">Orig:</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      #{def.originalNumber}
                    </span>
                  </div>
                </div>

                {/* Column Name */}
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 line-clamp-1" style={index === 0 ? { fontSize: '14px' } : undefined}>
                    {def.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Tag: {def.shortLabel}
                  </div>
                </div>

                {/* Move Controls */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleJump(index, 'start')}
                      className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                        isFirst
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200'
                      }`}
                      title="Move to first column (Position #1)"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMove(index, 'left')}
                      className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                        isFirst
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 font-bold'
                      }`}
                      title="Move left"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 font-semibold">
                    {index + 1} of {currentSequence.length}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMove(index, 'right')}
                      className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                        isLast
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 font-bold'
                      }`}
                      title="Move right"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleJump(index, 'end')}
                      className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                        isLast
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200'
                      }`}
                      title="Move to last column (Position #14)"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Live Matrix Table Preview with Active Sequence */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-sky-50 text-sky-700">
              <Eye className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800" style={{ fontSize: '15px' }}>
                4. Live SCREEN Lab Table Preview
              </span>
              <p className="text-[11px] text-slate-500">
                This shows exactly how the columns are rendered in the SCREEN Lab Matrix Table according to your configured sequence:
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('screenlab')}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer self-start sm:self-auto"
          >
            <span>View Full SCREEN Lab →</span>
          </button>
        </div>

        {/* Live Scrollable Preview Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs max-h-72">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 text-slate-700 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                {currentSequence.map((colNum, orderIdx) => {
                  const def = HEADER_COLUMN_BY_NUM[colNum];
                  return (
                    <th
                      key={`th_preview_${colNum}_${orderIdx}`}
                      className="px-3 py-2.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap bg-slate-50"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          #{def?.originalNumber || colNum}
                        </span>
                        <span>{def?.name || `Column ${colNum}`}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {samplePreviewRows.map((row, rIdx) => (
                <tr key={`prev_row_${rIdx}`} className="hover:bg-indigo-50/20 transition-colors">
                  {currentSequence.map((colNum, colIdx) => {
                    let cellVal: React.ReactNode = '-';
                    if (colNum === 1) cellVal = <strong className="text-slate-900">{row.serialNumber}</strong>;
                    else if (colNum === 2) cellVal = <span className="text-cyan-800 font-sans font-medium">{row.device}</span>;
                    else if (colNum === 3) cellVal = <span className="text-sky-700 font-bold">{row.time}</span>;
                    else if (colNum === 4) cellVal = <span className="text-amber-700">{row.fbst}</span>;
                    else if (colNum === 5) cellVal = <span className="text-teal-700 font-bold">{row.mcuId}</span>;
                    else if (colNum === 6) cellVal = <span className="text-violet-700 font-sans">{row.screen}</span>;
                    else if (colNum === 7) cellVal = <span className="text-blue-700 font-bold">{row.vp}</span>;
                    else if (colNum === 8) cellVal = <span className="text-emerald-700 font-sans font-bold">{row.parameterName}</span>;
                    else if (colNum === 9) cellVal = <span className="text-slate-600">{row.unit}</span>;
                    else if (colNum === 10) cellVal = <span className="text-orange-700">{row.scale}</span>;
                    else if (colNum === 11) cellVal = <span className="text-purple-700 font-bold">{row.dataType}</span>;
                    else if (colNum === 12) cellVal = <span className="text-teal-800 font-bold bg-teal-50 px-1 rounded">{row.value}</span>;
                    else if (colNum === 13) cellVal = <span className="text-rose-700 font-sans">{row.readWrite}</span>;
                    else if (colNum === 14) cellVal = <span className="text-indigo-700 font-bold bg-indigo-50 px-1 rounded">{row.hexValue}</span>;

                    return (
                      <td
                        key={`prev_cell_${rIdx}_${colNum}_${colIdx}`}
                        className="px-3 py-2 border-r border-slate-100 last:border-r-0 whitespace-nowrap"
                      >
                        {cellVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
