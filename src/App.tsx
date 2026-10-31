/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DwinProvider, useDwin } from './context/DwinContext';
import { Header } from './components/Header';
import { ParameterRegistry } from './components/ParameterRegistry/ParameterRegistry';
import { Settings, Plus, Save, AlertTriangle, Check, Layers, HelpCircle } from 'lucide-react';
import { downloadProjectAsJson, saveProjectToRecentStorage } from './utils/projectStorage';
import { BatchScreenCreatorModal } from './components/BatchScreenCreatorModal';
import { ScreenLab } from './components/ScreenLab/ScreenLab';
import { ApplicationGuideModal } from './components/ApplicationGuideModal';
import { HeaderConfigTab } from './components/HeaderConfig/HeaderConfigTab';

const WorkspaceContent: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    project, 
    updateProjectMetadata, 
    createNewProject,
    isBatchScreenModalOpen,
    setIsBatchScreenModalOpen,
    openBatchScreenCreator
  } = useDwin();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [modelName, setModelName] = useState(project.dwinModel);
  const [projectName, setProjectName] = useState(project.name);
  const [resolution, setResolution] = useState(project.resolution);
  const [headerHex, setHeaderHex] = useState(project.headerHex);

  const showFeedback = (text: string) => {
    setFeedbackNotice(text);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const handleNewProjectClick = () => {
    const hasExistingData = project.screens.length > 0 || project.parameters.length > 0 || (project.name && project.name !== 'Untitled DWIN Project');
    if (hasExistingData) {
      setIsNewProjectModalOpen(true);
    } else {
      createNewProject('Untitled DWIN Project');
      showFeedback('New blank project created');
    }
  };

  const handleConfirmSaveAndNew = () => {
    try {
      downloadProjectAsJson(project);
      saveProjectToRecentStorage(project);
    } catch {
      // fallback
    }
    createNewProject('Untitled DWIN Project');
    setIsNewProjectModalOpen(false);
    showFeedback(`Saved "${project.name}" & created new project`);
  };

  const handleConfirmDontSaveAndNew = () => {
    createNewProject('Untitled DWIN Project');
    setIsNewProjectModalOpen(false);
    showFeedback('Created new project (unsaved changes discarded)');
  };

  const handleCancelNew = () => {
    setIsNewProjectModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header />

      {/* Sub-header Context / Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {/* NEW Project Button */}
            <button
              type="button"
              onClick={handleNewProjectClick}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-all shadow-2xs cursor-pointer tracking-wider shrink-0"
              title="Create a new project"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW</span>
            </button>

            {/* SCREEN Lab Button in Top Subheader */}
            <button
              type="button"
              onClick={() => setActiveTab('screenlab')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-all shadow-2xs cursor-pointer tracking-wide shrink-0 ${
                activeTab === 'screenlab'
                  ? 'bg-indigo-700 text-white ring-2 ring-indigo-400'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
              }`}
              title="Open SCREEN Lab: batch auto-generate DGUS screens and VP bindings"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-100" />
              <span>SCREEN Lab</span>
            </button>

            {/* Helper Guide Button */}
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-300 shadow-2xs cursor-pointer tracking-wide shrink-0 transition-all hover:border-amber-400"
              title="How to Use — interactive application guide & documentation"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>How to Use</span>
            </button>

            <span className="font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
              {project.name}
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="font-mono text-slate-600">
              {project.dwinModel}
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">|</span>
            <span className="font-mono text-slate-500 hidden sm:inline">
              Res: {project.resolution}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {feedbackNotice && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-in fade-in">
                <Check className="w-3 h-3" />
                <span>{feedbackNotice}</span>
              </span>
            )}
            <span className="font-mono text-[11px] text-slate-500">
              Header: <span className="font-bold text-slate-800">{project.headerHex}</span>
            </span>
            <button
              onClick={() => {
                setProjectName(project.name);
                setModelName(project.dwinModel);
                setResolution(project.resolution);
                setHeaderHex(project.headerHex);
                setIsConfigModalOpen(true);
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Project Hardware Configuration"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-full w-full mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className={activeTab === 'screenlab' || (activeTab !== 'parameters' && activeTab !== 'header_config') ? 'block' : 'hidden'}><ScreenLab /></div>
        <div className={activeTab === 'header_config' ? 'block' : 'hidden'}><HeaderConfigTab /></div>
        <div className={activeTab === 'parameters' ? 'block' : 'hidden'}><ParameterRegistry /></div>
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 mt-auto">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            DWIN DGUS II Protocol Standard · Commands: <code className="font-mono text-slate-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">0x82</code> Write to VP (RAM / Variable memory), <code className="font-mono text-slate-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">0x83</code> Read from VP (RAM / Variable memory), <code className="font-mono text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-semibold">0x0084</code> Page Jump
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            DWIN HEX Design Software
          </div>
        </div>
      </footer>

      {/* Hardware Settings Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Target Hardware &amp; Project Config
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  DWIN Display Model / ASIC
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Screen Resolution
                  </label>
                  <select
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  >
                    <option value="800x480">800x480 (7-inch / 5-inch)</option>
                    <option value="1024x600">1024x600 (7-inch / 10-inch)</option>
                    <option value="480x272">480x272 (4.3-inch)</option>
                    <option value="1280x800">1280x800 (10.1-inch)</option>
                    <option value="320x240">320x240 (3.5-inch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Frame Header (Hex)
                  </label>
                  <input
                    type="text"
                    value={headerHex}
                    onChange={e => setHeaderHex(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateProjectMetadata({
                      name: projectName,
                      dwinModel: modelName,
                      resolution,
                      headerHex
                    });
                    setIsConfigModalOpen(false);
                  }}
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Confirmation Modal (Save / Don't Save / Cancel) */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-dialog-title"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="new-project-dialog-title" className="text-base font-bold text-slate-900">
                  Save Changes Before Creating New Project?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  A project is currently loaded in the workspace with active data. Would you like to save it before creating a new project?
                </p>
              </div>
            </div>

            {/* Current Project Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-500">Current Project:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={project.name}>
                  {project.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
                <span>Screens &amp; VPs:</span>
                <span className="font-semibold text-blue-700">
                  {project.screens.length} Screens · {project.parameters.length} Parameters
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Hardware:</span>
                <span className="truncate max-w-[200px]">{project.dwinModel.split(' ')[0]} ({project.resolution})</span>
              </div>
            </div>

            {/* Action Buttons: Save / Don't Save / Cancel */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelNew}
                className="order-3 sm:order-1 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDontSaveAndNew}
                className="order-2 sm:order-2 px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
              >
                Don't Save
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveAndNew}
                className="order-1 sm:order-3 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Screen & VP Creator Global Modal */}
      <BatchScreenCreatorModal
        isOpen={isBatchScreenModalOpen}
        onClose={() => setIsBatchScreenModalOpen(false)}
        onSwitchToSingleScreen={() => {
          setIsBatchScreenModalOpen(false);
          setActiveTab('screenlab');
        }}
      />

      {/* Application How-To-Use Guide Modal */}
      <ApplicationGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsGuideModalOpen(false);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <DwinProvider>
      <WorkspaceContent />
    </DwinProvider>
  );
}
