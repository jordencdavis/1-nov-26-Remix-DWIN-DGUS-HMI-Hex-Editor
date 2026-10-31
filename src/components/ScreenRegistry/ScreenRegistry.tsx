/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useDwin } from '../../context/DwinContext';
import { Screen, ScreenVpBinding, ScreenNavigation, ScreenVpUsageRole, NavTrigger, Parameter } from '../../types/dwin';
import { formatVpHex, generateDwinFrame } from '../../utils/hexEngine';
import { 
  Plus, Copy, Trash2, Edit3, ArrowRight, CornerDownLeft, 
  ExternalLink, Layers, Monitor, Sliders, Hash, Image as ImageIcon,
  Check, X, Upload, Images, FileImage, AlertCircle, ArrowDown,
  CheckCircle2, Sparkles, Cpu, Eye, EyeOff, ChevronLeft, ChevronRight
} from 'lucide-react';

import industrialDashboardImg from '../../assets/images/dwin_hmi_industrial_dashboard_1793218798770.jpg';
import blueprintPanelImg from '../../assets/images/dwin_hmi_blueprint_panel_1793218820640.jpg';

const PRESET_BACKGROUND_IMAGES = [
  {
    name: 'Industrial Telemetry (Dashboard)',
    url: industrialDashboardImg
  },
  {
    name: 'Process Flow (Blueprint Panel)',
    url: blueprintPanelImg
  }
];

interface BatchImageItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  extractedNumber: number | null;
  targetScreenId: string;
  ruleExplanation: string;
}

