/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DwinProject } from '../types/dwin';

export const RECENT_PROJECTS_KEY = 'dwin_recent_projects_v2';

export interface RecentProjectSnapshot {
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

/**
 * Downloads a project as a formatted .json file directly to the client browser
 */
export const downloadProjectAsJson = (project: DwinProject): void => {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (project.name || 'dwin_project').toLowerCase().replace(/\s+/g, '_');
  link.download = `${safeName}_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Saves a project snapshot to recent projects in localStorage
 */
export const saveProjectToRecentStorage = (project: DwinProject, customName?: string): void => {
  const now = Date.now();
  const displayName = customName?.trim() || project.name || 'Untitled Project';
  const newItem: RecentProjectSnapshot = {
    id: `rec_${now}_${Math.random().toString(36).substring(2, 6)}`,
    name: displayName,
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
    projectData: {
      ...project,
      name: displayName,
      updatedAt: new Date(now).toISOString()
    }
  };

  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    const existing: RecentProjectSnapshot[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(p => p.name !== displayName);
    const updated = [newItem, ...filtered].slice(0, 10);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore quota errors
  }
};
