/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useDwin } from '../../context/DwinContext';
import { Screen, Parameter, ScreenVpBinding } from '../../types/dwin';
import { 
  Layers, Plus, Check, Edit3, CheckCircle2, X, RefreshCw, 
  ArrowRight, ShieldCheck, Sparkles, LayoutGrid, Cpu, Sliders, Hash,
  FileText, Tag, Eye
} from 'lucide-react';
import industrialDashboardImg from '../../assets/images/dwin_hmi_industrial_dashboard_1793218798770.jpg';
import { RawDivCanvasTagger } from './RawDivCanvasTagger';

interface BatchConfigItem {
  screenNumber: number;
  name: string;
  vpCount: number;
  startVpAddress?: number;
  customVpAddresses?: { [index: number]: number };
}

export const ScreenLab: React.FC = () => {
  const { 
    project, 
    batchCreateScreens, 
    setSelectedScreenId, 
    setActiveTab 
  } = useDwin();

  // Active Tool inside SCREEN Lab: 'div_parser' (Raw DIV Canvas Tagger) vs 'batch_generator'
  const [activeTool, setActiveTool] = useState<'div_parser' | 'batch_generator'>('div_parser');

  const [batchStartNum, setBatchStartNum] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<number>(4);
  const [batchVpsPerScreen, setBatchVpsPerScreen] = useState<number>(3);
  const [batchGroup, setBatchGroup] = useState<string>('Operator UI');
  const [batchConfigItems, setBatchConfigItems] = useState<BatchConfigItem[]>([]);
  const [editingStartVp, setEditingStartVp] = useState<{ screenNumber: number; tempHex: string } | null>(null);
  const [editingSingleVp, setEditingSingleVp] = useState<{ screenNumber: number; vpIndex: number; tempHex: string } | null>(null);
  const [successResult, setSuccessResult] = useState<{
    screensCount: number;
    vpsCount: number;
    firstScreenId: string;
    screenNumbers: number[];
  } | null>(null);

  const formatVpHex = (addr: number): string => {
    return '0x' + addr.toString(16).padStart(4, '0').toUpperCase();
  };

  const parseHexOrDec = (inputVal: string, fallback: number): number => {
    const cleanStr = inputVal.trim();
    if (!cleanStr) return fallback;
    let num: number;
    if (cleanStr.toLowerCase().startsWith('0x')) {
      num = parseInt(cleanStr.substring(2), 16);
    } else {
      num = parseInt(cleanStr, 10);
    }
    return isNaN(num) || num < 0 || num > 0xFFFF ? fallback : num;
  };

  // Compute next available screen number
  const getNextFreeScreenNumber = (start = 0): number => {
    const existing = new Set(project.screens.map(s => s.screenNumber));
    let num = Math.max(0, start);
    while (existing.has(num)) {
      num++;
    }
    return num;
  };

  // Compute safe base VP address
  const getSafeBaseVp = (): number => {
    let highestExistingVp = 0x1000;
    project.parameters.forEach(p => {
      if (p.vpAddress > highestExistingVp) highestExistingVp = p.vpAddress;
    });
    project.screens.forEach(s => {
      s.vpBindings.forEach(b => {
        if (b.vpAddress > highestExistingVp) highestExistingVp = b.vpAddress;
      });
    });
    return Math.max(0x1050, Math.ceil((highestExistingVp + 2) / 2) * 2);
  };

  const recomputeBatchScreenItems = (start: number, count: number, vps: number) => {
    const existing = new Set(project.screens.map(s => s.screenNumber));
    const items: BatchConfigItem[] = [];
    let cur = Math.max(0, start);
    const validCount = Math.min(Math.max(1, count), 25);
    const baseVp = getSafeBaseVp();

    let idx = 0;
    while (items.length < validCount && cur < 65535) {
      if (!existing.has(cur)) {
        items.push({
          screenNumber: cur,
          name: `Screen ${cur} Overview`,
          vpCount: Math.min(Math.max(0, vps), 16),
          startVpAddress: baseVp + (idx * 0x20),
          customVpAddresses: {}
        });
        idx++;
      }
      cur++;
    }
    setBatchConfigItems(items);
  };

  // Initialize on mount
  useEffect(() => {
    const nextNum = getNextFreeScreenNumber(0);
    setBatchStartNum(nextNum);
    recomputeBatchScreenItems(nextNum, batchCount, batchVpsPerScreen);
  }, [project.screens.length]);

  const handleBatchStartNumChange = (val: number) => {
    const safeVal = Math.max(0, val);
    setBatchStartNum(safeVal);
    recomputeBatchScreenItems(safeVal, batchCount, batchVpsPerScreen);
  };

  const handleBatchCountChange = (val: number) => {
    const safeCount = Math.min(Math.max(1, val), 25);
    setBatchCount(safeCount);
    recomputeBatchScreenItems(batchStartNum, safeCount, batchVpsPerScreen);
  };

  const handleBatchVpsChange = (val: number) => {
    const safeVps = Math.min(Math.max(0, val), 16);
    setBatchVpsPerScreen(safeVps);
    setBatchConfigItems(prev => prev.map(item => ({ ...item, vpCount: safeVps })));
  };

  const handleUpdateItemVpCount = (screenNumber: number, vpCount: number) => {
    const safeVp = Math.min(Math.max(0, vpCount), 16);
    setBatchConfigItems(prev => prev.map(item => item.screenNumber === screenNumber ? { ...item, vpCount: safeVp } : item));
  };

  const handleUpdateItemName = (screenNumber: number, name: string) => {
    setBatchConfigItems(prev => prev.map(item => item.screenNumber === screenNumber ? { ...item, name } : item));
  };

  const handleSaveStartVp = (screenNumber: number, hexStr: string) => {
    const item = batchConfigItems.find(it => it.screenNumber === screenNumber);
    const fallback = item?.startVpAddress || 0x1050;
    const parsed = parseHexOrDec(hexStr, fallback);

    setBatchConfigItems(prev => prev.map(it => {
      if (it.screenNumber === screenNumber) {
        return {
          ...it,
          startVpAddress: parsed,
          customVpAddresses: {}
        };
      }
      return it;
    }));
    setEditingStartVp(null);
  };

  const handleSaveSingleVp = (screenNumber: number, vpIndex: number, hexStr: string) => {
    const item = batchConfigItems.find(it => it.screenNumber === screenNumber);
    const fallback = (item?.startVpAddress || 0x1050) + (vpIndex * 2);
    const parsed = parseHexOrDec(hexStr, fallback);

    setBatchConfigItems(prev => prev.map(it => {
      if (it.screenNumber === screenNumber) {
        return {
          ...it,
          customVpAddresses: {
            ...(it.customVpAddresses || {}),
            [vpIndex]: parsed
          }
        };
      }
      return it;
    }));
    setEditingSingleVp(null);
  };

  const handleResetToAuto = () => {
    const nextNum = getNextFreeScreenNumber(0);
    setBatchStartNum(nextNum);
    setBatchCount(4);
    setBatchVpsPerScreen(3);
    setBatchGroup('Operator UI');
    setEditingStartVp(null);
    setEditingSingleVp(null);
    setSuccessResult(null);
    recomputeBatchScreenItems(nextNum, 4, 3);
  };

  const handleExecuteBatchCreateScreens = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchConfigItems.length === 0) return;

    const newScreensData: Omit<Screen, 'id' | 'updatedAt'>[] = [];
    const newParametersData: Omit<Parameter, 'id' | 'updatedAt'>[] = [];

    batchConfigItems.forEach(item => {
      const screenVpBindings: ScreenVpBinding[] = [];
      const baseStartAddr = item.startVpAddress || (0x1050 + item.screenNumber * 0x20);

      for (let v = 0; v < item.vpCount; v++) {
        const vpAddr = item.customVpAddresses?.[v] !== undefined
          ? item.customVpAddresses[v]
          : (baseStartAddr + (v * 2));

        const bindingId = `bind_lab_${Date.now()}_${item.screenNumber}_${v}_${Math.random().toString(36).substring(2, 6)}`;
        const paramName = `${item.name} VP${v + 1}`;

        screenVpBindings.push({
          id: bindingId,
          vpAddress: vpAddr,
          role: 'data_display',
          label: paramName,
          x: 40 + (v % 4) * 160,
          y: 80 + Math.floor(v / 4) * 60,
          width: 140,
          height: 44
        });

        newParametersData.push({
          vpAddress: vpAddr,
          name: paramName,
          identifier: `SCR${item.screenNumber}_VP${formatVpHex(vpAddr).replace('0x', '')}`,
          dataType: 'UINT16',
          words: 1,
          unit: '',
          scale: 1,
          min: 0,
          max: 65535,
          defaultValue: 0,
          role: 'read_write',
          group: batchGroup || 'Operator UI',
          description: `Generated in SCREEN Lab for Screen #${item.screenNumber} (VP ${formatVpHex(vpAddr)}).`
        });
      }

      newScreensData.push({
        screenNumber: item.screenNumber,
        name: item.name.trim() || `Screen ${item.screenNumber}`,
        group: batchGroup || 'Operator UI',
        resolution: project.resolution,
        bgImageIndex: item.screenNumber,
        bgImageUrl: project.screens[0]?.bgImageUrl || industrialDashboardImg,
        description: `Auto-generated Screen #${item.screenNumber} in SCREEN Lab with ${item.vpCount} VP bindings.`,
        vpBindings: screenVpBindings,
        navigations: []
      });
    });

    const created = batchCreateScreens(newScreensData, newParametersData);

    const firstId = created[0]?.id || '';
    if (firstId) {
      setSelectedScreenId(firstId);
    }

    setSuccessResult({
      screensCount: created.length,
      vpsCount: newParametersData.length,
      firstScreenId: firstId,
      screenNumbers: created.map(s => s.screenNumber)
    });
  };

  const totalVpsPlanned = batchConfigItems.reduce((acc, it) => acc + it.vpCount, 0);

  return (
    <div className="space-y-6 max-w-full">
      {activeTool === 'div_parser' ? (
        <RawDivCanvasTagger />
      ) : (
        <>
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-900">Batch Screen &amp; VP Matrix Architect</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTool('div_parser')}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold cursor-pointer transition-colors"
            >
              ← Back to Raw DIV Canvas Tagger
            </button>
          </div>
          {/* Success Notification Banner */}
          {successResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs shadow-xs animate-in fade-in space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Batch Generation Successful! Created {successResult.screensCount} Screens &amp; {successResult.vpsCount} VPs.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessResult(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded hover:bg-emerald-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-emerald-800">
                Generated screens ({successResult.screenNumbers.map(n => `#${n}`).join(', ')}) with allocated VP registers have been added to the project.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('screens')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs cursor-pointer transition-colors"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>View in Screen Registry →</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('parameters')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-semibold shadow-2xs cursor-pointer transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>View in Parameter Registry →</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToAuto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-emerald-800 hover:bg-emerald-100 font-medium transition-colors cursor-pointer ml-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Prepare Another Batch</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Configuration Card & Form */}
          <form onSubmit={handleExecuteBatchCreateScreens} className="space-y-5">
        {/* Step 1: Generator Parameters */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                1. Batch Generation Parameters
              </h2>
            </div>
            <button
              type="button"
              onClick={handleResetToAuto}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
              title="Reset inputs and auto-detect next available values"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Auto-Detect Next</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Start Screen Number */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold">
                Start Screen # (Pic ID)
              </label>
              <input
                type="number"
                min="0"
                max="65535"
                value={batchStartNum}
                onChange={e => handleBatchStartNumChange(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                required
              />
              <span className="text-[11px] text-slate-400 block">
                Starting screen Pic ID index.
              </span>
            </div>

            {/* Total Screens Count */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold">
                Screen Count to Create
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={batchCount}
                onChange={e => handleBatchCountChange(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                required
              />
              <div className="flex items-center gap-1.5 pt-1">
                {[2, 4, 6, 8, 12].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleBatchCountChange(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                      batchCount === preset
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* VPs per Screen */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold">
                Default VPs per Screen
              </label>
              <input
                type="number"
                min="0"
                max="16"
                value={batchVpsPerScreen}
                onChange={e => handleBatchVpsChange(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                required
              />
              <div className="flex items-center gap-1.5 pt-1">
                {[0, 2, 4, 6, 8].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleBatchVpsChange(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                      batchVpsPerScreen === preset
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Group Category */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold">
                Group / Category
              </label>
              <input
                type="text"
                value={batchGroup}
                onChange={e => setBatchGroup(e.target.value)}
                placeholder="e.g. Operator UI, Settings..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                {['Operator UI', 'Settings', 'Diagnostics', 'Alarms'].map(grp => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setBatchGroup(grp)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border transition-colors ${
                      batchGroup === grp
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Smart collision indicator */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900">
                Safe Address Collision Avoidance Guard
              </span>
              <p className="text-slate-600">
                Existing screen numbers ({project.screens.map(s => `#${s.screenNumber}`).join(', ') || 'None'}) are skipped automatically. VPs are spaced with 2-word steps to prevent word-boundary overlaps.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Live Interactive Allocation Plan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                2. Live Screen &amp; VP Allocation Plan
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Plan Summary:</span>
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                {batchConfigItems.length} Screens
              </span>
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {totalVpsPlanned} Total VPs
              </span>
            </div>
          </div>

          {/* Allocation Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse min-w-[820px]">
                <thead className="bg-slate-100/90 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                  <tr>
                    <th className="py-3 px-3.5 whitespace-nowrap">Screen #</th>
                    <th className="py-3 px-4 min-w-[280px]">Screen Title</th>
                    <th className="py-3 px-3 w-32 whitespace-nowrap">VPs Count</th>
                    <th className="py-3 px-4 min-w-[380px]">
                      <div className="flex items-center gap-2">
                        <span>Allocated VP Addresses</span>
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded">
                          Click VP Pill to Edit
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {batchConfigItems.map((item) => (
                    <tr key={item.screenNumber} className="hover:bg-slate-50/80 transition-colors">
                      {/* Screen Number Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs">
                          Screen #{item.screenNumber}
                        </span>
                      </td>

                      {/* Screen Title */}
                      <td className="py-3 px-4 min-w-[280px]">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateItemName(item.screenNumber, e.target.value)}
                          placeholder={`Screen ${item.screenNumber} title...`}
                          className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-900 shadow-2xs transition-all"
                        />
                      </td>

                      {/* VPs Count */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="16"
                            value={item.vpCount}
                            onChange={e => handleUpdateItemVpCount(item.screenNumber, parseInt(e.target.value) || 0)}
                            className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-center font-bold text-xs"
                          />
                          <span className="text-slate-400 font-medium">VPs</span>
                        </div>
                      </td>

                      {/* VP Address Allocation */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Starting VP Address Box with Inline Edit */}
                          {editingStartVp?.screenNumber === item.screenNumber ? (
                            <div className="flex items-center gap-1 bg-white border-2 border-indigo-500 rounded-lg px-2 py-1 shadow-xs shrink-0">
                              <span className="text-[10px] uppercase font-bold text-indigo-600 shrink-0">Start VP:</span>
                              <input
                                type="text"
                                autoFocus
                                value={editingStartVp.tempHex}
                                onChange={e => setEditingStartVp({ screenNumber: item.screenNumber, tempHex: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveStartVp(item.screenNumber, editingStartVp.tempHex);
                                  } else if (e.key === 'Escape') {
                                    setEditingStartVp(null);
                                  }
                                }}
                                className="w-20 font-mono font-bold text-xs text-indigo-950 bg-indigo-50/60 px-1 py-0.5 rounded focus:outline-none text-center"
                                placeholder="0x1050"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveStartVp(item.screenNumber, editingStartVp.tempHex)}
                                className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                                title="Save Start VP"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStartVp(null)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-1.5 bg-indigo-50/90 border border-indigo-300/80 rounded-lg px-2.5 py-1 shadow-2xs hover:border-indigo-500 transition-all shrink-0 group"
                              title="Click edit button to change starting VP address for this screen"
                            >
                              <span className="text-[10px] uppercase font-bold text-indigo-500 shrink-0">Start VP:</span>
                              <span className="w-18 font-mono font-bold text-xs text-indigo-950 text-center">
                                {formatVpHex(item.startVpAddress || 0x1050)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingStartVp({ screenNumber: item.screenNumber, tempHex: formatVpHex(item.startVpAddress || 0x1050) })}
                                className="p-1 rounded text-indigo-500 hover:text-indigo-800 hover:bg-indigo-200/60 transition-colors cursor-pointer group-hover:text-indigo-700"
                                title="Edit starting VP address"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <span className="text-slate-400 font-bold text-xs shrink-0">→</span>

                          {/* Individual Allocated VPs with inline edit */}
                          {item.vpCount > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                              {Array.from({ length: item.vpCount }).map((_, vIdx) => {
                                const currentAddr = item.customVpAddresses?.[vIdx] ?? ((item.startVpAddress || 0x1050) + vIdx * 2);
                                const isEditingThisVp = editingSingleVp?.screenNumber === item.screenNumber && editingSingleVp?.vpIndex === vIdx;

                                if (isEditingThisVp) {
                                  return (
                                    <div
                                      key={vIdx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white border-2 border-emerald-500 shadow-xs"
                                    >
                                      <span className="text-[10px] text-emerald-700 font-sans font-bold">#{vIdx + 1}</span>
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editingSingleVp.tempHex}
                                        onChange={e => setEditingSingleVp({ screenNumber: item.screenNumber, vpIndex: vIdx, tempHex: e.target.value })}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveSingleVp(item.screenNumber, vIdx, editingSingleVp.tempHex);
                                          } else if (e.key === 'Escape') {
                                            setEditingSingleVp(null);
                                          }
                                        }}
                                        className="w-18 font-mono font-bold text-xs text-emerald-950 bg-emerald-50/60 px-1 py-0.5 rounded focus:outline-none text-center"
                                        placeholder="0x1050"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveSingleVp(item.screenNumber, vIdx, editingSingleVp.tempHex)}
                                        className="p-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                                        title={`Save VP #${vIdx + 1} Address`}
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingSingleVp(null)}
                                        className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                }

                                const hasCustom = item.customVpAddresses?.[vIdx] !== undefined;

                                return (
                                  <span
                                    key={vIdx}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono font-bold text-xs border shadow-2xs transition-colors ${
                                      hasCustom 
                                        ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400'
                                    }`}
                                    title={`Screen #${item.screenNumber} VP #${vIdx + 1}: ${formatVpHex(currentAddr)}${hasCustom ? ' (Manually customized)' : ''}`}
                                  >
                                    <span className={`text-[9px] font-sans font-semibold ${hasCustom ? 'text-amber-700' : 'text-emerald-600/80'}`}>
                                      #{vIdx + 1}
                                    </span>
                                    <span>{formatVpHex(currentAddr)}</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSingleVp({ screenNumber: item.screenNumber, vpIndex: vIdx, tempHex: formatVpHex(currentAddr) })}
                                      className={`p-0.5 ml-0.5 rounded transition-colors cursor-pointer ${
                                        hasCustom
                                          ? 'text-amber-700 hover:text-amber-950 hover:bg-amber-200/70'
                                          : 'text-emerald-600 hover:text-emerald-950 hover:bg-emerald-200/70'
                                      }`}
                                      title={`Edit VP #${vIdx + 1} Address`}
                                    >
                                      <Edit3 className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs font-sans">No VPs allocated</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-800">Instant DGUS Sync: </span>
              All created screens and VP parameters are immediately registered in Screen Registry and Parameter Registry.
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetToAuto}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                Reset Plan
              </button>
              <button
                type="submit"
                disabled={batchConfigItems.length === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 tracking-wide"
              >
                <Layers className="w-4 h-4 text-indigo-100" />
                <span>
                  Auto Generate {batchConfigItems.length} Screens ({totalVpsPlanned} VPs)
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>
        </>
      )}
    </div>
  );
};
