/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useDwin } from '../context/DwinContext';
import { Screen, Parameter, ScreenVpBinding } from '../types/dwin';
import { Layers, Plus, X, Check, Edit3, CheckCircle2 } from 'lucide-react';
import industrialDashboardImg from '../assets/images/dwin_hmi_industrial_dashboard_1793218798770.jpg';

interface BatchConfigItem {
  screenNumber: number;
  name: string;
  vpCount: number;
  startVpAddress?: number;
  customVpAddresses?: { [index: number]: number };
}

interface BatchScreenCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSingleScreen?: () => void;
}

export const BatchScreenCreatorModal: React.FC<BatchScreenCreatorModalProps> = ({
  isOpen,
  onClose,
  onSwitchToSingleScreen
}) => {
  const { project, batchCreateScreens, setSelectedScreenId } = useDwin();

  const [batchStartNum, setBatchStartNum] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<number>(3);
  const [batchVpsPerScreen, setBatchVpsPerScreen] = useState<number>(3);
  const [batchGroup, setBatchGroup] = useState<string>('Operator UI');
  const [batchConfigItems, setBatchConfigItems] = useState<BatchConfigItem[]>([]);
  const [editingStartVp, setEditingStartVp] = useState<{ screenNumber: number; tempHex: string } | null>(null);
  const [editingSingleVp, setEditingSingleVp] = useState<{ screenNumber: number; vpIndex: number; tempHex: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

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

  const recomputeBatchScreenItems = (start: number, count: number, vps: number) => {
    const existing = new Set(project.screens.map(s => s.screenNumber));
    const items: BatchConfigItem[] = [];
    let cur = start;
    let vpOffset = 0;

    for (let i = 0; i < count; i++) {
      while (existing.has(cur)) {
        cur++;
      }
      const baseVp = 0x1050 + (cur * 0x10) + vpOffset;
      items.push({
        screenNumber: cur,
        name: `Screen ${cur} Overview`,
        vpCount: vps,
        startVpAddress: baseVp,
        customVpAddresses: {}
      });
      cur++;
    }
    setBatchConfigItems(items);
  };

  useEffect(() => {
    if (isOpen) {
      const existing = new Set(project.screens.map(s => s.screenNumber));
      let nextNum = 0;
      while (existing.has(nextNum)) {
        nextNum++;
      }
      setBatchStartNum(nextNum);
      setBatchCount(3);
      setBatchVpsPerScreen(3);
      setBatchGroup('Operator UI');
      setEditingStartVp(null);
      setEditingSingleVp(null);
      setSuccessMessage('');
      recomputeBatchScreenItems(nextNum, 3, 3);
    }
  }, [isOpen, project.screens]);

  if (!isOpen) return null;

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

        const bindingId = `bind_gen_${Date.now()}_${item.screenNumber}_${v}_${Math.random().toString(36).substring(2, 6)}`;
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
          description: `Auto-generated parameter for Screen #${item.screenNumber} (VP ${formatVpHex(vpAddr)}).`
        });
      }

      newScreensData.push({
        screenNumber: item.screenNumber,
        name: item.name.trim() || `Screen ${item.screenNumber}`,
        group: batchGroup || 'Operator UI',
        resolution: project.resolution,
        bgImageIndex: item.screenNumber,
        bgImageUrl: project.screens[0]?.bgImageUrl || industrialDashboardImg,
        description: `Auto-generated Screen #${item.screenNumber} with ${item.vpCount} VP bindings.`,
        vpBindings: screenVpBindings,
        navigations: []
      });
    });

    const created = batchCreateScreens(newScreensData, newParametersData);
    setSuccessMessage(`Successfully generated ${created.length} screens and ${newParametersData.length} VPs!`);

    setTimeout(() => {
      onClose();
      setSuccessMessage('');
      if (created.length > 0) {
        setSelectedScreenId(created[0].id);
      }
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
                Auto-generate multiple DGUS screens and VP bindings with automatic conflict avoidance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSwitchToSingleScreen && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToSingleScreen();
                }}
                className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors font-medium cursor-pointer"
              >
                Single Screen
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
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
                      <td className="py-2 px-3 whitespace-nowrap">
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
                onClick={onClose}
                className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={batchConfigItems.length === 0}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
  );
};
