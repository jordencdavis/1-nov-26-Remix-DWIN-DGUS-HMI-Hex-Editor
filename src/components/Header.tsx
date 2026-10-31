/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDwin } from '../context/DwinContext';
import { DwinProject } from '../types/dwin';
import { parseParameterSchemaCsv } from '../utils/codeExport';
import { 
  Cpu, 
  Save, Upload, Download, FolderClock, ChevronDown, 
  Trash2, Check, Plus, CheckCircle2, AlertCircle, Clock, Layers, Sliders
} from 'lucide-react';

interface RecentProject {
  id: string;
  name: string;
  dwinModel: string;
  resolution: string;
  screensCount: number;
  parametersCount: number;
  timestamp: number;
  formattedDate: string;
  projectData: DwinProject;
}

const RECENT_PROJECTS_KEY = 'dwin_recent_projects_v2';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, stats, project, importProject } = useDwin();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [showSnapshotInput, setShowSnapshotInput] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent projects from localStorage on mount and initialize if empty
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (stored) {
        const parsed: RecentProject[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentProjects(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Seed initial default recent project with current project
    const now = Date.now();
    const initialRecent: RecentProject = {
      id: `rec_initial_${now}`,
      name: project.name || 'Industrial Telemetry Main',
      dwinModel: project.dwinModel,
      resolution: project.resolution,
      screensCount: project.screens.length,
      parametersCount: project.parameters.length,
      timestamp: now,
      formattedDate: new Date(now).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      projectData: project
    };
    setRecentProjects([initialRecent]);
    try {
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify([initialRecent]));
    } catch {
      // ignore
    }
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setShowSnapshotInput(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setShowSnapshotInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const saveProjectToRecents = (proj: DwinProject, customName?: string) => {
    const now = Date.now();
    const displayName = customName?.trim() || proj.name;
    const newItem: RecentProject = {
      id: `rec_${now}_${Math.random().toString(36).substring(2, 6)}`,
      name: displayName,
      dwinModel: proj.dwinModel,
      resolution: proj.resolution,
      screensCount: proj.screens.length,
      parametersCount: proj.parameters.length,
      timestamp: now,
      formattedDate: new Date(now).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      projectData: {
        ...proj,
        name: displayName,
        updatedAt: new Date(now).toISOString()
      }
    };

    setRecentProjects(prev => {
      // Keep unique by name or update top
      const filtered = prev.filter(p => p.name !== displayName);
      const updated = [newItem, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleQuickSave = () => {
    saveProjectToRecents(project);
    setSaveFeedback(true);
    setStatusMessage({ text: `Project "${project.name}" saved!`, type: 'success' });
    setTimeout(() => {
      setSaveFeedback(false);
      setStatusMessage(null);
    }, 2500);
  };

  const handleSaveNamedSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;
    saveProjectToRecents(project, snapshotName.trim());
    setSnapshotName('');
    setShowSnapshotInput(false);
    setStatusMessage({ text: `Snapshot "${snapshotName.trim()}" created!`, type: 'success' });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleSelectRecentProject = (item: RecentProject) => {
    importProject(item.projectData);
    setIsDropdownOpen(false);
    setStatusMessage({ text: `Loaded "${item.name}" (${item.screensCount} screens, ${item.parametersCount} VPs)!`, type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteRecentProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecentProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleDownloadFile = () => {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_dwin.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDropdownOpen(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = event => {
      try {
        const text = event.target?.result as string;

        if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
          const { parameters: parsedParams } = parseParameterSchemaCsv(text);
          if (parsedParams.length === 0) {
            throw new Error('No valid parameters found in schema file.');
          }

          const newParams = [...project.parameters];
          for (const p of parsedParams) {
            const idx = newParams.findIndex(existing => existing.vpAddress === p.vpAddress);
            if (idx >= 0) newParams[idx] = { ...newParams[idx], ...p, id: newParams[idx].id };
            else newParams.push(p);
          }

          const updatedProject = {
            ...project,
            parameters: newParams,
            updatedAt: new Date().toISOString()
          };

          importProject(updatedProject);
          saveProjectToRecents(updatedProject, `${project.name} + Imported`);
          setStatusMessage({ text: `Imported ${parsedParams.length} parameters from "${file.name}"!`, type: 'success' });
        } else {
          const parsed: DwinProject = JSON.parse(text);
          if (!parsed.screens || !parsed.parameters) {
            throw new Error('Missing screens or parameters array.');
          }
          importProject(parsed);
          saveProjectToRecents(parsed);
          setStatusMessage({ text: `Imported "${parsed.name}" (${parsed.screens.length} screens, ${parsed.parameters.length} VPs)!`, type: 'success' });
        }
      } catch (err: any) {
        setStatusMessage({ text: `Import error: ${err.message || 'Invalid file format.'}`, type: 'error' });
      }
      setTimeout(() => setStatusMessage(null), 3500);
    };

    reader.readAsText(file);
    e.target.value = '';
    setIsDropdownOpen(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.dwinhex,.csv,.txt"
        onChange={handleFileImport}
        className="hidden"
      />

      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6 min-h-[66px] py-2 flex items-center justify-between gap-4">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-mono font-bold text-sm tracking-wider shadow-xs">
            DW
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              DWIN HEX Design Software
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pt-2 pb-3 custom-nav-scroll">
          <button
            onClick={() => setActiveTab('screenlab')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'screenlab'
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>SCREEN Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('header_config')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'header_config'
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Configure Header</span>
            <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full">Sequence</span>
          </button>

          <button
            onClick={() => setActiveTab('parameters')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'parameters'
                ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Parameter Registry</span>
            <span className="text-[11px] text-slate-400 font-mono">({stats.totalParameters})</span>
          </button>
        </nav>

        {/* Zone 3: Save, Import & Space-Efficient Dropdown Model for Recent Projects */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 1. Quick Save Button */}
          <button
            type="button"
            onClick={handleQuickSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer shadow-2xs ${
              saveFeedback
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
            title="Save current project to local storage and recent snapshots"
          >
            {saveFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </button>

          {/* 2. Quick Import Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Import project from file (.json, .dwinhex, .csv, .txt)"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* 3. Space-Efficient Dropdown Model: Recent Projects & Project Actions */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors shadow-2xs cursor-pointer ${
                isDropdownOpen
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              }`}
              title="Recent Projects history & Project management"
            >
              <FolderClock className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Recent Projects</span>
              <span className="md:hidden">Projects</span>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Model Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 z-50 text-xs space-y-3">
                {/* Header info */}
                <div className="border-b border-slate-100 pb-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <FolderClock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Project Management</span>
                    </span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate max-w-[150px]">
                      {project.dwinModel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Current: <strong className="text-slate-800">{project.name}</strong> ({project.screens.length} screens, {project.parameters.length} VPs)
                  </p>
                </div>

                {/* Primary Action Buttons in Dropdown */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleQuickSave}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Project</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Import File</span>
                  </button>
                </div>

                {/* Secondary Action: Download Backup File */}
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium text-slate-800">Download Backup (.json)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Offline Backup</span>
                </button>

                {/* Recent Projects List Section */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Recent Projects ({recentProjects.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSnapshotInput(!showSnapshotInput)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Save Snapshot</span>
                    </button>
                  </div>

                  {/* Inline Form to Save Named Snapshot */}
                  {showSnapshotInput && (
                    <form onSubmit={handleSaveNamedSnapshot} className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        value={snapshotName}
                        onChange={e => setSnapshotName(e.target.value)}
                        placeholder="Snapshot name (e.g. Revision B)..."
                        autoFocus
                        className="flex-1 text-xs px-2.5 py-1 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium text-xs hover:bg-blue-700 shadow-2xs"
                      >
                        Save
                      </button>
                    </form>
                  )}

                  {/* Recent Projects Scrollable Items */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                    {recentProjects.map(item => {
                      const isActive = item.name === project.name;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectRecentProject(item)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 group ${
                            isActive
                              ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/20 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {item.name}
                              </span>
                              {isActive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <span>{item.screensCount} screens</span>
                              <span>·</span>
                              <span>{item.parametersCount} VPs</span>
                              <span>·</span>
                              <span className="text-slate-400">{item.formattedDate}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={e => handleDeleteRecentProject(e, item.id)}
                              className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete from recent list"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {recentProjects.length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No recent projects saved yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Status toast notification inside dropdown */}
                {statusMessage && (
                  <div className={`p-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    )}
                    <span className="truncate">{statusMessage.text}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Toast for Header Actions */}
      {statusMessage && !isDropdownOpen && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 font-medium shadow-inner animate-in slide-in-from-top duration-150">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{statusMessage.text}</span>
        </div>
      )}
    </header>
  );
};
