/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useDwin } from '../../context/DwinContext';
import { 
  generateDwinFrame, 
  decodeDwinFrame, 
  compareHexFrames, 
  formatVpHex 
} from '../../utils/hexEngine';
import { ProtocolMode, DecodedFrame, Screen, ScreenVpBinding, Parameter } from '../../types/dwin';
import { 
  Binary, Copy, Check, ArrowRight, AlertTriangle, 
  CheckCircle2, Sliders, ExternalLink, Cpu, Monitor, Layers,
  Eye, EyeOff, X, Edit3
} from 'lucide-react';
import industrialDashboardImg from '../../assets/images/dwin_hmi_industrial_dashboard_1793218798770.jpg';

export const HexLab: React.FC = () => {
  const { project, hexLabPrefill, setHexLabPrefill, batchCreateScreens } = useDwin();

  // Active sub-tab
  const [subTab, setSubTab] = useState<'generator' | 'decoder' | 'comparator'>('generator');

  // Screen selection inside Hex Lab
  const [hexSelectedScreenId, setHexSelectedScreenId] = useState<string>(project.screens[0]?.id || '');
  const hexSelectedScreen = project.screens.find(s => s.id === hexSelectedScreenId) || project.screens[0];
  const hexScreenVps = hexSelectedScreen?.vpBindings || [];

  // Toggle visibility for VP Screen Cards window
  const [showVpCards, setShowVpCards] = useState<boolean>(true);

  // Batch screen creator form state inside HEX Lab
  const [isBatchScreenModalOpen, setIsBatchScreenModalOpen] = useState(false);
  const [batchStartNum, setBatchStartNum] = useState(0);
  const [batchCount, setBatchCount] = useState(3);
  const [batchVpsPerScreen, setBatchVpsPerScreen] = useState(3);
  const [batchGroup, setBatchGroup] = useState('Operator UI');
  const [batchConfigItems, setBatchConfigItems] = useState<{
    screenNumber: number;
    name: string;
    vpCount: number;
    startVpAddress: number;
    customVpAddresses?: Record<number, number>;
  }[]>([]);
  const [batchScreenSuccessMessage, setBatchScreenSuccessMessage] = useState('');
  const [editingStartVp, setEditingStartVp] = useState<{ screenNumber: number; tempHex: string } | null>(null);
  const [editingSingleVp, setEditingSingleVp] = useState<{ screenNumber: number; vpIndex: number; tempHex: string } | null>(null);

  const recomputeBatchScreenItems = (start: number, count: number, vps: number) => {
    const items: {
      screenNumber: number;
      name: string;
      vpCount: number;
      startVpAddress: number;
      customVpAddresses?: Record<number, number>;
    }[] = [];
    const existing = new Set(project.screens.map(s => s.screenNumber));
    let cur = Math.max(0, start);
    const validCount = Math.min(Math.max(1, count), 20);

    let highestExistingVp = 0x1000;
    project.parameters.forEach(p => {
      if (p.vpAddress > highestExistingVp) highestExistingVp = p.vpAddress;
    });
    project.screens.forEach(s => {
      s.vpBindings.forEach(b => {
        if (b.vpAddress > highestExistingVp) highestExistingVp = b.vpAddress;
      });
    });
    const baseVp = Math.max(0x1050, Math.ceil((highestExistingVp + 2) / 2) * 2);

    let idx = 0;
    while (items.length < validCount && cur < 65535) {
      if (!existing.has(cur)) {
        items.push({
          screenNumber: cur,
          name: `Screen ${cur}`,
          vpCount: Math.min(Math.max(0, vps), 16),
          startVpAddress: baseVp + idx * 0x20,
          customVpAddresses: {}
        });
        idx++;
      }
      cur++;
    }
    setBatchConfigItems(items);
  };

  const handleOpenBatchScreenCreator = () => {
    const existing = new Set(project.screens.map(s => s.screenNumber));
    let nextNum = 0;
    while (existing.has(nextNum)) {
      nextNum++;
    }
    setBatchStartNum(nextNum);
    setBatchCount(3);
    setBatchVpsPerScreen(3);
    setBatchGroup('Operator UI');
    recomputeBatchScreenItems(nextNum, 3, 3);
    setIsBatchScreenModalOpen(true);
  };

  const handleBatchStartNumChange = (val: number) => {
    setBatchStartNum(val);
    recomputeBatchScreenItems(val, batchCount, batchVpsPerScreen);
  };

  const handleBatchCountChange = (val: number) => {
    const safeCount = Math.min(Math.max(1, val), 20);
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

  const parseHexOrDec = (inputVal: string, fallback: number): number => {
    const cleanStr = inputVal.trim();
    if (!cleanStr) return fallback;
    let num: number;
    if (cleanStr.toLowerCase().startsWith('0x')) {
      num = parseInt(cleanStr.substring(2), 16);
    } else {
      num = parseInt(cleanStr, 16);
    }
    return isNaN(num) || num < 0 || num > 0xFFFF ? fallback : num;
  };

  const handleSaveStartVp = (screenNumber: number, inputVal: string) => {
    const parsedAddr = parseHexOrDec(inputVal, 0x1050);
    setBatchConfigItems(prev => prev.map(item => {
      if (item.screenNumber === screenNumber) {
        return {
          ...item,
          startVpAddress: parsedAddr,
          customVpAddresses: {}
        };
      }
      return item;
    }));
    setEditingStartVp(null);
  };

  const handleSaveSingleVp = (screenNumber: number, vpIndex: number, inputVal: string) => {
    const targetItem = batchConfigItems.find(it => it.screenNumber === screenNumber);
    const defaultAddr = (targetItem?.startVpAddress || 0x1050) + vpIndex * 2;
    const parsedAddr = parseHexOrDec(inputVal, defaultAddr);

    setBatchConfigItems(prev => prev.map(item => {
      if (item.screenNumber === screenNumber) {
        const nextCustom = { ...(item.customVpAddresses || {}) };
        nextCustom[vpIndex] = parsedAddr;
        return {
          ...item,
          customVpAddresses: nextCustom
        };
      }
      return item;
    }));
    setEditingSingleVp(null);
  };

  const handleExecuteBatchCreateScreens = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchConfigItems.length === 0) return;

    const newScreensData: Omit<Screen, 'id' | 'updatedAt'>[] = [];
    const newParametersData: Omit<Parameter, 'id' | 'updatedAt'>[] = [];

    batchConfigItems.forEach((item, screenIdx) => {
      const screenVpBindings: ScreenVpBinding[] = [];
      const baseVp = item.startVpAddress || (0x1050 + screenIdx * 0x20);

      for (let v = 1; v <= item.vpCount; v++) {
        const vIdx = v - 1;
        const vpAddr = item.customVpAddresses?.[vIdx] !== undefined 
          ? item.customVpAddresses[vIdx] 
          : (baseVp + vIdx * 2);
        const col = vIdx % 3;
        const row = Math.floor(vIdx / 3);
        const posX = 100 + col * 200;
        const posY = 100 + row * 70;

        screenVpBindings.push({
          id: 'b_' + Date.now().toString(36) + '_' + screenIdx + '_' + v,
          vpAddress: vpAddr,
          role: 'data_display',
          label: `${item.name || 'Screen ' + item.screenNumber} - VP ${v} (${formatVpHex(vpAddr)})`,
          x: posX,
          y: posY,
          width: 140,
          height: 44,
          notes: `Auto-generated VP #${v} for Screen #${item.screenNumber} at ${formatVpHex(vpAddr)}.`
        });

        newParametersData.push({
          name: `${item.name || 'Screen ' + item.screenNumber} Val ${v}`,
          identifier: `SCR${item.screenNumber}_VP${formatVpHex(vpAddr).replace('0x','')}`,
          vpAddress: vpAddr,
          dataType: 'UINT16',
          words: 1,
          unit: '',
          scale: 1,
          min: 0,
          max: 65535,
          defaultValue: 0,
          role: 'read_write',
          group: batchGroup || 'Operator UI',
          description: `Auto-generated parameter for Screen #${item.screenNumber} (VP ${formatVpHex(vpAddr)}).`
        });
      }

      newScreensData.push({
        screenNumber: item.screenNumber,
        name: item.name.trim() || `Screen ${item.screenNumber}`,
        group: batchGroup || 'Operator UI',
        resolution: project.resolution,
        bgImageIndex: item.screenNumber,
        bgImageUrl: industrialDashboardImg,
        description: `Auto-generated Screen #${item.screenNumber} with ${item.vpCount} VP bindings.`,
        vpBindings: screenVpBindings,
        navigations: []
      });
    });

    const created = batchCreateScreens(newScreensData, newParametersData);
    setBatchScreenSuccessMessage(`Successfully generated ${created.length} screens and ${newParametersData.length} VPs!`);
    
    setTimeout(() => {
      setIsBatchScreenModalOpen(false);
      setBatchScreenSuccessMessage('');
      if (created.length > 0) {
        setHexSelectedScreenId(created[0].id);
      }
    }, 1200);
  };

  // Generator states
  const [selectedParamVp, setSelectedParamVp] = useState<number>(0x1000);
  const [genCmd, setGenCmd] = useState<number>(0x82);
  const [genValInput, setGenValInput] = useState<string>('100000');
  const [genDataType, setGenDataType] = useState<string>('UINT32');
  const [genWordCount, setGenWordCount] = useState<number>(2);
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>('standard_dgus2');
  const [customVp, setCustomVp] = useState<string>('0x1000');
  const [useCustomVp, setUseCustomVp] = useState<boolean>(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Decoder states
  const [rawHexInput, setRawHexInput] = useState<string>('5A A5 07 82 10 00 00 01 86 A0');
  const [decodedResult, setDecodedResult] = useState<DecodedFrame | null>(null);

  // Comparator states
  const [expectedHex, setExpectedHex] = useState<string>('5A A5 08 83 10 00 02 00 01 86 A0');
  const [actualHex, setActualHex] = useState<string>('5A A5 06 83 10 00 00 01 86 A0');

  // Handle prefill from other tabs or presets
  useEffect(() => {
    if (hexLabPrefill) {
      if (hexLabPrefill.mode) {
        setSubTab(hexLabPrefill.mode);
      }
      if (hexLabPrefill.vpAddress !== undefined) {
        setSelectedParamVp(hexLabPrefill.vpAddress);
        setCustomVp(formatVpHex(hexLabPrefill.vpAddress));
        const matched = project.parameters.find(p => p.vpAddress === hexLabPrefill.vpAddress);
        if (matched) {
          setGenDataType(matched.dataType);
          setGenWordCount(matched.words);
        }
      }
      if (hexLabPrefill.value !== undefined) {
        setGenValInput(String(hexLabPrefill.value));
      }
      if (hexLabPrefill.cmd !== undefined) {
        setGenCmd(hexLabPrefill.cmd);
      }
      if (hexLabPrefill.presetHex) {
        setRawHexInput(hexLabPrefill.presetHex);
      }
      // Reset prefill
      setHexLabPrefill(null);
    }
  }, [hexLabPrefill, project.parameters, setHexLabPrefill]);

  // Real-time generation calculation
  const targetVpNumber = useCustomVp 
    ? (parseInt(customVp.replace(/^0x/i, ''), 16) || 0x1000)
    : selectedParamVp;

  const generated = generateDwinFrame({
    header: project.headerHex || '5A A5',
    command: genCmd,
    vpAddress: targetVpNumber,
    dataType: genDataType,
    value: genValInput,
    wordCount: genWordCount,
    protocolMode
  });

  // Decode input whenever rawHexInput changes
  useEffect(() => {
    const res = decodeDwinFrame(rawHexInput, project.parameters);
    setDecodedResult(res);
  }, [rawHexInput, project.parameters]);

  // Comparator result
  const compareResult = compareHexFrames(expectedHex, actualHex);

  const handleCopy = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'header': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'length': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'command': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'vp': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'word_count': return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'data': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            HEX Lab &amp; Protocol Codec
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Construct serial frames, dissect arbitrary byte streams, validate length consistency, and execute bitwise comparisons.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => setSubTab('generator')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'generator'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Frame Generator
          </button>
          <button
            onClick={() => setSubTab('decoder')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'decoder'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Frame Decoder &amp; Diagnostics
          </button>
          <button
            onClick={() => setSubTab('comparator')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'comparator'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Byte Comparator
          </button>
        </div>
      </div>

      {/* ========================================================
          SUB-TAB 1: FRAME GENERATOR
          ======================================================== */}
      {subTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.2fr] gap-6">
          {/* COLUMN 1: Frame Configuration */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs self-start">
            <h2 className="text-sm font-semibold text-slate-900">
              Frame Configuration
            </h2>

            {/* Screen Dropdown Selector inside HEX Lab */}
            <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900 flex items-center justify-between w-full">
                  <span>Select Screen (Dropdown by Address):</span>
                  <span className="text-[11px] font-mono text-blue-700 font-bold">
                    0x{hexSelectedScreen?.screenNumber.toString(16).padStart(4, '0').toUpperCase()}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={hexSelectedScreenId}
                  onChange={e => {
                    const screenId = e.target.value;
                    setHexSelectedScreenId(screenId);
                    const targetScreen = project.screens.find(s => s.id === screenId);
                    if (targetScreen && targetScreen.vpBindings.length > 0) {
                      const firstVp = targetScreen.vpBindings[0].vpAddress;
                      setSelectedParamVp(firstVp);
                      setCustomVp(formatVpHex(firstVp));
                      const p = project.parameters.find(item => item.vpAddress === firstVp);
                      if (p) {
                        setGenValInput(String(p.defaultValue));
                        setGenDataType(p.dataType);
                        setGenWordCount(p.words);
                        setGenCmd(p.role === 'read_only' ? 0x83 : 0x82);
                      }
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-md border border-blue-300 bg-white text-slate-900 font-mono font-medium focus:ring-1 focus:ring-blue-500 shadow-2xs min-w-0"
                >
                  {project.screens.map(s => (
                    <option key={s.id} value={s.id}>
                      Screen #{s.screenNumber} (0x{s.screenNumber.toString(16).padStart(4, '0').toUpperCase()}) — {s.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleOpenBatchScreenCreator}
                  className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-md transition-colors whitespace-nowrap shadow-2xs flex items-center gap-1.5 shrink-0"
                  title="Batch Screen Creator: auto-generate multiple screens and VPs"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Batch Screen Creator</span>
                </button>
              </div>
            </div>

            {/* Parameter Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Target Parameter / VP
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomVp(!useCustomVp)}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  {useCustomVp ? 'Pick from Registry' : 'Enter Custom VP'}
                </button>
              </div>

              {useCustomVp ? (
                <input
                  type="text"
                  value={customVp}
                  onChange={e => setCustomVp(e.target.value)}
                  placeholder="0x1000"
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                />
              ) : (
                <select
                  value={selectedParamVp}
                  onChange={e => {
                    const vp = Number(e.target.value);
                    setSelectedParamVp(vp);
                    const p = project.parameters.find(item => item.vpAddress === vp);
                    if (p) {
                      setGenValInput(String(p.defaultValue));
                      setGenDataType(p.dataType);
                      setGenWordCount(p.words);
                      setGenCmd(p.role === 'read_only' ? 0x83 : 0x82);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                >
                  {project.parameters.map(p => (
                    <option key={p.id} value={p.vpAddress}>
                      {formatVpHex(p.vpAddress)}: {p.name} ({p.dataType})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Command Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                DWIN Command Code
              </label>
              <select
                value={genCmd}
                onChange={e => setGenCmd(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
              >
                <option value={0x82}>0x82: Write to VP (RAM / Variable memory)</option>
                <option value={0x83}>0x83: Read from VP (RAM / Variable memory)</option>
                <option value={0x80}>0x80: Write System Register</option>
                <option value={0x81}>0x81: Read System Register</option>
              </select>
            </div>

            {/* Value Input (for Write commands) */}
            {genCmd === 0x82 || genCmd === 0x80 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Data Type
                    </label>
                    <select
                      value={genDataType}
                      onChange={e => setGenDataType(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                    >
                      <option value="UINT16">UINT16 (2 bytes)</option>
                      <option value="INT16">INT16 (Signed)</option>
                      <option value="UINT32">UINT32 (4 bytes)</option>
                      <option value="INT32">INT32 (Signed 4B)</option>
                      <option value="FLOAT32">FLOAT32 (IEEE-754)</option>
                      <option value="STRING">STRING (ASCII)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 font-mono">
                      Payload Value
                    </label>
                    <input
                      type="text"
                      value={genValInput}
                      onChange={e => setGenValInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Test Vectors:</span>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParamVp(0x1000);
                        setCustomVp('0x1000');
                        setGenCmd(0x82);
                        setGenDataType('UINT32');
                        setGenValInput('100000');
                      }}
                      className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-[11px] font-mono"
                    >
                      Write 100,000 (0x1000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParamVp(0x1002);
                        setCustomVp('0x1002');
                        setGenCmd(0x82);
                        setGenDataType('INT16');
                        setGenValInput('248');
                      }}
                      className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-[11px] font-mono"
                    >
                      24.8 °C (0x1002)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomVp(true);
                        setCustomVp('0x0084');
                        setGenCmd(0x82);
                        setGenDataType('UINT32');
                        setGenValInput('150994946'); // 0x5A010002 for Screen 2
                      }}
                      className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-[11px] font-mono"
                    >
                      Page Switch VP 0x0084
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 font-mono">
                  Word Count to Read
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={genWordCount}
                  onChange={e => setGenWordCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Reads {genWordCount} words ({genWordCount * 2} bytes) from VP {formatVpHex(targetVpNumber)}.
                </span>
              </div>
            )}
          </div>

          {/* COLUMN 2: VP Screen Cards Window (Middle Column) */}
          <div className={`bg-white border border-slate-200 rounded-lg shadow-xs self-start transition-all ${
            showVpCards ? 'p-5 space-y-4' : 'p-3 space-y-0'
          }`}>
            <div className={`flex items-center justify-between gap-2 ${
              showVpCards ? 'border-b border-slate-200 pb-3' : ''
            }`}>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span>VPs on Screen #{hexSelectedScreen.screenNumber} ({hexScreenVps.length} VPs)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any VP card below to auto-load parameters.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded font-mono font-semibold border border-blue-200 shrink-0">
                  {hexSelectedScreen.name}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVpCards(!showVpCards)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors shadow-2xs ${
                    showVpCards
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                  }`}
                  title={showVpCards ? 'Hide VP Cards' : 'Show VP Cards'}
                >
                  {showVpCards ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {showVpCards && (
              hexScreenVps.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 max-h-[560px] overflow-y-auto pr-1">
                  {hexScreenVps.map(vp => {
                    const param = project.parameters.find(p => p.vpAddress === vp.vpAddress);
                    const quickHex = param 
                      ? generateDwinFrame({ header: project.headerHex || '5A A5', command: 0x82, vpAddress: vp.vpAddress, value: param.defaultValue, dataType: param.dataType, protocolMode }).rawHex
                      : `5A A5 05 82 ${(vp.vpAddress >> 8).toString(16).padStart(2, '0').toUpperCase()} ${(vp.vpAddress & 0xff).toString(16).padStart(2, '0').toUpperCase()} 00 00`;
                    const isCurrentlySelected = targetVpNumber === vp.vpAddress;

                    return (
                      <div
                        key={vp.id}
                        onClick={() => {
                          setSelectedParamVp(vp.vpAddress);
                          setCustomVp(formatVpHex(vp.vpAddress));
                          if (param) {
                            setGenValInput(String(param.defaultValue));
                            setGenDataType(param.dataType);
                            setGenWordCount(param.words);
                            setGenCmd(param.role === 'read_only' ? 0x83 : 0x82);
                          }
                        }}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all space-y-2 flex flex-col justify-between ${
                          isCurrentlySelected
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-blue-300 bg-slate-50/70 hover:bg-white'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <span 
                            style={{ fontSize: '14px' }}
                            className="font-mono font-bold text-[14px] px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs"
                          >
                            {formatVpHex(vp.vpAddress)}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 font-semibold uppercase tracking-wider shrink-0">
                            {vp.role.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Card Details */}
                        <div>
                          <div className="font-bold text-slate-900 text-xs line-clamp-1" title={vp.label}>
                            {vp.label}
                          </div>
                          {param && (
                            <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                              {param.identifier} · <span className="font-semibold text-blue-700">{param.dataType}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 text-[11px]">
                          <div className="font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                            {quickHex}
                          </div>
                          <button
                            type="button"
                            className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-2xs transition-colors shrink-0 flex items-center gap-1"
                          >
                            <span>Load</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  No Variable Pointers bound to Screen #{hexSelectedScreen.screenNumber} yet.
                </div>
              )
            )}
          </div>

          {/* COLUMN 3: Generated HEX Frame Stream (Wider 1.2fr Column) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs self-start">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Generated HEX Frame Stream
              </h3>
              <span className="font-mono text-xs text-slate-500">
                Total: {generated.bytes.length} bytes
              </span>
            </div>

            {/* Raw Hex Box */}
            <div className="p-3.5 bg-slate-100 rounded-lg border-2 border-slate-300 font-mono text-sm sm:text-base font-bold tracking-wider text-blue-900 select-all overflow-x-auto shadow-inner break-all">
              {generated.rawHex}
            </div>

            {/* Color-Coded Byte Block Dissection */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-2">
                Byte Sequence Structural Breakdown:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {generated.dissection.map(item => (
                  <div
                    key={item.index}
                    className={`px-2.5 py-1.5 rounded border text-center font-mono ${getRoleBadgeColor(item.role)}`}
                    title={`${item.description} (Index ${item.index})`}
                  >
                    <div className="text-sm font-bold">{item.hex}</div>
                    <div className="text-[9px] uppercase tracking-wider opacity-80">{item.role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy Format Bar */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <span className="text-xs font-medium text-slate-700 block">
                Export Packet Code:
              </span>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleCopy(generated.rawHex, 'raw')}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedFormat === 'raw' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Raw HEX String</span>
                </button>

                <button
                  onClick={() => {
                    const cArr = `const uint8_t dwin_pkt[] = { ${generated.bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ')} };`;
                    handleCopy(cArr, 'c');
                  }}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedFormat === 'c' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>C/C++ Array</span>
                </button>

                <button
                  onClick={() => {
                    const py = `b'${generated.bytes.map(b => '\\x' + b.toString(16).padStart(2, '0').toUpperCase()).join('')}'`;
                    handleCopy(py, 'py');
                  }}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedFormat === 'py' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Python Bytes</span>
                </button>
              </div>
            </div>

            {/* Actions to forward */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setRawHexInput(generated.rawHex);
                  setSubTab('decoder');
                }}
                className="w-full px-3.5 py-1.5 text-xs rounded bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Send to Decoder</span>
              </button>
              <button
                onClick={() => {
                  setExpectedHex(generated.rawHex);
                  setSubTab('comparator');
                }}
                className="w-full px-3.5 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium flex items-center justify-center gap-1.5"
              >
                <span>Set as Expected in Comparator</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: FRAME DECODER & ANOMALY DIAGNOSTIC
          ======================================================== */}
      {subTab === 'decoder' && (
        <div className="space-y-6">
          {/* Input & Preset Buttons */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Inspect &amp; Decode HEX Frame
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Paste Raw Byte Stream (supports space-delimited, commas, or 0x prefixes):
              </label>
              <textarea
                rows={2}
                value={rawHexInput}
                onChange={e => setRawHexInput(e.target.value)}
                placeholder="e.g. 5A A5 07 82 10 00 00 01 86 A0"
                className="w-full p-3 font-mono text-sm rounded border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Presets Bar including the User's Inconsistency Problem */}
            <div>
              <span className="text-[11px] text-slate-500 block mb-1.5">Load Test Presets:</span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setRawHexInput('5A A5 07 82 10 00 00 01 86 A0')}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-mono text-[11px]"
                >
                  Write 100,000 (0x1000)
                </button>
                <button
                  onClick={() => setRawHexInput('5A A5 06 83 10 00 00 01 86 A0')}
                  className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-mono text-[11px] border border-amber-300"
                >
                  Inconsistent 0x06 Read Response
                </button>
                <button
                  onClick={() => setRawHexInput('5A A5 08 83 10 00 02 00 01 86 A0')}
                  className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-mono text-[11px] border border-emerald-300"
                >
                  Standard DGUS II Read Response (0x08)
                </button>
                <button
                  onClick={() => setRawHexInput('5A A5 07 82 00 84 5A 01 00 02')}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-mono text-[11px]"
                >
                  Page Switch to Screen 2
                </button>
              </div>
            </div>
          </div>

          {/* Special Anomaly Highlight Banner if Inconsistency Detected */}
          {decodedResult?.diagnostics.isProtocolAnomaly && (
            <div className="p-5 rounded-lg border-2 border-amber-400 bg-amber-50 text-xs space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-amber-900">
                  DWIN Protocol Length Discrepancy Detected
                </h3>
              </div>
              <p className="text-amber-800 leading-relaxed">
                The frame specifies a length byte of <code className="font-mono font-bold bg-amber-200 px-1 py-0.5 rounded">0x06</code> (declaring 6 bytes follow), but <strong className="font-mono">7 payload bytes</strong> actually follow in the stream (<code className="font-mono font-semibold">83 10 00 00 01 86 A0</code>).
              </p>

              <div className="bg-white rounded p-4 border border-amber-200 space-y-2 text-slate-700 shadow-xs">
                <div className="font-semibold text-slate-900">
                  Why this happens &amp; How to resolve:
                </div>
                <div className="space-y-1.5">
                  <div>
                    <strong>1. Standard DGUS II Read Response (8 bytes payload):</strong> DGUS II inserts a 1-byte word count length (<code className="font-mono">0x02</code>) before the 4 data bytes. Length byte must be <code className="font-mono font-bold text-emerald-700">0x08</code>:
                    <div className="font-mono text-slate-900 mt-0.5 pl-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                      5A A5 <strong>08</strong> 83 10 00 <strong>02</strong> 00 01 86 A0
                    </div>
                  </div>
                  <div>
                    <strong>2. Compact Read Response (7 bytes payload):</strong> If no word count byte is included, 7 bytes follow (Cmd + 2-byte VP + 4 data bytes). Length byte must be <code className="font-mono font-bold text-blue-700">0x07</code>:
                    <div className="font-mono text-slate-900 mt-0.5 pl-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                      5A A5 <strong>07</strong> 83 10 00 00 01 86 A0
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setRawHexInput('5A A5 08 83 10 00 02 00 01 86 A0')}
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    Apply Standard DGUS II Fix (0x08 + Word Count 0x02)
                  </button>
                  <button
                    onClick={() => setRawHexInput('5A A5 07 83 10 00 00 01 86 A0')}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    Apply Compact Fix (0x07)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Decoded Dissection Cards */}
          {decodedResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Byte Dissection */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Byte Structure Breakdown
                </h3>

                <div className="space-y-1.5">
                  {decodedResult.dissectedBytes.map(b => (
                    <div
                      key={b.index}
                      className="flex items-center justify-between p-2 rounded border border-slate-200 bg-slate-50 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[10px]">[{b.index}]</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${getRoleBadgeColor(b.role)}`}>
                          0x{b.hex}
                        </span>
                        <span className="text-slate-800 font-sans text-xs">
                          {b.description}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase text-slate-500 font-semibold">
                        {b.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Decoded Semantics */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Decoded Protocol Payload
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Command Code</span>
                    <span className="font-semibold text-slate-900">
                      {decodedResult.commandName}
                    </span>
                  </div>

                  {decodedResult.vpAddress !== undefined && (
                    <div className="p-3 rounded bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Target VP Address</span>
                      <span className="font-mono font-bold text-blue-700">
                        {formatVpHex(decodedResult.vpAddress)} (Dec: {decodedResult.vpAddress})
                      </span>
                      {decodedResult.matchedParameter ? (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                          Matched Parameter: {decodedResult.matchedParameter.name} ({decodedResult.matchedParameter.dataType})
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 mt-1">
                          (Unregistered VP in active project)
                        </div>
                      )}
                    </div>
                  )}

                  {decodedResult.interpretedValue && (
                    <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-slate-500 block text-[11px]">Interpreted Value Formats:</span>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        {decodedResult.interpretedValue.asUint16 !== undefined && (
                          <div>
                            <span className="text-slate-500 block">UINT16:</span>
                            <span className="font-semibold text-slate-900">{decodedResult.interpretedValue.asUint16}</span>
                          </div>
                        )}
                        {decodedResult.interpretedValue.asInt16 !== undefined && (
                          <div>
                            <span className="text-slate-500 block">INT16:</span>
                            <span className="font-semibold text-slate-900">{decodedResult.interpretedValue.asInt16}</span>
                          </div>
                        )}
                        {decodedResult.interpretedValue.asUint32 !== undefined && (
                          <div>
                            <span className="text-slate-500 block">UINT32:</span>
                            <span className="font-semibold text-slate-900">{decodedResult.interpretedValue.asUint32}</span>
                          </div>
                        )}
                        {decodedResult.interpretedValue.asFloat !== undefined && (
                          <div>
                            <span className="text-slate-500 block">FLOAT32:</span>
                            <span className="font-semibold text-slate-900">{decodedResult.interpretedValue.asFloat}</span>
                          </div>
                        )}
                      </div>

                      {decodedResult.interpretedValue.formatted && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-slate-500 block text-[11px]">Scaled Engineering Value:</span>
                          <span className="text-sm font-bold text-slate-900">
                            {decodedResult.interpretedValue.formatted}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-TAB 3: BYTE COMPARATOR
          ======================================================== */}
      {subTab === 'comparator' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">
              Expected vs Actual Byte Comparator
            </h2>
            <p className="text-xs text-slate-500">
              Paste expected firmware packet alongside actual serial stream from hardware or logic analyzer.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected Frame:
                </label>
                <textarea
                  rows={2}
                  value={expectedHex}
                  onChange={e => setExpectedHex(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Actual / Received Frame:
                </label>
                <textarea
                  rows={2}
                  value={actualHex}
                  onChange={e => setActualHex(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs rounded border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Match Status Banner */}
            <div className={`p-4 rounded-lg border text-xs flex items-center justify-between ${
              compareResult.match
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                {compareResult.match ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className="font-semibold text-sm">
                  {compareResult.summary}
                </span>
              </div>
              <span className="font-mono text-xs font-medium">
                Expected: {compareResult.expectedBytes.length}B · Actual: {compareResult.actualBytes.length}B
              </span>
            </div>

            {/* Side-by-Side Byte Alignment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 font-sans font-semibold text-xs">
                    <th className="py-2.5 px-3 text-left bg-indigo-100/90 text-indigo-900 border-l-4 border-l-indigo-600 border-r border-indigo-200/80">Offset</th>
                    <th className="py-2.5 px-3 text-left bg-blue-100/90 text-blue-900 border-l-4 border-l-blue-600 border-r border-blue-200/80">Expected Byte</th>
                    <th className="py-2.5 px-3 text-left bg-amber-100/90 text-amber-900 border-l-4 border-l-amber-600 border-r border-amber-200/80">Actual Byte</th>
                    <th className="py-2.5 px-3 text-left bg-emerald-100/90 text-emerald-950 border-l-4 border-l-emerald-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: Math.max(compareResult.expectedBytes.length, compareResult.actualBytes.length) }).map((_, idx) => {
                    const exp = compareResult.expectedBytes[idx];
                    const act = compareResult.actualBytes[idx];
                    const isDiff = exp !== act;
                    return (
                      <tr
                        key={idx}
                        className={isDiff ? 'bg-red-50/70' : 'hover:bg-slate-50 transition-colors'}
                      >
                        <td className="py-2 px-3 text-slate-400 border-l-4 border-l-indigo-500 border-r border-slate-100">
                          +{idx.toString().padStart(2, '0')}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 border-l-4 border-l-blue-500 border-r border-slate-100">
                          {exp !== undefined ? '0x' + exp.toString(16).padStart(2, '0').toUpperCase() : '<missing>'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 border-l-4 border-l-amber-500 border-r border-slate-100">
                          {act !== undefined ? '0x' + act.toString(16).padStart(2, '0').toUpperCase() : '<missing>'}
                        </td>
                        <td className="py-2 px-3 border-l-4 border-l-emerald-500">
                          {isDiff ? (
                            <span className="text-red-700 font-semibold font-sans">
                              Mismatch
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-sans font-medium">
                              Match
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Detailed Discrepancy Notes */}
            {compareResult.detailedAnalysis.length > 0 && (
              <div className="p-4 rounded bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="font-semibold text-slate-800 block mb-1">
                  Analysis Details:
                </span>
                {compareResult.detailedAnalysis.map((line, i) => (
                  <div key={i} className="text-slate-600 font-mono">
                    • {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Batch Screen Creator inside HEX Lab */}
      {isBatchScreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto text-slate-900 font-sans">
          <div className="bg-white border border-slate-200 rounded-xl max-w-6xl xl:max-w-7xl w-full p-6 sm:p-8 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Batch Screen &amp; VP Creator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-generate multiple DGUS screens and VP bindings directly inside HEX Lab.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchScreenModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {batchScreenSuccessMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{batchScreenSuccessMessage}</span>
              </div>
            )}

            {/* Smart Conflict Prevention Banner */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">
                  Smart Duplicate Avoidance Active
                </div>
                <div className="text-slate-600">
                  Existing screen numbers ({project.screens.map(s => `#${s.screenNumber}`).join(', ')}) are automatically skipped. Screen names and VP addresses can be changed later.
                </div>
              </div>
            </div>

            <form onSubmit={handleExecuteBatchCreateScreens} className="space-y-4">
              {/* Batch Configuration Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Start Screen #
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="65535"
                    value={batchStartNum}
                    onChange={e => handleBatchStartNumChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Starting Pic ID</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Screen Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={batchCount}
                    onChange={e => handleBatchCountChange(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">1 to 20 screens</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Default VPs / Screen
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={batchVpsPerScreen}
                    onChange={e => handleBatchVpsChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Configurable per screen below</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Group / Category
                  </label>
                  <input
                    type="text"
                    value={batchGroup}
                    onChange={e => setBatchGroup(e.target.value)}
                    placeholder="e.g. Operator UI"
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Applied to generated screens</span>
                </div>
              </div>

              {/* Interactive Screen & VP Generation Plan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 text-sm">
                    Generated Screen &amp; VP Plan ({batchConfigItems.length} screens to create):
                  </span>
                  <span className="text-slate-600 font-mono text-xs font-bold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
                    Total VPs: {batchConfigItems.reduce((acc, it) => acc + it.vpCount, 0)}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[420px] overflow-y-auto shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">Screen #</th>
                        <th className="py-2.5 px-4 min-w-[280px]">Screen Name</th>
                        <th className="py-2.5 px-3 w-28 whitespace-nowrap">VPs Count</th>
                        <th className="py-2.5 px-4 min-w-[340px]">
                          <div className="flex items-center gap-1.5">
                            <span>Allocated VP Addresses</span>
                            <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded shadow-2xs">
                              Click VP box to Edit
                            </span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {batchConfigItems.map((item) => (
                        <tr key={item.screenNumber} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs">
                              Screen #{item.screenNumber}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 min-w-[280px]">
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => handleUpdateItemName(item.screenNumber, e.target.value)}
                              placeholder={`Screen ${item.screenNumber} (add name later)`}
                              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white hover:border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-900 shadow-xs transition-all"
                            />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="16"
                                value={item.vpCount}
                                onChange={e => handleUpdateItemVpCount(item.screenNumber, parseInt(e.target.value) || 0)}
                                className="w-16 px-2 py-1 rounded border border-slate-300 font-mono text-center font-bold text-xs"
                              />
                              <span className="text-[11px] text-slate-400">VPs</span>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* Start VP box with Working Edit Button */}
                              {editingStartVp?.screenNumber === item.screenNumber ? (
                                <div className="flex items-center gap-1 bg-white border-2 border-indigo-500 rounded-md px-1.5 py-0.5 shadow-xs shrink-0">
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
                                  className="flex items-center gap-1.5 bg-indigo-50/90 border border-indigo-300/80 rounded-md px-2 py-1 shadow-2xs hover:border-indigo-500 transition-all shrink-0 group"
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

                              {/* All individual allocated VP addresses with Edit button for each VP */}
                              {item.vpCount > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                                  {Array.from({ length: item.vpCount }).map((_, vIdx) => {
                                    const currentAddr = item.customVpAddresses?.[vIdx] ?? ((item.startVpAddress || 0x1050) + vIdx * 2);
                                    const isEditingThisVp = editingSingleVp?.screenNumber === item.screenNumber && editingSingleVp?.vpIndex === vIdx;

                                    if (isEditingThisVp) {
                                      return (
                                        <div
                                          key={vIdx}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border-2 border-emerald-500 shadow-xs"
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
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs border shadow-2xs transition-colors ${
                                          hasCustom 
                                            ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:border-emerald-400'
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

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-[11px] text-slate-400">
                  Screens &amp; VPs are instantly registered into both Screen Registry and Parameter Registry.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBatchScreenModalOpen(false)}
                    className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={batchConfigItems.length === 0}
                    className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      Auto Generate {batchConfigItems.length} Screens ({batchConfigItems.reduce((acc, it) => acc + it.vpCount, 0)} VPs)
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
