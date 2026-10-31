/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useDwin } from '../../context/DwinContext';
import { formatVpHex } from '../../utils/hexEngine';
import { 
  Network, AlertTriangle, ArrowRight, CornerDownLeft, 
  ExternalLink, Layers, Cpu, Monitor, CheckCircle, Info
} from 'lucide-react';

export const RelationshipExplorer: React.FC = () => {
  const { 
    project, 
    selectedScreenId: contextSelectedScreenId,
    setSelectedScreenId, 
    selectedParamId: contextSelectedParamId,
    setSelectedParamId,
    setActiveTab, 
    jumpToHexLabWithParam 
  } = useDwin();

  const [focusType, setFocusType] = useState<'screen' | 'parameter' | 'audit'>('audit');
  const [selectedScreenId, setSelectedScreenIdLocal] = useState<string>(
    contextSelectedScreenId || project.screens[0]?.id || ''
  );
  const [selectedParamId, setSelectedParamIdLocal] = useState<string>(
    contextSelectedParamId || project.parameters[0]?.id || ''
  );

  // Synchronize local screen selection with global context when changed
  useEffect(() => {
    if (contextSelectedScreenId && project.screens.some(s => s.id === contextSelectedScreenId)) {
      setSelectedScreenIdLocal(contextSelectedScreenId);
    }
  }, [contextSelectedScreenId, project.screens]);

  // Synchronize local parameter selection with global context when changed
  useEffect(() => {
    if (contextSelectedParamId && project.parameters.some(p => p.id === contextSelectedParamId)) {
      setSelectedParamIdLocal(contextSelectedParamId);
    }
  }, [contextSelectedParamId, project.parameters]);

  // 1. Calculate Inbound & Outbound Navigation map
  const inboundMap = new Map<number, { fromScreenNumber: number; trigger: string; label?: string }[]>();
  project.screens.forEach(s => {
    s.navigations.forEach(nav => {
      const list = inboundMap.get(nav.targetScreenNumber) || [];
      list.push({
        fromScreenNumber: s.screenNumber,
        trigger: nav.trigger,
        label: nav.buttonLabel
      });
      inboundMap.set(nav.targetScreenNumber, list);
    });
  });

  // 2. Calculate Screen to Parameter bindings
  const paramToScreensMap = new Map<number, { screenNumber: number; screenName: string; role: string }[]>();
  project.screens.forEach(s => {
    s.vpBindings.forEach(b => {
      const list = paramToScreensMap.get(b.vpAddress) || [];
      list.push({
        screenNumber: s.screenNumber,
        screenName: s.name,
        role: b.role
      });
      paramToScreensMap.set(b.vpAddress, list);
    });
  });

  // 3. VP Address Overlap & Duplicate detector
  const vpToParamsMap = new Map<number, { paramName: string; vpStart: number; words: number }[]>();
  project.parameters.forEach(p => {
    for (let i = 0; i < p.words; i++) {
      const addr = p.vpAddress + i;
      const list = vpToParamsMap.get(addr) || [];
      list.push({
        paramName: p.name,
        vpStart: p.vpAddress,
        words: p.words
      });
      vpToParamsMap.set(addr, list);
    }
  });

  const duplicateVps: { address: number; conflictingParams: string[] }[] = [];
  vpToParamsMap.forEach((list, addr) => {
    if (list.length > 1) {
      duplicateVps.push({
        address: addr,
        conflictingParams: list.map(item => item.paramName)
      });
    }
  });

  // 4. Orphaned Parameters (not displayed or bound anywhere)
  const orphanParams = project.parameters.filter(p => !paramToScreensMap.has(p.vpAddress));

  // 5. Orphaned Screens (no inbound jump, except screen 0 which is boot screen)
  const orphanScreens = project.screens.filter(s => s.screenNumber !== 0 && !inboundMap.has(s.screenNumber));

  // 6. Dead-end Screens (no outgoing navigation)
  const deadEndScreens = project.screens.filter(s => s.navigations.length === 0);

  // Active Screen details for screen focus
  const activeFocusScreen = project.screens.find(s => s.id === selectedScreenId) || project.screens[0];
  const screenInbounds = activeFocusScreen ? (inboundMap.get(activeFocusScreen.screenNumber) || []) : [];
  const screenOutbounds = activeFocusScreen?.navigations || [];
  const screenVps = activeFocusScreen?.vpBindings || [];

  // Active Param details for param focus
  const activeFocusParam = project.parameters.find(p => p.id === selectedParamId) || project.parameters[0];
  const paramBoundScreens = activeFocusParam ? (paramToScreensMap.get(activeFocusParam.vpAddress) || []) : [];

  return (
    <div className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Audit &amp; Architecture Explorer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Trace topology cross-references between Screens, Parameters, and Memory VPs. Detect orphaned variables and duplicate address collisions.
          </p>
        </div>

        {/* View Mode Switcher / Audit Status Badge */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => setFocusType('audit')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-slate-800 shadow-xs ring-1 ring-slate-900/5 whitespace-nowrap cursor-default"
          >
            <Network className="w-3.5 h-3.5 text-blue-600" />
            <span>Diagnostics &amp; Audit</span>
          </button>
          <button
            onClick={() => {
              setFocusType('screen');
              if (contextSelectedScreenId && project.screens.some(s => s.id === contextSelectedScreenId)) {
                setSelectedScreenIdLocal(contextSelectedScreenId);
              } else if (activeFocusScreen) {
                setSelectedScreenId(activeFocusScreen.id);
              }
            }}
            className="hidden"
            style={{ display: 'none' }}
            aria-hidden="true"
            title={`Focus on Screen #${activeFocusScreen?.screenNumber}: ${activeFocusScreen?.name || 'Screen'}`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Screen Focus</span>
          </button>
          <button
            onClick={() => {
              setFocusType('parameter');
              if (contextSelectedParamId && project.parameters.some(p => p.id === contextSelectedParamId)) {
                setSelectedParamIdLocal(contextSelectedParamId);
              } else if (activeFocusParam) {
                setSelectedParamId(activeFocusParam.id);
              }
            }}
            className="hidden"
            style={{ display: 'none' }}
            aria-hidden="true"
            title={`Focus on Parameter ${activeFocusParam?.name || ''} (${formatVpHex(activeFocusParam?.vpAddress || 0x1000)})`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Parameter Focus</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: AUDIT & HEALTH STATUS */}
      {focusType === 'audit' && (
        <div className="space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <span className="text-xs text-slate-500 block">Total Screens / Registered VPs</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {project.screens.length} <span className="text-sm font-normal text-slate-400">screens</span> · {project.parameters.length} <span className="text-sm font-normal text-slate-400">params</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {project.screens.reduce((acc, s) => acc + s.vpBindings.length, 0)} visual bindings
              </div>
            </div>

            <div className={`bg-white border rounded-lg p-4 shadow-xs ${
              duplicateVps.length > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">VP Address Collisions</span>
                {duplicateVps.length > 0 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {duplicateVps.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {duplicateVps.length === 0 ? 'Zero memory overlaps' : 'Action required'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <span className="text-xs text-slate-500 block">Orphaned Parameters</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {orphanParams.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Defined in registry, not yet on any screen
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <span className="text-xs text-slate-500 block">Unreachable Screens</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {orphanScreens.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Screens without inbound navigation
              </div>
            </div>
          </div>

          {/* Audit Detailed Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duplicate VP Collisions Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${duplicateVps.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                <h3 className="text-sm font-semibold text-slate-900">
                  Duplicate VP Addresses &amp; Memory Word Clashes
                </h3>
              </div>

              {duplicateVps.length > 0 ? (
                <div className="space-y-3">
                  {duplicateVps.map((dup, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 text-xs space-y-1"
                    >
                      <div className="font-mono font-bold text-amber-800">
                        Memory Address: {formatVpHex(dup.address)}
                      </div>
                      <div className="text-slate-600">
                        Shared by {dup.conflictingParams.length} parameters:
                      </div>
                      <ul className="list-disc list-inside font-medium text-slate-800 pl-1">
                        {dup.conflictingParams.map((p, idx) => (
                          <li key={idx}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No duplicate VP addresses or multi-word memory overflows detected in the parameter registry.</span>
                </div>
              )}
            </div>

            {/* Orphaned Parameters Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Orphaned Parameters ({orphanParams.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                These parameters have been registered with VP addresses, but are not currently assigned to any screen control or display.
              </p>

              {orphanParams.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {orphanParams.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded border border-slate-200 bg-slate-50 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {p.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {formatVpHex(p.vpAddress)} · {p.dataType} ({p.unit || 'no unit'})
                        </div>
                      </div>
                      <button
                        onClick={() => jumpToHexLabWithParam(p)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>HEX Lab</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All registered parameters are actively mapped to at least one screen.</span>
                </div>
              )}
            </div>

            {/* Unreachable Screens Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Unreachable Screen Topology ({orphanScreens.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Screens (excluding boot Screen 0) that have no inbound touch or event jump paths leading to them.
              </p>

              {orphanScreens.length > 0 ? (
                <div className="space-y-2">
                  {orphanScreens.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded border border-slate-200 bg-slate-50 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          Screen #{s.screenNumber}: {s.name}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          Group: {s.group}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedScreenId(s.id);
                          setActiveTab('screens');
                        }}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Open Screen
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Every screen has at least one inbound navigation path.</span>
                </div>
              )}
            </div>

            {/* Dead-end Screens Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <CornerDownLeft className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Dead-End Screens ({deadEndScreens.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Screens with zero outbound navigation buttons or return links. Operators could get stuck unless the MCU switches pages remotely.
              </p>

              {deadEndScreens.length > 0 ? (
                <div className="space-y-2">
                  {deadEndScreens.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded border border-slate-200 bg-slate-50 text-xs"
                    >
                      <span className="font-semibold text-slate-900">
                        Screen #{s.screenNumber}: {s.name}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedScreenId(s.id);
                          setActiveTab('screens');
                        }}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Add Exit Link
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All screens have outbound return or jump navigation links.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SCREEN FOCUS */}
      {focusType === 'screen' && activeFocusScreen && (
        <div className="space-y-6">
          {/* Screen Dropdown Selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Screen (Dropdown):
              </label>
              <select
                value={activeFocusScreen.id}
                onChange={e => {
                  const newId = e.target.value;
                  setSelectedScreenIdLocal(newId);
                  setSelectedScreenId(newId);
                }}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-xs font-medium w-full sm:w-96 focus:ring-1 focus:ring-blue-500 shadow-2xs font-mono cursor-pointer"
              >
                {project.screens.map(s => (
                  <option key={s.id} value={s.id}>
                    Screen #{s.screenNumber} (0x{s.screenNumber.toString(16).padStart(4, '0').toUpperCase()}) — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>Resolution: <strong className="text-slate-800">{activeFocusScreen.resolution}</strong></span>
              <span>·</span>
              <span>Bound VPs: <strong className="text-blue-600">{screenVps.length}</strong></span>
            </div>
          </div>

          {/* Main 2-Column Split: Left (Screen Topology & Details) + Right (VP Separate Cards Window) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (5 cols): Screen Details & Navigation */}
            <div className="lg:col-span-5 space-y-6">
              {/* Selected Screen Details Card */}
              <div className="bg-white border-2 border-blue-600 rounded-lg p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-600 text-white">
                    Screen #{activeFocusScreen.screenNumber}
                  </span>
                  <span className="text-xs text-slate-500 font-mono font-semibold">
                    0x{activeFocusScreen.screenNumber.toString(16).padStart(4, '0').toUpperCase()}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeFocusScreen.name}
                  </h2>
                  <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                    Group: {activeFocusScreen.group} · Resolution: {activeFocusScreen.resolution}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {activeFocusScreen.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Inbound & Outbound Navigation Jumps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-semibold text-slate-900">
                      Inbound Jumps ({screenInbounds.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {screenInbounds.map((inb, i) => {
                      const srcScreen = project.screens.find(s => s.screenNumber === inb.fromScreenNumber);
                      return (
                        <div key={i} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs">
                          <div className="font-semibold text-slate-900">
                            From #{inb.fromScreenNumber} ({srcScreen?.name || 'Screen'})
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Trigger: <span className="font-mono">{inb.trigger}</span>
                          </div>
                        </div>
                      );
                    })}
                    {screenInbounds.length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        {activeFocusScreen.screenNumber === 0 ? 'Root Power-On Screen' : 'No inbound links.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-semibold text-slate-900">
                      Outbound Jumps ({screenOutbounds.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {screenOutbounds.map(nav => {
                      const targetScreen = project.screens.find(s => s.screenNumber === nav.targetScreenNumber);
                      return (
                        <div key={nav.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs">
                          <div className="font-semibold text-slate-900">
                            To #{nav.targetScreenNumber} ({targetScreen?.name || 'Screen'})
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Trigger: <span className="font-mono">{nav.trigger}</span>
                          </div>
                        </div>
                      );
                    })}
                    {screenOutbounds.length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No outbound navigation jumps.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): All VPs shown as Separate Cards */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    All Variable Pointers (VPs) on Screen #{activeFocusScreen.screenNumber} ({screenVps.length} VPs)
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Separate Cards View
                </span>
              </div>

              {screenVps.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                  {screenVps.map(vp => {
                    const param = project.parameters.find(p => p.vpAddress === vp.vpAddress);
                    return (
                      <div
                        key={vp.id}
                        className="bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-4 space-y-2 transition-all shadow-2xs flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs">
                              {formatVpHex(vp.vpAddress)}
                            </span>
                            <div className="font-semibold text-slate-900 text-xs mt-1.5 line-clamp-1" title={vp.label}>
                              {vp.label}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase tracking-wider shrink-0">
                            {vp.role.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono space-y-0.5 pt-1 border-t border-slate-200/60">
                          <div>Coord: X: {vp.x || 0}, Y: {vp.y || 0}</div>
                          {param && (
                            <div className="text-blue-700 font-medium">
                              Type: {param.dataType} · Unit: {param.unit || 'none'}
                            </div>
                          )}
                          {vp.notes && (
                            <div className="text-slate-400 italic line-clamp-1" title={vp.notes}>
                              {vp.notes}
                            </div>
                          )}
                        </div>

                        {param && (
                          <div className="pt-2 flex items-center justify-end">
                            <button
                              onClick={() => jumpToHexLabWithParam(param)}
                              className="text-[11px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors"
                              title="Load into HEX Lab"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>HEX Lab</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  No Variable Pointers (VPs) are bound to Screen #{activeFocusScreen.screenNumber} yet. Go to Screen Registry to assign VPs.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: PARAMETER FOCUS */}
      {focusType === 'parameter' && activeFocusParam && (
        <div className="space-y-6">
          {/* Parameter Picker */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Focus Parameter:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {project.parameters.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedParamIdLocal(p.id);
                    setSelectedParamId(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeFocusParam.id === p.id
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs ring-1 ring-indigo-700'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {formatVpHex(p.vpAddress)} {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Details Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  VP {formatVpHex(activeFocusParam.vpAddress)}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {activeFocusParam.words} words ({activeFocusParam.words * 2} bytes)
                </span>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {activeFocusParam.name}
                </h2>
                <div className="font-mono text-xs text-slate-500 mt-0.5">
                  Identifier: {activeFocusParam.identifier}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Data Type</span>
                  <span className="font-mono font-semibold text-slate-800">{activeFocusParam.dataType}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Unit &amp; Scale</span>
                  <span className="font-semibold text-slate-800">{activeFocusParam.unit || 'None'} (1/{activeFocusParam.scale})</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Value Range</span>
                  <span className="font-mono text-slate-800">[{activeFocusParam.min} .. {activeFocusParam.max}]</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">VP Role</span>
                  <span className="font-medium text-slate-800">{activeFocusParam.role}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => jumpToHexLabWithParam(activeFocusParam)}
                  className="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Generate / Test HEX Frame in Lab</span>
                </button>
              </div>
            </div>

            {/* Screens Displaying This Parameter */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900">
                Screens Referencing this Variable ({paramBoundScreens.length})
              </h3>

              <div className="space-y-2">
                {paramBoundScreens.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-slate-200 bg-slate-50 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        Screen #{s.screenNumber}: {s.screenName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Usage: <span className="font-mono text-slate-700">{s.role}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const scr = project.screens.find(sc => sc.screenNumber === s.screenNumber);
                        if (scr) {
                          setSelectedScreenId(scr.id);
                          setActiveTab('screens');
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      View Screen
                    </button>
                  </div>
                ))}

                {paramBoundScreens.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500">
                    This parameter is orphaned. It is not currently bound to any screen controls.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