export const ScreenRegistry: React.FC = () => {
  const { 
    project, 
    selectedScreenId, 
    setSelectedScreenId, 
    addScreen, 
    updateScreen, 
    batchUpdateScreenImages,
    batchCreateScreens,
    deleteScreen, 
    duplicateScreen,
    addVpBindingToScreen,
    removeVpBindingFromScreen,
    addNavigationToScreen,
    removeNavigationFromScreen,
    jumpToHexLabWithParam,
    openBatchScreenCreator,
    setActiveTab
  } = useDwin();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [vpViewMode, setVpViewMode] = useState<'cards' | 'table'>('table');
  const [showAssignedVps, setShowAssignedVps] = useState<boolean>(true);
  const [showScreens, setShowScreens] = useState<boolean>(true);
  const [isNewScreenModalOpen, setIsNewScreenModalOpen] = useState(false);
  const [isBatchScreenModalOpen, setIsBatchScreenModalOpen] = useState(false);
  const [isEditScreenModalOpen, setIsEditScreenModalOpen] = useState(false);
  const [isAddVpModalOpen, setIsAddVpModalOpen] = useState(false);
  const [isAddNavModalOpen, setIsAddNavModalOpen] = useState(false);
  const [isChangeBgModalOpen, setIsChangeBgModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Batch screen creator form state
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

  // Hidden file inputs
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // Batch images state
  const [batchItems, setBatchItems] = useState<BatchImageItem[]>([]);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState('');

  // Form states
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenGroup, setNewScreenGroup] = useState('Main UI');
  const [newScreenNumber, setNewScreenNumber] = useState(0);
  const [newScreenDesc, setNewScreenDesc] = useState('');

  // VP Binding form
  const [selectedVpAddress, setSelectedVpAddress] = useState<number>(project.parameters[0]?.vpAddress || 0x1000);
  const [bindingRole, setBindingRole] = useState<ScreenVpUsageRole>('data_display');
  const [bindingLabel, setBindingLabel] = useState('');
  const [coordX, setCoordX] = useState(100);
  const [coordY, setCoordY] = useState(100);

  // Nav form
  const [navTargetScreen, setNavTargetScreen] = useState<number>(0);
  const [navTrigger, setNavTrigger] = useState<NavTrigger>('touch_button');
  const [navButtonLabel, setNavButtonLabel] = useState('');
  const [navDescription, setNavDescription] = useState('');

  // Canvas visual overlay settings
  const [imageOpacity] = useState(90);

  // Get distinct groups
  const groups = Array.from(new Set(project.screens.map(s => s.group))).filter(Boolean);

  // Filtered screens
  const filteredScreens = project.screens.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.screenNumber.toString().includes(searchQuery) ||
                          formatVpHex(s.screenNumber).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'all' || s.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const activeScreen = project.screens.find(s => s.id === selectedScreenId) || filteredScreens[0] || project.screens[0];

  const currentScreenList = filteredScreens.length > 0 ? filteredScreens : project.screens;
  const currentScreenIndex = currentScreenList.findIndex(s => s.id === activeScreen?.id);

  const handlePrevScreen = () => {
    if (currentScreenList.length <= 1) return;
    const prevIdx = currentScreenIndex > 0 ? currentScreenIndex - 1 : currentScreenList.length - 1;
    setSelectedScreenId(currentScreenList[prevIdx].id);
  };

  const handleNextScreen = () => {
    if (currentScreenList.length <= 1) return;
    const nextIdx = currentScreenIndex < currentScreenList.length - 1 ? currentScreenIndex + 1 : 0;
    setSelectedScreenId(currentScreenList[nextIdx].id);
  };

  // Helper to parse filename prefix for numbering rule:
  // "naming images with number on start, and 1 = 1st screen, if no number it will be last"
  const parseFilePrefix = (fileName: string): { extractedNumber: number | null; ruleExplanation: string; defaultScreenId: string } => {
    const match = fileName.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      
      // Look for a screen matching this number:
      // If num === 1, map to 1st screen (index 0) or screen with screenNumber === 1
      let matched = project.screens.find(s => s.screenNumber === num);
      if (!matched) {
        if (num === 1 && project.screens.length > 0) {
          matched = project.screens[0]; // 1 = 1st screen
        } else if (project.screens[num - 1]) {
          matched = project.screens[num - 1];
        } else if (project.screens[num]) {
          matched = project.screens[num];
        }
      }
      
      const targetScreen = matched || project.screens[0];
      const explanation = num === 1
        ? 'Prefix "1" → Assigned to 1st Screen'
        : `Prefix "${num}" → Assigned to Screen #${targetScreen?.screenNumber ?? num}`;

      return {
        extractedNumber: num,
        ruleExplanation: explanation,
        defaultScreenId: targetScreen?.id || project.screens[0]?.id || ''
      };
    } else {
      // User rule: "if no number it will be last"
      const lastScreen = project.screens[project.screens.length - 1];
      return {
        extractedNumber: null,
        ruleExplanation: 'No prefix number → Assigned to Last Screen',
        defaultScreenId: lastScreen?.id || project.screens[0]?.id || ''
      };
    }
  };

  // Single File Upload from Computer Handler
  const handleSingleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScreen) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateScreen(activeScreen.id, { bgImageUrl: dataUrl });
        setIsChangeBgModalOpen(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  // Batch Files Selection Handler
  const handleBatchFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    // Sort files logically: numbered files first sorted by number, non-numbered files last
    fileList.sort((a, b) => {
      const matchA = a.name.match(/^(\d+)/);
      const matchB = b.name.match(/^(\d+)/);
      if (matchA && matchB) {
        return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      }
      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return a.name.localeCompare(b.name);
    });

    const items: BatchImageItem[] = [];
    fileList.forEach((file, idx) => {
      const previewUrl = URL.createObjectURL(file);
      const { extractedNumber, ruleExplanation, defaultScreenId } = parseFilePrefix(file.name);
      items.push({
        id: `batch_${idx}_${Date.now()}`,
        file,
        previewUrl,
        fileName: file.name,
        extractedNumber,
        targetScreenId: defaultScreenId,
        ruleExplanation
      });
    });

    setBatchItems(items);
    setIsBatchModalOpen(true);
    e.target.value = '';
  };

  // Apply Batch Images
  const handleApplyBatch = async () => {
    setIsApplyingBatch(true);
    try {
      const mappings: { screenId: string; bgImageUrl: string }[] = [];

      for (const item of batchItems) {
        if (!item.targetScreenId) continue;
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || item.previewUrl);
          reader.readAsDataURL(item.file);
        });
        mappings.push({ screenId: item.targetScreenId, bgImageUrl: dataUrl });
      }

      batchUpdateScreenImages(mappings);
      setBatchSuccessMessage(`Successfully applied ${mappings.length} images to your screens!`);
      setTimeout(() => {
        setIsBatchModalOpen(false);
        setBatchItems([]);
        setBatchSuccessMessage('');
      }, 1200);
    } finally {
      setIsApplyingBatch(false);
    }
  };

  // Helper to recompute batch preview items avoiding existing numbers
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
    setIsNewScreenModalOpen(false);
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
        bgImageUrl: PRESET_BACKGROUND_IMAGES[0].url,
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
        setSelectedScreenId(created[0].id);
      }
    }, 1200);
  };

  const handleOpenAddScreen = () => {
    const highestNum = project.screens.reduce((max, s) => Math.max(max, s.screenNumber), 0);
    setNewScreenNumber(highestNum + 1);
    setNewScreenName(`Screen ${highestNum + 1}`);
    setNewScreenGroup('Operator UI');
    setNewScreenDesc('');
    setIsNewScreenModalOpen(true);
  };

  const handleCreateScreen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScreenName.trim()) return;
    const created = addScreen({
      screenNumber: Number(newScreenNumber),
      name: newScreenName.trim(),
      group: newScreenGroup.trim() || 'General',
      resolution: project.resolution,
      bgImageIndex: Number(newScreenNumber),
      bgImageUrl: PRESET_BACKGROUND_IMAGES[0].url,
      description: newScreenDesc.trim(),
      vpBindings: [],
      navigations: []
    });
    setIsNewScreenModalOpen(false);
    setSelectedScreenId(created.id);
  };

  const handleAddVpBinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScreen) return;
    const param = project.parameters.find(p => p.vpAddress === selectedVpAddress);
    addVpBindingToScreen(activeScreen.id, {
      vpAddress: Number(selectedVpAddress),
      role: bindingRole,
      label: bindingLabel.trim() || param?.name || `VP ${formatVpHex(selectedVpAddress)}`,
      x: Number(coordX),
      y: Number(coordY),
      width: 140,
      height: 44
    });
    setIsAddVpModalOpen(false);
    setBindingLabel('');
  };

  const handleAddNavigation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScreen) return;
    addNavigationToScreen(activeScreen.id, {
      targetScreenNumber: Number(navTargetScreen),
      trigger: navTrigger,
      buttonLabel: navButtonLabel.trim() || `Screen ${navTargetScreen}`,
      description: navDescription.trim()
    });
    setIsAddNavModalOpen(false);
    setNavButtonLabel('');
    setNavDescription('');
  };

  const currentBgImage = activeScreen?.bgImageUrl || PRESET_BACKGROUND_IMAGES[0].url;

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs for Computer Uploads */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleSingleFileUpload}
        className="hidden"
      />
      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleBatchFilesSelected}
        className="hidden"
      />

      {/* Top Banner / Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Screen Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure DGUS screen hierarchy, upload background graphics from computer, assign VP controls, and connect navigation buttons.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* SCREEN Lab (Batch Screen Creator) Button */}
          <button
            type="button"
            onClick={() => setActiveTab('screenlab')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md transition-all whitespace-nowrap shadow-xs cursor-pointer active:scale-95"
            title="Open SCREEN Lab to batch generate DGUS screens and VP bindings"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SCREEN Lab</span>
          </button>

          {/* New Screen Button */}
          <button
            type="button"
            onClick={handleOpenAddScreen}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md transition-all whitespace-nowrap shadow-xs cursor-pointer active:scale-95"
            title="Create a new DGUS screen"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Screen</span>
          </button>

          {/* Hide/Show Screens Button */}
          <button
            type="button"
            onClick={() => setShowScreens(!showScreens)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shadow-xs ${
              showScreens
                ? 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-300 font-semibold'
            }`}
            title={showScreens ? 'Hide Screens div' : 'Show Screens div'}
          >
            {showScreens ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                <span>Hide Screens</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Show Screens</span>
              </>
            )}
          </button>

          {/* Batch Image Upload Button */}
          <button
            onClick={() => batchFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors whitespace-nowrap shadow-xs"
            title="Batch upload images from computer with numbered filenames (e.g. 1_home.png, 2_setup.png, or last)"
          >
            <Images className="w-3.5 h-3.5 text-blue-600" />
            <span>Batch Upload Images</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Screen List (30%) + Right Screen Detail (70%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Screen Selector & Filters */}
        {showScreens && (
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Screens ({project.screens.length})
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {project.resolution}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('screenlab')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-all shadow-2xs cursor-pointer active:scale-95 mr-0.5"
                    title="Open SCREEN Lab to batch generate DGUS screens and VP bindings"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-100" />
                    <span>SCREEN Lab</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddScreen}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-all shadow-2xs cursor-pointer active:scale-95 mr-0.5"
                    title="Create a new single screen"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Screen</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevScreen}
                    disabled={currentScreenList.length <= 1}
                    className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200 bg-white shadow-2xs"
                    title="Previous Screen (<)"
                    aria-label="Previous Screen"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextScreen}
                    disabled={currentScreenList.length <= 1}
                    className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200 bg-white shadow-2xs"
                    title="Next Screen (>)"
                    aria-label="Next Screen"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScreens(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-0.5"
                    title="Hide Screens"
                    aria-label="Hide Screens"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search screen or number..."
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Group Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedGroup('all')}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                  selectedGroup === 'all'
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                    selectedGroup === g
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Screen List */}
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
              {filteredScreens.map(scr => {
                const isSelected = activeScreen?.id === scr.id;
                return (
                  <div
                    key={scr.id}
                    onClick={() => setSelectedScreenId(scr.id)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                          #{scr.screenNumber.toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {scr.name}
                        </span>
                      </div>

                      {/* 3 Action Buttons moved directly to individual card */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScreenId(scr.id);
                            setNewScreenName(scr.name);
                            setNewScreenGroup(scr.group);
                            setNewScreenNumber(scr.screenNumber);
                            setNewScreenDesc(scr.description);
                            setIsEditScreenModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Edit Screen Info"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateScreen(scr.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Duplicate Screen"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {project.screens.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScreen(scr.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Screen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{scr.group}</span>
                        <span aria-hidden="true">·</span>
                        <span>{scr.vpBindings.length} VPs</span>
                      </div>
                      <span className="text-slate-400 font-mono shrink-0">{scr.navigations.length} jumps</span>
                    </div>
                  </div>
                );
              })}

              {filteredScreens.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No screens match your query.
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Right Column: Screen Detail, Visual Wireframe & VP Bindings */}
        {activeScreen ? (
          <div className={`${showScreens ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6`}>
            {/* 1. VP Usage Registry Cards & Table View */}
            <div className={`bg-white border border-slate-200 rounded-lg shadow-xs transition-all ${
              showAssignedVps ? 'p-5 space-y-4' : 'p-3 space-y-0'
            }`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                showAssignedVps ? 'border-b border-slate-200 pb-3' : ''
              }`}>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    <span>Assigned Variable Pointers</span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      Screen #{activeScreen.screenNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-normal">
                      ({activeScreen.vpBindings.length} VPs)
                    </span>
                    {/* Previous / Next Navigation Icons (< >) and Screen Hide Button */}
                    <div className="inline-flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={handlePrevScreen}
                        disabled={currentScreenList.length <= 1}
                        className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200 bg-white shadow-2xs cursor-pointer"
                        title="Previous Screen (<)"
                        aria-label="Previous Screen"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextScreen}
                        disabled={currentScreenList.length <= 1}
                        className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200 bg-white shadow-2xs cursor-pointer"
                        title="Next Screen (>)"
                        aria-label="Next Screen"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowScreens(!showScreens)}
                        className={`p-1 rounded transition-colors border shadow-2xs cursor-pointer ml-0.5 ${
                          showScreens
                            ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200 bg-white'
                            : 'text-blue-700 hover:text-blue-900 bg-blue-50 border-blue-300'
                        }`}
                        title={showScreens ? 'Hide Screens Panel' : 'Show Screens Panel'}
                        aria-label={showScreens ? 'Hide Screens Panel' : 'Show Screens Panel'}
                      >
                        {showScreens ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </button>
                    </div>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    DGUS controls and variables rendered or interacted with on this screen.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setVpViewMode('cards')}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                        vpViewMode === 'cards'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Separate Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVpViewMode('table')}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                        vpViewMode === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Table View</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsAddVpModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Assign VP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAssignedVps(!showAssignedVps)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors shadow-2xs ${
                      showAssignedVps
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                    }`}
                    title={showAssignedVps ? 'Hide Variable Pointers' : 'Show Variable Pointers'}
                  >
                    {showAssignedVps ? (
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

              {showAssignedVps && (
                /* SEPARATE CARDS VIEW MODE */
                vpViewMode === 'cards' ? (
                <div className="space-y-3">
                  {activeScreen.vpBindings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {activeScreen.vpBindings.map(vp => {
                        const param = project.parameters.find(p => p.vpAddress === vp.vpAddress);
                        const quickHex = param 
                          ? generateDwinFrame({ header: project.headerHex || '5A A5', command: 0x82, vpAddress: vp.vpAddress, value: param.defaultValue, dataType: param.dataType }).rawHex
                          : `5A A5 05 82 ${(vp.vpAddress >> 8).toString(16).padStart(2, '0').toUpperCase()} ${(vp.vpAddress & 0xff).toString(16).padStart(2, '0').toUpperCase()} 00 00`;
                        return (
                          <div
                            key={vp.id}
                            className="bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-4 space-y-2.5 transition-all shadow-2xs flex flex-col justify-between"
                          >
                            {/* Card Header: Address Badge & Role */}
                            <div className="flex items-start justify-between gap-2">
                              <span 
                                style={{ fontSize: '14px' }}
                                className="font-mono font-bold text-[14px] px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs"
                              >
                                {formatVpHex(vp.vpAddress)}
                              </span>
                              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wider shrink-0">
                                {vp.role.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Card Main Info */}
                            <div className="space-y-1">
                              <div className="font-bold text-slate-900 text-xs line-clamp-1" title={vp.label}>
                                {vp.label}
                              </div>
                              {param ? (
                                <div className="text-[11px] text-slate-600 font-mono">
                                  {param.identifier} · <span className="font-semibold text-blue-700">{param.dataType}</span> {param.unit ? `(${param.unit})` : ''}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400 italic font-mono">
                                  Unregistered Parameter
                                </div>
                              )}
                            </div>

                            {/* Card Coordinates & DWIN Command */}
                            <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-200/80 flex items-center justify-between gap-1">
                              <div>Coords: <strong className="text-slate-800">({vp.x || 0}, {vp.y || 0})</strong></div>
                              <span className="text-[10px] text-violet-700 bg-violet-50 font-bold px-1.5 py-0.2 rounded border border-violet-200">
                                {vp.role === 'touch_input' ? '0x82/0x84' : '0x82'}
                              </span>
                            </div>

                            {/* Card Footer: HEX Preview & Actions */}
                            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                              <div
                                onClick={() => param && jumpToHexLabWithParam(param)}
                                className="font-mono text-[10px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs font-semibold truncate max-w-[150px]"
                                title={`Load into HEX Lab: ${quickHex}`}
                              >
                                {quickHex}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {param && (
                                  <button
                                    onClick={() => jumpToHexLabWithParam(param)}
                                    className="p-1 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                    title="Open in HEX Lab"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    removeVpBindingFromScreen(activeScreen.id, vp.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove VP Binding"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      No Variable Pointers bound to this screen yet. Click &quot;Assign VP&quot; to connect a parameter.
                    </div>
                  )}
                </div>
              ) : (
                /* TABLE VIEW MODE */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 font-semibold text-xs">
                        <th className="py-2.5 px-3 bg-blue-100/90 text-blue-900 border-l-4 border-l-blue-600 border-r border-blue-200/80">VP Address</th>
                        <th className="py-2.5 px-3 bg-amber-100/90 text-amber-900 border-l-4 border-l-amber-600 border-r border-amber-200/80">Label / Parameter</th>
                        <th className="py-2.5 px-3 bg-violet-100/90 text-violet-900 border-l-4 border-l-violet-600 border-r border-violet-200/80">Usage Role &amp; DWIN Cmd</th>
                        <th className="py-2.5 px-3 bg-cyan-100/90 text-cyan-900 border-l-4 border-l-cyan-600 border-r border-cyan-200/80 font-mono">Coords (X, Y)</th>
                        <th className="py-2.5 px-3 bg-slate-200/90 text-slate-800 border-l-4 border-l-slate-600 text-right">Actions &amp; HEX Frame</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeScreen.vpBindings.map(vp => {
                        const param = project.parameters.find(p => p.vpAddress === vp.vpAddress);
                        const quickHex = param 
                          ? generateDwinFrame({ header: project.headerHex || '5A A5', command: 0x82, vpAddress: vp.vpAddress, value: param.defaultValue, dataType: param.dataType }).rawHex
                          : `5A A5 05 82 ${(vp.vpAddress >> 8).toString(16).padStart(2, '0').toUpperCase()} ${(vp.vpAddress & 0xff).toString(16).padStart(2, '0').toUpperCase()} 00 00`;
                        return (
                          <tr key={vp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 border-l-4 border-l-blue-500 border-r border-slate-100">
                              <span 
                                style={{ fontSize: '14px' }}
                                className="font-mono font-bold text-[14px] px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-300/70"
                              >
                                {formatVpHex(vp.vpAddress)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border-l-4 border-l-amber-500 border-r border-slate-100">
                              <div className="font-medium text-slate-900">
                                {vp.label}
                              </div>
                              {param && (
                                <div className="text-[11px] text-slate-500">
                                  {param.identifier} · {param.dataType} ({param.unit || 'no unit'})
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-l-4 border-l-violet-500 border-r border-slate-100">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-violet-100/80 text-violet-800 border border-violet-300/70 font-medium">
                                  {vp.role.replace('_', ' ')}
                                </span>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-violet-50 text-violet-700 border border-violet-200 font-bold" title="DWIN Protocol: 0x82 = Write to VP (RAM), 0x83 = Read from VP">
                                  {vp.role === 'touch_input' ? '0x82 / 0x84 (Write / Touch)' : '0x82 (Write to VP)'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 border-l-4 border-l-cyan-500 border-r border-slate-100">
                              ({vp.x || 0}, {vp.y || 0})
                            </td>
                            <td className="py-2.5 px-3 text-right border-l-4 border-l-slate-400">
                              <div className="flex items-center justify-end gap-2">
                                {param && (
                                  <button
                                    onClick={() => jumpToHexLabWithParam(param)}
                                    className="text-blue-700 hover:text-blue-900 text-xs flex items-center gap-1 font-medium bg-blue-50/70 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                                    title="Test in HEX Lab"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>HEX Lab</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    removeVpBindingFromScreen(activeScreen.id, vp.id);
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs p-1"
                                  title="Remove VP Binding"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Second line: Hex Value frame preview */}
                              <div className="flex items-center justify-end mt-1">
                                <span 
                                  onClick={() => param && jumpToHexLabWithParam(param)}
                                  className="font-mono text-[10px] text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 px-1.5 py-0.2 rounded cursor-pointer transition-colors font-semibold"
                                  title={`Click to load into HEX Lab: ${quickHex}`}
                                >
                                  {quickHex}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {activeScreen.vpBindings.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                            No Variable Pointers bound to this screen yet. Click &quot;Assign VP&quot; to connect a parameter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

            {/* 2. Interactive Screen Viewport (Picture Div - Interchanged) */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-600 text-white font-bold shrink-0">
                    Screen #{activeScreen.screenNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {activeScreen.name}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">·</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">{activeScreen.group} ({activeScreen.resolution})</span>
                </div>
              </div>

              {/* Screen Bezel & Canvas with Metallic Finish (No Black Background) */}
              <div className="w-full bg-slate-200 rounded-xl p-4 border-2 border-slate-300 shadow-sm overflow-x-auto">
                <div 
                  className="relative mx-auto rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shadow-sm"
                  style={{
                    width: '640px',
                    height: '384px'
                  }}
                >
                  {/* Real Industrial HMI Background Image */}
                  <img
                    src={currentBgImage}
                    alt={activeScreen.name}
                    className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                    style={{ opacity: imageOpacity / 100 }}
                  />

                  {/* Soft Light Overlay Scrim for Legibility */}
                  <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />

                  {/* Top Bar of simulated screen */}
                  <div className="relative z-10 h-8 bg-slate-900/70 backdrop-blur-xs px-4 flex items-center justify-between text-[11px] text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold truncate max-w-xs">{activeScreen.name}</span>
                    </div>
                    <span className="font-mono text-slate-200">Pic #{activeScreen.screenNumber}</span>
                  </div>

                  {/* Render VP Bindings on Screen with Direct Delete Action */}
                  {activeScreen.vpBindings.map((vp) => {
                    const param = project.parameters.find(p => p.vpAddress === vp.vpAddress);
                    return (
                      <div
                        key={vp.id}
                        className="absolute border border-blue-500 bg-white/90 backdrop-blur-xs rounded p-1.5 shadow-sm transition-all group z-20 cursor-pointer"
                        style={{
                          left: `${Math.min(480, (vp.x || 100) * 0.75)}px`,
                          top: `${Math.min(300, (vp.y || 100) * 0.75)}px`,
                          width: `${(vp.width || 140) * 0.85}px`,
                          height: `${(vp.height || 44) * 0.85}px`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-blue-700">
                            {formatVpHex(vp.vpAddress)}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-500 uppercase">{vp.role.replace('_', ' ')}</span>
                            {/* Direct Delete Button on Control */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeVpBindingFromScreen(activeScreen.id, vp.id);
                              }}
                              className="w-4 h-4 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors"
                              title="Delete this VP Control"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div 
                          className="text-[11px] font-semibold text-slate-900 truncate mt-0.5 hover:text-blue-600"
                          onClick={() => param && jumpToHexLabWithParam(param)}
                          title={`Click to test VP in HEX Lab (${formatVpHex(vp.vpAddress)})`}
                        >
                          {vp.label}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bottom Navigation Toolbar on Screen with Direct Delete (x) Button */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center gap-2 justify-end z-20">
                    {activeScreen.navigations.map(nav => {
                      return (
                        <div
                          key={nav.id}
                          className="group relative flex items-center bg-white/95 backdrop-blur-xs border border-slate-300 rounded-md shadow-sm hover:border-blue-500 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const target = project.screens.find(s => s.screenNumber === nav.targetScreenNumber);
                              if (target) setSelectedScreenId(target.id);
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-800 flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                            title={`Click to simulate touch navigation to Screen ${nav.targetScreenNumber}`}
                          >
                            <CornerDownLeft className="w-2.5 h-2.5 rotate-180 text-blue-600" />
                            <span>{nav.buttonLabel || `Screen ${nav.targetScreenNumber}`}</span>
                          </button>

                          {/* Direct Delete Button right on the navigation button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNavigationFromScreen(activeScreen.id, nav.id);
                            }}
                            className="px-1.5 py-1 border-l border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-r-md transition-colors"
                            title="Delete this Navigation Button"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Inline Quick Add Button directly on screen */}
                    <button
                      type="button"
                      onClick={() => setIsAddNavModalOpen(true)}
                      className="px-2 py-1 text-[11px] font-medium bg-blue-600 text-white rounded-md shadow-xs hover:bg-blue-700 flex items-center gap-1 transition-colors"
                      title="Add a new touch navigation button"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Button</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Buttons moved to bottom in place of previous text */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setIsChangeBgModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors"
                  title="Upload image from computer or change background"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload Image</span>
                </button>

                <button
                  onClick={() => setIsAddNavModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                  title="Add navigation touch button"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Button</span>
                </button>

                <button
                  onClick={() => setIsAddVpModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors"
                  title="Add variable pointer binding"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add VP Control</span>
                </button>
              </div>
            </div>

            {/* Navigation Actions Topology */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Screen Navigation &amp; Topology Jumps
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Touch buttons, timeouts, and alarm jumps connecting this screen to other screens.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddNavModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Navigation Link</span>
                </button>
              </div>

              <div className="space-y-2">
                {activeScreen.navigations.map(nav => {
                  const targetScreen = project.screens.find(s => s.screenNumber === nav.targetScreenNumber);
                  return (
                    <div
                      key={nav.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {nav.buttonLabel || 'Jump Link'}
                            </span>
                            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                              Trigger: {nav.trigger}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <span>Target:</span>
                            <span className="font-semibold text-slate-700">
                              Screen #{nav.targetScreenNumber} ({targetScreen?.name || 'Unknown Screen'})
                            </span>
                            {nav.description && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{nav.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {targetScreen && (
                          <button
                            onClick={() => setSelectedScreenId(targetScreen.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline px-2 py-1"
                          >
                            Go to Screen
                          </button>
                        )}
                        <button
                          onClick={() => {
                            removeNavigationFromScreen(activeScreen.id, nav.id);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove Navigation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {activeScreen.navigations.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-500">
                    No navigation links defined from this screen.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal: Change Screen Image (Upload from Computer - No URL) */}
      {isChangeBgModalOpen && activeScreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Screen #{activeScreen.screenNumber} Background Image
              </h3>
              <button onClick={() => setIsChangeBgModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Computer File Upload Dropzone */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Upload Image from Your Computer:
                </label>
                <div 
                  onClick={() => singleFileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-lg p-6 text-center cursor-pointer bg-blue-50/40 transition-colors"
                >
                  <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <div className="font-semibold text-slate-900 text-xs">
                    Click to browse and choose an image file from your PC
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Supports PNG, JPG, BMP, WEBP (saved directly into app storage)
                  </div>
                </div>
              </div>

              {/* Batch Upload Shortcut */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Have multiple screen images?</div>
                  <div className="text-[11px] text-slate-500">Upload all images at once with pre-numbering (1 = 1st screen, etc.)</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangeBgModalOpen(false);
                    batchFileInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shadow-xs"
                >
                  Batch Upload
                </button>
              </div>

              {/* Or Preset HMI Templates */}
              <div>
                <span className="block font-medium text-slate-700 mb-2">Or Select Standard HMI Graphic Template:</span>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_BACKGROUND_IMAGES.map((preset, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        updateScreen(activeScreen.id, { bgImageUrl: preset.url });
                        setIsChangeBgModalOpen(false);
                      }}
                      className={`p-2 rounded-lg border cursor-pointer hover:border-blue-500 transition-all ${
                        activeScreen.bgImageUrl === preset.url ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-24 object-cover rounded" />
                      <div className="mt-1.5 font-medium text-slate-900 truncate">{preset.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangeBgModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Batch Image Upload with Numbering Pre-Assignment */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Images className="w-5 h-5 text-blue-600" />
                  <span>Batch Image Upload — Screen Auto-Mapping</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Images with starting numbers are assigned directly (e.g. <span className="font-semibold text-slate-700">1 = 1st Screen</span>). Images without numbers are assigned to the <span className="font-semibold text-slate-700">Last Screen</span>.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsBatchModalOpen(false);
                  setBatchItems([]);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {batchSuccessMessage ? (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{batchSuccessMessage}</span>
              </div>
            ) : null}

            {/* List of Loaded Files with Assignment Selectors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Loaded {batchItems.length} images from computer:</span>
                <button
                  type="button"
                  onClick={() => batchFileInputRef.current?.click()}
                  className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add More Files</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {batchItems.map((item, idx) => {
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail */}
                        <img
                          src={item.previewUrl}
                          alt={item.fileName}
                          className="w-16 h-12 object-cover rounded border border-slate-300 shrink-0 bg-white"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate" title={item.fileName}>
                            {item.fileName}
                          </div>
                          <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                            {item.ruleExplanation}
                          </div>
                        </div>
                      </div>

                      {/* Screen Assignment Target Dropdown */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[11px] text-slate-500 whitespace-nowrap">Assign to:</label>
                        <select
                          value={item.targetScreenId}
                          onChange={(e) => {
                            const newId = e.target.value;
                            setBatchItems(prev => prev.map(b => b.id === item.id ? { ...b, targetScreenId: newId } : b));
                          }}
                          className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                        >
                          {project.screens.map(s => (
                            <option key={s.id} value={s.id}>
                              Screen #{s.screenNumber} ({s.name})
                            </option>
                          ))}
                        </select>

                        {/* Remove from batch */}
                        <button
                          type="button"
                          onClick={() => setBatchItems(prev => prev.filter(b => b.id !== item.id))}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Exclude this file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {batchItems.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No files loaded. Click &quot;Add More Files&quot; to pick images from your computer.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-[11px] text-slate-500">
                Images will be saved into local project state immediately.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchModalOpen(false);
                    setBatchItems([]);
                  }}
                  className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={batchItems.length === 0 || isApplyingBatch}
                  onClick={handleApplyBatch}
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isApplyingBatch ? (
                    <span>Applying Images...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply {batchItems.length} Images to Screens</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Screen */}
      {isNewScreenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Create New DGUS Screen
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsNewScreenModalOpen(false);
                  handleOpenBatchScreenCreator();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors shadow-2xs"
                title="Switch to Batch Screen Creator"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Batch Screen Creator</span>
              </button>
            </div>
            <form onSubmit={handleCreateScreen} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Screen Number (Pic ID)
                </label>
                <input
                  type="number"
                  min="0"
                  max="65535"
                  value={newScreenNumber}
                  onChange={e => setNewScreenNumber(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Screen Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alarm Thresholds"
                  value={newScreenName}
                  onChange={e => setNewScreenName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Group / Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operator UI, Settings, Safety"
                  value={newScreenGroup}
                  onChange={e => setNewScreenGroup(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Purpose of this screen..."
                  value={newScreenDesc}
                  onChange={e => setNewScreenDesc(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewScreenModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  Create Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Batch Screen Creator */}
      {isBatchScreenModalOpen && (
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
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchScreenModalOpen(false);
                    handleOpenAddScreen();
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors font-medium"
                >
                  Single Screen
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchScreenModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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

      {/* Modal: Edit Screen */}
      {isEditScreenModalOpen && activeScreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Edit Screen #{activeScreen.screenNumber}
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Screen Number
                </label>
                <input
                  type="number"
                  min="0"
                  max="65535"
                  value={newScreenNumber}
                  onChange={e => setNewScreenNumber(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Screen Name
                </label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={e => setNewScreenName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Group
                </label>
                <input
                  type="text"
                  value={newScreenGroup}
                  onChange={e => setNewScreenGroup(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newScreenDesc}
                  onChange={e => setNewScreenDesc(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditScreenModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateScreen(activeScreen.id, {
                      name: newScreenName,
                      group: newScreenGroup,
                      screenNumber: Number(newScreenNumber),
                      description: newScreenDesc
                    });
                    setIsEditScreenModalOpen(false);
                  }}
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add VP Binding */}
      {isAddVpModalOpen && activeScreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Assign Variable Pointer to Screen
            </h3>
            <form onSubmit={handleAddVpBinding} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Select Registered Parameter
                </label>
                <select
                  value={selectedVpAddress}
                  onChange={e => {
                    const addr = Number(e.target.value);
                    setSelectedVpAddress(addr);
                    const p = project.parameters.find(param => param.vpAddress === addr);
                    if (p) setBindingLabel(p.name);
                  }}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                >
                  {project.parameters.map(p => (
                    <option key={p.id} value={p.vpAddress}>
                      {formatVpHex(p.vpAddress)} - {p.name} ({p.dataType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Usage Role on Screen
                </label>
                <select
                  value={bindingRole}
                  onChange={e => setBindingRole(e.target.value as ScreenVpUsageRole)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                >
                  <option value="data_display">Data Variable Display (DGUS SP/VP)</option>
                  <option value="touch_input">Touch Keypad Input Area</option>
                  <option value="slider_control">Slider / Gauge Control</option>
                  <option value="status_icon">Bit-Status Icon / Indicator</option>
                  <option value="rtc_display">RTC Real-Time Clock Display</option>
                  <option value="popup_entry">Data Entry Popup</option>
                  <option value="trend_curve">Real-Time Trend Curve (0x84)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Display Label (Optional Override)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to use parameter name"
                  value={bindingLabel}
                  onChange={e => setBindingLabel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Coord X (px)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1920"
                    value={coordX}
                    onChange={e => setCoordX(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    Coord Y (px)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1200"
                    value={coordY}
                    onChange={e => setCoordY(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddVpModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  Add VP Binding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Navigation Link */}
      {isAddNavModalOpen && activeScreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Add Navigation Touch Button
            </h3>
            <form onSubmit={handleAddNavigation} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Target Destination Screen
                </label>
                <select
                  value={navTargetScreen}
                  onChange={e => setNavTargetScreen(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                >
                  {project.screens
                    .filter(s => s.screenNumber !== activeScreen.screenNumber)
                    .map(s => (
                      <option key={s.id} value={s.screenNumber}>
                        Screen #{s.screenNumber} - {s.name} ({s.group})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Trigger Mechanism
                </label>
                <select
                  value={navTrigger}
                  onChange={e => setNavTrigger(e.target.value as NavTrigger)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                >
                  <option value="touch_button">Touch Button Jump (Basic Touch / Page Jump)</option>
                  <option value="return_prev">Return to Previous Screen (Back Button)</option>
                  <option value="alarm_jump">Alarm / Fault Threshold Event Trigger</option>
                  <option value="timeout">Idle Timeout Auto-Jump</option>
                  <option value="system_trigger">MCU System Command Jump (VP 0x0084)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Button Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Back to Home, Settings, Calibrate"
                  value={navButtonLabel}
                  onChange={e => setNavButtonLabel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Notes / Behavior Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Saves parameter buffer before switching"
                  value={navDescription}
                  onChange={e => setNavDescription(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddNavModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
                >
                  Save Navigation Button
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
