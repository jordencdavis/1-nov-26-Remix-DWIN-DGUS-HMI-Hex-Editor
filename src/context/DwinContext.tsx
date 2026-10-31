/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DwinProject, Screen, Parameter, ScreenVpBinding, ScreenNavigation } from '../types/dwin';
import { initialDwinProject } from '../data/sampleProject';

export type ActiveWorkspaceTab = 'screens' | 'screenlab' | 'parameters' | 'explorer' | 'hexlab' | 'import_export' | 'header_config';

interface DwinContextType {
  project: DwinProject;
  activeTab: ActiveWorkspaceTab;
  setActiveTab: (tab: ActiveWorkspaceTab) => void;
  selectedScreenId: string | null;
  setSelectedScreenId: (id: string | null) => void;
  selectedParamId: string | null;
  setSelectedParamId: (id: string | null) => void;
  
  // Hex Lab prefill state
  hexLabPrefill: {
    vpAddress?: number;
    value?: number | string;
    cmd?: number;
    mode?: 'generator' | 'decoder' | 'comparator';
    presetHex?: string;
  } | null;
  setHexLabPrefill: (prefill: DwinContextType['hexLabPrefill']) => void;
  jumpToHexLabWithParam: (param: Parameter) => void;
  jumpToHexLabWithFrame: (frameHex: string) => void;

  // Project mutations
  updateProjectMetadata: (updates: Partial<Pick<DwinProject, 'name' | 'version' | 'description' | 'dwinModel' | 'resolution' | 'headerHex'>>) => void;
  resetProjectToDefault: () => void;
  createNewProject: (name?: string) => void;
  importProject: (imported: DwinProject) => void;

  // Screen operations
  isBatchScreenModalOpen: boolean;
  setIsBatchScreenModalOpen: (open: boolean) => void;
  openBatchScreenCreator: () => void;
  addScreen: (screen: Omit<Screen, 'id' | 'updatedAt'>) => Screen;
  updateScreen: (id: string, updates: Partial<Screen>) => void;
  batchUpdateScreenImages: (mappings: { screenId: string; bgImageUrl: string }[]) => void;
  batchCreateScreens: (newScreens: Omit<Screen, 'id' | 'updatedAt'>[], newParams?: Omit<Parameter, 'id' | 'updatedAt'>[]) => Screen[];
  deleteScreen: (id: string) => void;
  duplicateScreen: (id: string) => Screen;
  addVpBindingToScreen: (screenId: string, binding: Omit<ScreenVpBinding, 'id'>) => void;
  removeVpBindingFromScreen: (screenId: string, bindingId: string) => void;
  addNavigationToScreen: (screenId: string, nav: Omit<ScreenNavigation, 'id'>) => void;
  removeNavigationFromScreen: (screenId: string, navId: string) => void;

  // Parameter operations
  addParameter: (param: Omit<Parameter, 'id' | 'updatedAt'>) => Parameter;
  updateParameter: (id: string, updates: Partial<Parameter>) => void;
  deleteParameter: (id: string) => void;
  duplicateParameter: (id: string) => Parameter;
  syncSchemaRows: (rows: any[]) => void;

  // Quick statistics & diagnostics
  stats: {
    totalScreens: number;
    totalParameters: number;
    totalVpBindings: number;
    orphanParametersCount: number;
    orphanScreensCount: number;
    duplicateVpCount: number;
  };
}

const STORAGE_KEY = 'dwin_hex_designer_project_v3';

const DwinContext = createContext<DwinContextType | undefined>(undefined);

export const DwinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<DwinProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.parameters) && parsed.parameters.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return initialDwinProject;
  });

  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('screenlab');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(project.screens[0]?.id || null);
  const [selectedParamId, setSelectedParamId] = useState<string | null>(project.parameters[0]?.id || null);
  const [hexLabPrefill, setHexLabPrefill] = useState<DwinContextType['hexLabPrefill']>(null);
  const [isBatchScreenModalOpen, setIsBatchScreenModalOpen] = useState(false);
  const openBatchScreenCreator = () => setIsBatchScreenModalOpen(true);

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // ignore storage quota issues
    }
  }, [project]);

  const updateProjectMetadata = (updates: Partial<Pick<DwinProject, 'name' | 'version' | 'description' | 'dwinModel' | 'resolution' | 'headerHex'>>) => {
    setProject(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString()
    }));
  };

  const resetProjectToDefault = () => {
    setProject(initialDwinProject);
    setSelectedScreenId(initialDwinProject.screens[0]?.id || null);
    setSelectedParamId(initialDwinProject.parameters[0]?.id || null);
  };

  const createNewProject = (customName?: string) => {
    const freshScreenId = 'scr_0';
    const newBlankProject: DwinProject = {
      id: 'proj_' + Date.now().toString(36),
      name: customName || 'Untitled DWIN Project',
      version: '1.0.0',
      description: 'New DWIN DGUS HMI Project',
      dwinModel: 'DMG80480C070_03WTC (T5L2 ASIC - 800x480 Capacitive Touch)',
      resolution: '800x480',
      headerHex: '5A A5',
      updatedAt: new Date().toISOString(),
      screens: [
        {
          id: freshScreenId,
          screenNumber: 0,
          name: 'Screen 0',
          group: 'General',
          resolution: '800x480',
          bgImageIndex: 0,
          description: 'Initial display page 0',
          vpBindings: [],
          navigations: [],
          updatedAt: new Date().toISOString()
        }
      ],
      parameters: []
    };
    setProject(newBlankProject);
    setSelectedScreenId(freshScreenId);
    setSelectedParamId(null);
    setHexLabPrefill(null);
    setActiveTab('screenlab');
  };

  const importProject = (imported: DwinProject) => {
    setProject(imported);
    setSelectedScreenId(imported.screens[0]?.id || null);
    setSelectedParamId(imported.parameters[0]?.id || null);
  };

  const addScreen = (data: Omit<Screen, 'id' | 'updatedAt'>): Screen => {
    const newScreen: Screen = {
      ...data,
      id: 'scr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      updatedAt: new Date().toISOString()
    };
    setProject(prev => ({
      ...prev,
      screens: [...prev.screens, newScreen],
      updatedAt: new Date().toISOString()
    }));
    setSelectedScreenId(newScreen.id);
    return newScreen;
  };

  const updateScreen = (id: string, updates: Partial<Screen>) => {
    setProject(prev => ({
      ...prev,
      screens: prev.screens.map(s => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s)),
      updatedAt: new Date().toISOString()
    }));
  };

  const batchUpdateScreenImages = (mappings: { screenId: string; bgImageUrl: string }[]) => {
    const map = new Map(mappings.map(m => [m.screenId, m.bgImageUrl]));
    setProject(prev => ({
      ...prev,
      screens: prev.screens.map(s => {
        const newImg = map.get(s.id);
        return newImg ? { ...s, bgImageUrl: newImg, updatedAt: new Date().toISOString() } : s;
      }),
      updatedAt: new Date().toISOString()
    }));
  };

  const batchCreateScreens = (
    newScreensData: Omit<Screen, 'id' | 'updatedAt'>[],
    newParamsData: Omit<Parameter, 'id' | 'updatedAt'>[] = []
  ): Screen[] => {
    const timestamp = new Date().toISOString();
    const createdScreens: Screen[] = newScreensData.map((data, idx) => ({
      ...data,
      id: 'scr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + '_' + idx,
      updatedAt: timestamp
    }));

    const createdParams: Parameter[] = newParamsData.map((data, idx) => ({
      ...data,
      id: 'param_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + '_' + idx,
      updatedAt: timestamp
    }));

    setProject(prev => ({
      ...prev,
      screens: [...prev.screens, ...createdScreens],
      parameters: [...prev.parameters, ...createdParams],
      updatedAt: timestamp
    }));

    if (createdScreens.length > 0) {
      setSelectedScreenId(createdScreens[0].id);
    }
    return createdScreens;
  };

  const deleteScreen = (id: string) => {
    setProject(prev => ({
      ...prev,
      screens: prev.screens.filter(s => s.id !== id),
      updatedAt: new Date().toISOString()
    }));
    if (selectedScreenId === id) {
      setSelectedScreenId(null);
    }
  };

  const duplicateScreen = (id: string): Screen => {
    const target = project.screens.find(s => s.id === id);
    const highestNum = project.screens.reduce((max, s) => Math.max(max, s.screenNumber), 0);
    const newScreen: Screen = {
      ...(target || {
        screenNumber: highestNum + 1,
        name: 'New Screen',
        group: 'General',
        resolution: project.resolution,
        bgImageIndex: highestNum + 1,
        description: '',
        vpBindings: [],
        navigations: []
      }),
      id: 'scr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      screenNumber: highestNum + 1,
      name: `${target?.name || 'Screen'} (Copy)`,
      updatedAt: new Date().toISOString()
    };

    setProject(prev => ({
      ...prev,
      screens: [...prev.screens, newScreen],
      updatedAt: new Date().toISOString()
    }));
    setSelectedScreenId(newScreen.id);
    return newScreen;
  };

  const addVpBindingToScreen = (screenId: string, binding: Omit<ScreenVpBinding, 'id'>) => {
    const newBinding: ScreenVpBinding = {
      ...binding,
      id: 'b_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
    };
    setProject(prev => ({
      ...prev,
      screens: prev.screens.map(s =>
        s.id === screenId
          ? {
              ...s,
              vpBindings: [...s.vpBindings, newBinding],
              updatedAt: new Date().toISOString()
            }
          : s
      ),
      updatedAt: new Date().toISOString()
    }));
  };

  const removeVpBindingFromScreen = (screenId: string, bindingId: string) => {
    setProject(prev => ({
      ...prev,
      screens: prev.screens.map(s =>
        s.id === screenId
          ? {
              ...s,
              vpBindings: s.vpBindings.filter(b => b.id !== bindingId),
              updatedAt: new Date().toISOString()
            }
          : s
      ),
      updatedAt: new Date().toISOString()
    }));
  };

  const addNavigationToScreen = (screenId: string, nav: Omit<ScreenNavigation, 'id'>) => {
    const newNav: ScreenNavigation = {
      ...nav,
      id: 'nav_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
    };
    setProject(prev => ({
      ...prev,
      screens: prev.screens.map(s =>
        s.id === screenId
          ? {
              ...s,
              navigations: [...s.navigations, newNav],
              updatedAt: new Date().toISOString()
            }
          : s
      ),
      updatedAt: new Date().toISOString()
    }));
  };

  const removeNavigationFromScreen = (screenId: string, navId: string) => {
    setProject(prev => ({
      ...prev,
      screens: prev.screens.map(s =>
        s.id === screenId
          ? {
              ...s,
              navigations: s.navigations.filter(n => n.id !== navId),
              updatedAt: new Date().toISOString()
            }
          : s
      ),
      updatedAt: new Date().toISOString()
    }));
  };

  const addParameter = (data: Omit<Parameter, 'id' | 'updatedAt'>): Parameter => {
    const newParam: Parameter = {
      ...data,
      id: 'param_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      updatedAt: new Date().toISOString()
    };
    setProject(prev => ({
      ...prev,
      parameters: [...prev.parameters, newParam],
      updatedAt: new Date().toISOString()
    }));
    setSelectedParamId(newParam.id);
    return newParam;
  };

  const updateParameter = (id: string, updates: Partial<Parameter>) => {
    setProject(prev => {
      const updated = prev.parameters.map(p => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));

      // Also update STORAGE_ROWS_KEY so ParameterSchemaBoard stays 100% in sync
      try {
        const targetParam = prev.parameters.find(p => p.id === id);
        if (targetParam) {
          const vp = updates.vpAddress ?? targetParam.vpAddress;
          const savedRows = localStorage.getItem('dwin_schema_matrix_rows_v2');
          if (savedRows) {
            const parsed = JSON.parse(savedRows);
            if (Array.isArray(parsed)) {
              const updatedRows = parsed.map((r: any) => {
                if (r.vpAddress === targetParam.vpAddress || r.vpAddress === vp) {
                  return {
                    ...r,
                    parameterName: updates.name ?? r.parameterName,
                    unit: updates.unit !== undefined ? updates.unit : r.unit,
                    scale: updates.scale !== undefined ? updates.scale : r.scale,
                    dataType: updates.dataType !== undefined ? updates.dataType : r.dataType,
                    value: updates.defaultValue !== undefined ? String(updates.defaultValue) : r.value,
                    vpAddress: vp,
                    vpHex: '0x' + (vp & 0xffff).toString(16).padStart(4, '0').toUpperCase()
                  };
                }
                return r;
              });
              localStorage.setItem('dwin_schema_matrix_rows_v2', JSON.stringify(updatedRows));
              window.dispatchEvent(new CustomEvent('dwin_schema_rows_updated'));
            }
          }
        }
      } catch { }

      return {
        ...prev,
        parameters: updated,
        updatedAt: new Date().toISOString()
      };
    });
  };

  const syncSchemaRows = (schemaRows: any[]) => {
    if (!schemaRows || schemaRows.length === 0) return;

    setProject(prev => {
      const currentParams = prev.parameters;
      const isAlreadySynced =
        currentParams.length === schemaRows.length &&
        schemaRows.every((r, idx) => {
          const p = currentParams[idx];
          return (
            p &&
            p.vpAddress === r.vpAddress &&
            p.name === r.parameterName &&
            String(p.defaultValue) === String(r.value) &&
            p.unit === r.unit &&
            p.scale === r.scale &&
            p.dataType === r.dataType
          );
        });

      if (isAlreadySynced) {
        return prev;
      }

      // 1. Group rows by target screen name
      const screenMap = new Map<string, any[]>();
      schemaRows.forEach(r => {
        const scrName = r.screen?.trim() || 'Chiller Plant System';
        if (!screenMap.has(scrName)) {
          screenMap.set(scrName, []);
        }
        screenMap.get(scrName)!.push(r);
      });

      // 2. Build updated screens list
      const updatedScreens: Screen[] = [];
      let screenIndex = 0;

      screenMap.forEach((rowsInScreen, screenName) => {
        const existingScreen = prev.screens.find(
          s => s.name.toLowerCase().trim() === screenName.toLowerCase().trim()
        );

        const bindings: ScreenVpBinding[] = rowsInScreen.map((row, idx) => ({
          id: `bind_${row.serialNumber || idx + 1}_${row.vpAddress}`,
          vpAddress: row.vpAddress,
          role: row.readWrite?.toLowerCase().includes('read only') ? 'data_display' : 'touch_input',
          label: row.parameterName,
          x: 40 + (idx % 4) * 170,
          y: 80 + Math.floor(idx / 4) * 75,
          width: 150,
          height: 48,
          notes: `Serial #${row.serialNumber || idx + 1} • ${row.vpHex} • Value: ${row.value} ${row.unit || ''}`
        }));

        if (existingScreen) {
          updatedScreens.push({
            ...existingScreen,
            name: screenName,
            vpBindings: bindings,
            updatedAt: new Date().toISOString()
          });
        } else {
          updatedScreens.push({
            id: `scr_${screenIndex}_${Date.now()}`,
            screenNumber: screenIndex,
            name: screenName,
            group: screenName,
            resolution: prev.resolution,
            bgImageIndex: screenIndex,
            description: `Screen synchronized with ${rowsInScreen.length} parameters from SCREEN Lab.`,
            vpBindings: bindings,
            navigations: [],
            updatedAt: new Date().toISOString()
          });
        }
        screenIndex++;
      });

      // 3. Build updated parameters list
      const updatedParams: Parameter[] = schemaRows.map((row, idx) => {
        const numVal = parseFloat(row.value) || 0;
        const cleanName = (row.parameterName || `Parameter ${idx + 1}`).trim();
        const ident = 'PARAM_' + cleanName.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_');
        const isDword = row.dataType === 'FLOAT32' || row.dataType === 'UINT32' || row.dataType === 'INT32';
        const serialNo = row.serialNumber || idx + 1;

        return {
          id: `param_${row.vpAddress.toString(16)}`,
          name: cleanName,
          identifier: ident,
          vpAddress: row.vpAddress,
          dataType: row.dataType || 'UINT16',
          words: isDword ? 2 : 1,
          unit: row.unit || '',
          scale: row.scale || 1,
          min: 0,
          max: row.unit === 'bar' ? 10 : row.unit === 'RPM' ? 3600 : row.unit === 'V' ? 1000 : 65535,
          defaultValue: numVal,
          role: row.readWrite?.toLowerCase().includes('read only') ? 'read_only' : 'read_write',
          group: row.screen?.trim() || 'Chiller Plant System',
          description: `Serial #${serialNo} • Device: ${row.device || prev.dwinModel} • Time: ${row.time || '31/10/26'} • FBST: ${row.fbst || '1793447194000'} • MCU ID: ${row.mcuId || ''} • VP: ${row.vpHex} • Live Hex: ${row.hexValue || ''}`,
          updatedAt: new Date().toISOString()
        };
      });

      return {
        ...prev,
        screens: updatedScreens.length > 0 ? updatedScreens : prev.screens,
        parameters: updatedParams,
        updatedAt: new Date().toISOString()
      };
    });
  };

  const deleteParameter = (id: string) => {
    setProject(prev => ({
      ...prev,
      parameters: prev.parameters.filter(p => p.id !== id),
      updatedAt: new Date().toISOString()
    }));
    if (selectedParamId === id) {
      setSelectedParamId(null);
    }
  };

  const duplicateParameter = (id: string): Parameter => {
    const target = project.parameters.find(p => p.id === id);
    const highestVp = project.parameters.reduce((max, p) => Math.max(max, p.vpAddress + p.words), 0x1000);
    const newParam: Parameter = {
      ...(target || {
        name: 'New Parameter',
        identifier: 'PARAM_NEW',
        vpAddress: highestVp,
        dataType: 'UINT16',
        words: 1,
        unit: '',
        scale: 1,
        min: 0,
        max: 65535,
        defaultValue: 0,
        role: 'read_write',
        group: 'General',
        description: ''
      }),
      id: 'param_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      name: `${target?.name || 'Param'} (Copy)`,
      identifier: `${target?.identifier || 'PARAM'}_COPY`,
      vpAddress: highestVp,
      updatedAt: new Date().toISOString()
    };

    setProject(prev => ({
      ...prev,
      parameters: [...prev.parameters, newParam],
      updatedAt: new Date().toISOString()
    }));
    setSelectedParamId(newParam.id);
    return newParam;
  };

  const jumpToHexLabWithParam = (param: Parameter) => {
    setHexLabPrefill({
      vpAddress: param.vpAddress,
      value: param.defaultValue,
      cmd: param.role === 'read_only' ? 0x83 : 0x82,
      mode: 'generator'
    });
    setActiveTab('hexlab');
  };

  const jumpToHexLabWithFrame = (frameHex: string) => {
    setHexLabPrefill({
      mode: 'decoder',
      presetHex: frameHex
    });
    setActiveTab('hexlab');
  };

  // Diagnostics and stats calculation
  const allBoundVps = new Set<number>();
  project.screens.forEach(s => s.vpBindings.forEach(b => allBoundVps.add(b.vpAddress)));

  // Orphan parameters (defined but not bound to any screen)
  const orphanParams = project.parameters.filter(p => !allBoundVps.has(p.vpAddress));

  // Inbound navigations to each screen
  const inboundScreens = new Set<number>();
  project.screens.forEach(s => s.navigations.forEach(n => inboundScreens.add(n.targetScreenNumber)));
  // Screen 0 is root, so only check other screens
  const orphanScreens = project.screens.filter(s => s.screenNumber !== 0 && !inboundScreens.has(s.screenNumber));

  // Duplicate / Overlapping VP addresses
  const vpMap = new Map<number, Parameter[]>();
  project.parameters.forEach(p => {
    for (let w = 0; w < p.words; w++) {
      const addr = p.vpAddress + w;
      const list = vpMap.get(addr) || [];
      list.push(p);
      vpMap.set(addr, list);
    }
  });

  let duplicateVpCount = 0;
  vpMap.forEach(list => {
    if (list.length > 1) duplicateVpCount++;
  });

  const totalVpBindings = project.screens.reduce((sum, s) => sum + s.vpBindings.length, 0);

  return (
    <DwinContext.Provider
      value={{
        project,
        activeTab,
        setActiveTab,
        selectedScreenId,
        setSelectedScreenId,
        selectedParamId,
        setSelectedParamId,
        hexLabPrefill,
        setHexLabPrefill,
        jumpToHexLabWithParam,
        jumpToHexLabWithFrame,
        updateProjectMetadata,
        resetProjectToDefault,
        createNewProject,
        importProject,
        isBatchScreenModalOpen,
        setIsBatchScreenModalOpen,
        openBatchScreenCreator,
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
        addParameter,
        updateParameter,
        deleteParameter,
        duplicateParameter,
        syncSchemaRows,
        stats: {
          totalScreens: project.screens.length,
          totalParameters: project.parameters.length,
          totalVpBindings,
          orphanParametersCount: orphanParams.length,
          orphanScreensCount: orphanScreens.length,
          duplicateVpCount
        }
      }}
    >
      {children}
    </DwinContext.Provider>
  );
};

export const useDwin = () => {
  const context = useContext(DwinContext);
  if (!context) {
    throw new Error('useDwin must be used within a DwinProvider');
  }
  return context;
};
