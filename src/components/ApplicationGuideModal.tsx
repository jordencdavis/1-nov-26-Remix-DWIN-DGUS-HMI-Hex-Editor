/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, X, BookOpen, Layers, Cpu, LayoutGrid, Binary, 
  ArrowRight, CheckCircle2, Sparkles, Tag, Sliders, Hash, 
  ExternalLink, FileText, ArrowUpDown, RotateCcw, Lightbulb,
  Edit3, Plus, Trash2, Save, Search, Check, Copy, AlertCircle,
  FolderPlus, Undo2
} from 'lucide-react';

export type GuideCategory = 'quickstart' | 'screenlab' | 'parameters' | 'hexprotocol' | 'tips' | 'custom';

export interface GuideTopic {
  id: string;
  category: GuideCategory;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'blue' | 'indigo' | 'emerald' | 'purple' | 'amber' | 'slate' | 'rose';
  content: string;
  bullets?: string[];
  codeSnippet?: string;
  isCustom?: boolean;
  isModified?: boolean;
  order: number;
}

const STORAGE_GUIDE_TOPICS_KEY = 'dwin_user_guide_topics_v3';

const INITIAL_GUIDE_TOPICS: GuideTopic[] = [
  // QUICK START
  {
    id: 'qs-welcome',
    category: 'quickstart',
    title: 'Welcome to DWIN DGUS HMI Hex Editor',
    subtitle: 'Industrial firmware & screen engineering suite',
    badge: 'Introduction',
    badgeColor: 'blue',
    content: 'This software enables end-to-end engineering for DWIN DGUS industrial smart displays: screen visual layout design, Variable Pointer (VP) RAM memory mapping, live serial frame calculation, and firmware exports.',
    bullets: [
      'Visual Canvas with live drag & drop coordinate mapping and pixel-accurate snap',
      'DGUS II Protocol: 0x82 variable write & 0x83 read/touch return frames with live calculation',
      'Firmware C header export with #define VP_* addresses ready for microcontroller compilation'
    ],
    order: 1
  },
  {
    id: 'qs-step1',
    category: 'quickstart',
    title: '1. Import & Tag DIV Data',
    subtitle: 'From raw industrial telemetry to structured variables',
    badge: 'Step 1',
    badgeColor: 'indigo',
    content: 'Paste raw HTML/DIV telemetry or upload .txt files in SCREEN Lab. Select a schema parameter radio button on top and highlight words in the text box to tag them.',
    bullets: [
      'Support for raw text, industrial telemetry dumps, and HTML divs with CSS positioning',
      'Staged selection with inline ✕ delete button before final registry commit',
      'Persistent tagging history with instant removal and radio-switch clearing'
    ],
    order: 2
  },
  {
    id: 'qs-step2',
    category: 'quickstart',
    title: '2. Configure 10 Parameters',
    subtitle: 'Standardized 10-column industrial matrix',
    badge: 'Step 2',
    badgeColor: 'emerald',
    content: 'In the Parameter Schema Matrix, each Serial Number is automatically assigned 1-to-1 to a VP address. Pick actual values from dropdowns, sort by screen, and edit values live.',
    bullets: [
      'Automatic 1-to-1 Serial Number to Variable Pointer (VP) address binding (e.g. 10 VPs -> 10 Serial Nos)',
      'Hex values auto-generate immediately as numeric or text values change',
      'Screen grouping with Sort button and Serial Number reassign sequence tool'
    ],
    order: 3
  },
  {
    id: 'qs-step3',
    category: 'quickstart',
    title: '3. Commit & Export to Registries',
    subtitle: 'Promote tagged variables to global project architecture',
    badge: 'Step 3',
    badgeColor: 'purple',
    content: 'Click "Finish & Add to Main Registries" to use your tagged parameters as standard project variables across Screen Registry, Parameter Registry, Hex Lab, and C headers.',
    bullets: [
      'Instant synchronization across all workspace tabs without manual re-typing',
      'Zero data loss with project state preservation and export capabilities'
    ],
    order: 4
  },
  {
    id: 'qs-overview-workspaces',
    category: 'quickstart',
    title: 'Application Workspaces Overview',
    subtitle: 'Comprehensive tools for DWIN T5L / DGUS II development',
    badge: 'Workspace Map',
    badgeColor: 'slate',
    content: 'DWIN HEX Design Software includes six dedicated engineering workspaces accessible from the top navigation bar:',
    bullets: [
      'SCREEN Lab: Interactive raw DIV parser, visual canvas, 10-parameter tagging, and live hex command generator',
      'Screen Registry: Screen catalog (#00 - #99), background images, resolution config, and touch/display bindings',
      'Parameter Registry: DWIN RAM Variable Pointer memory map (0x1000 - 0xFFFF), data types, and scale',
      'Hex Lab & Import/Export: Live DGUS frame packet simulator (5A A5), CRC verification, CSV export, and C firmware headers'
    ],
    order: 5
  },

  // SCREEN LAB
  {
    id: 'sl-overview',
    category: 'screenlab',
    title: 'SCREEN Lab Overview & Pipeline',
    subtitle: 'Convert unstructured telemetry into verified DWIN registers',
    badge: 'Core Engine',
    badgeColor: 'indigo',
    content: 'SCREEN Lab is the core tagging workspace where raw dumped text from industrial machinery, PLCs, or web interfaces is converted into structured DWIN HMI screens and VP parameters.',
    bullets: [
      'Automatic coordinate extraction (left, top, width, height) from inline CSS styles',
      'Visual drag-and-drop repositioning with instant X, Y telemetry sync'
    ],
    order: 1
  },
  {
    id: 'sl-step1-tagging',
    category: 'screenlab',
    title: '10 Schema Radio Buttons & Word Tagging',
    subtitle: 'Precise multi-word or single-token semantic tagging',
    badge: 'Tagging Tool',
    badgeColor: 'indigo',
    content: 'In Section 1, choose one of the 10 schema parameter radio buttons on top (e.g. 4. Parameter Name, 5. Unit, 8. Value). Click any word or drag across a group of words in the text box to tag it.',
    bullets: [
      'Tagged words appear with an amber staged badge and inline ✕ delete button',
      'The sidebar shows continuous tagging history with instant delete buttons',
      'Switching radio buttons clears staged selections cleanly before commitment'
    ],
    order: 2
  },
  {
    id: 'sl-step2-canvas',
    category: 'screenlab',
    title: 'Interactive DWIN Canvas Visualizer',
    subtitle: 'Pixel-accurate industrial display layout editor',
    badge: 'Visual Canvas',
    badgeColor: 'blue',
    content: 'Section 2 renders an exact resolution canvas representing your physical DWIN smart display. Reposition widgets and observe coordinate updates in real time.',
    bullets: [
      'Drag elements directly on canvas to reposition their (X, Y) coordinates',
      'Switch background themes (Blueprint Panel, Industrial Dashboard, Dark/Light grids)',
      'Use zoom controls (+, -, Reset) for pixel-precise alignment'
    ],
    order: 3
  },
  {
    id: 'sl-step3-matrix',
    category: 'screenlab',
    title: '10-Parameter Matrix Table & Live Hex Generator',
    subtitle: 'Direct serial-to-VP mapping matrix',
    badge: 'Matrix & Hex',
    badgeColor: 'emerald',
    content: 'Section 3 organizes your data into the standard 10-column schema matrix: Serial No, Screen No, Screen Name, Parameter Name, Unit, Data Type, VP Address, Value, Hex Value, Frame.',
    bullets: [
      'Serial numbers are automatically bound 1-to-1 to each VP address',
      'Hex value calculates instantly as values are edited (e.g., 72 -> 0x0048)',
      'Live DGUS 0x82 serial command frames update automatically in column 10'
    ],
    order: 4
  },
  {
    id: 'sl-sort-reassign',
    category: 'screenlab',
    title: 'Sorting by Screen & Serial Number Reassign',
    subtitle: 'Keep records grouped by page while maintaining clean #1..#N ordering',
    badge: 'Table Tools',
    badgeColor: 'amber',
    content: 'When screens are configured differently, table rows can be sorted by Screen Number using the Sort button on the Screen column header. Once sorted, click the Reassign icon on the Serial Number column header to re-index all rows sequentially #1 to #N.',
    bullets: [
      'Sort button clusters rows by screen index for orderly verification',
      'Reassign icon recalculates clean 1..N serial sequence and maintains VP alignment'
    ],
    order: 5
  },

  // PARAMETERS & REGISTRIES
  {
    id: 'reg-screen',
    category: 'parameters',
    title: 'Screen Registry Management',
    subtitle: 'DWIN DGUS Page architecture (#00 - #99)',
    badge: 'Page Catalog',
    badgeColor: 'blue',
    content: 'DWIN DGUS displays use page numbers from 00 to 99 (or up to 255 depending on flash configuration). Page 00 is typically reserved for Boot Logo or Main Home Dashboard.',
    bullets: [
      'Configure screen name, resolution, and description',
      'Assign background images (BMP / JPG) matching target display resolution',
      'Bind touch areas and variable display controls directly to each screen'
    ],
    order: 1
  },
  {
    id: 'reg-param-vp',
    category: 'parameters',
    title: 'Parameter Registry & VP RAM Mapping',
    subtitle: 'DWIN DGUS Variable Pointer RAM memory architecture',
    badge: 'Memory Map',
    badgeColor: 'emerald',
    content: 'Variable Pointer (VP) addresses represent locations in DWIN display RAM where dynamic data resides. User RAM begins at 0x1000 and spans up to 0xFFFF.',
    bullets: [
      'System Control VPs: 0x0084 (Page Jump), 0x0082 (RTC), 0x0080 (Buzzer)',
      'User Variable RAM: 0x1000 - 0xFFFF (over 60,000 available 16-bit word addresses)',
      'Each VP can store numeric values, gauge positions, bar graph levels, or text'
    ],
    order: 2
  },
  {
    id: 'reg-data-types',
    category: 'parameters',
    title: 'Data Types & Word Alignments',
    subtitle: '16-bit words, 32-bit dwords, and byte alignments',
    badge: 'Data Types',
    badgeColor: 'purple',
    content: 'DWIN RAM is organized as 16-bit words. When configuring multi-word data types, ensure memory offsets prevent overlap:',
    bullets: [
      'UINT16 / INT16: 1 word (2 bytes). Next available VP = VP + 1',
      'UINT32 / INT32 / FLOAT32: 2 words (4 bytes). Next available VP = VP + 2',
      'TEXT_ASCII: 1 word per 2 characters. E.g., 16 characters requires 8 words'
    ],
    order: 3
  },

  // HEX PROTOCOL
  {
    id: 'hex-frame-format',
    category: 'hexprotocol',
    title: 'DWIN DGUS II Serial Frame Format',
    subtitle: 'Standard UART packet architecture (Header: 5A A5)',
    badge: 'UART Protocol',
    badgeColor: 'purple',
    content: 'Every command sent to or received from a DWIN DGUS display follows a deterministic byte sequence: Header, Length, Command Code, VP Address, and Data Payload.',
    bullets: [
      'Header: Fixed 2 bytes 0x5A 0xA5',
      'Length: Total number of remaining bytes in the frame (Command + VP + Data)',
      'Command: 0x82 (Variable Write) or 0x83 (Variable Read / Touch Return)',
      'VP Address: 2 bytes High + Low (e.g. 0x1020 -> 10 20)',
      'Data: 16-bit big-endian payload words'
    ],
    codeSnippet: '5A A5 05 82 10 20 00 48',
    order: 1
  },
  {
    id: 'hex-cmd-82',
    category: 'hexprotocol',
    title: '0x82 Command: Variable Write',
    subtitle: 'Microcontroller writes dynamic data into DWIN screen RAM',
    badge: 'MCU -> DWIN',
    badgeColor: 'indigo',
    content: 'The microcontroller sends 0x82 frames to update gauges, digital meters, temperatures, alarms, and status texts displayed on screen.',
    codeSnippet: '5A A5 05 82 10 00 03 E8  // Writes 1000 (0x03E8) into VP 0x1000',
    bullets: [
      'Frame breakdown: [5A A5] Header, [05] Length (5 bytes follow), [82] Write cmd, [10 00] VP 0x1000, [03 E8] Data 1000',
      'Can write multiple consecutive words in a single burst by increasing length byte'
    ],
    order: 2
  },
  {
    id: 'hex-cmd-83',
    category: 'hexprotocol',
    title: '0x83 Command: Variable Read & Touch Return',
    subtitle: 'DWIN display sends touch feedback or keypad entries to MCU',
    badge: 'DWIN -> MCU',
    badgeColor: 'blue',
    content: 'When an operator taps a touch button or enters a setpoint on the screen, the DWIN display automatically transmits an 0x83 frame over the serial port.',
    codeSnippet: '5A A5 06 83 10 00 01 00 01  // Button pressed notification',
    bullets: [
      'Used for push buttons, switches, numeric keypad inputs, and menu selections',
      'Microcontroller UART interrupt parses this packet to trigger hardware actions'
    ],
    order: 3
  },

  // PRO TIPS
  {
    id: 'tips-word-alignment',
    category: 'tips',
    title: 'Word Alignment for 32-bit Values',
    subtitle: 'Avoid accidental memory overwrite in adjacent variables',
    badge: 'Memory Alignment',
    badgeColor: 'emerald',
    content: 'When using FLOAT32, UINT32, or INT32, each parameter occupies 2 words. Ensure next parameter starts at VP + 2 (e.g. 0x1020 occupies 0x1020 & 0x1021; next parameter must start at 0x1022).',
    bullets: [
      'Overlapping 32-bit parameters causes erratic number displays on screen',
      'Use the Parameter Registry table to verify there are no address collisions'
    ],
    order: 1
  },
  {
    id: 'tips-sort-reassign',
    category: 'tips',
    title: 'Sorting & Reassigning Serial Numbers',
    subtitle: 'Restore clean sequential indexes after sorting screens',
    badge: 'Matrix Workflow',
    badgeColor: 'blue',
    content: 'Use the Sort button on the Screen header to cluster rows by page. Once rearranged, click the Reassign icon on the Serial Number column to instantly restore clean #1, #2, #3... sequence.',
    bullets: [
      'Ensures reports and tables remain clean and professional',
      'Retains 1-to-1 association with VP addresses'
    ],
    order: 2
  },
  {
    id: 'tips-cheader-export',
    category: 'tips',
    title: 'Firmware C-Header Export (dwin_vps.h)',
    subtitle: 'Single-click generation of firmware definitions',
    badge: 'Firmware Code',
    badgeColor: 'purple',
    content: 'Navigate to Import/Export tab to export dwin_vps.h. This file includes clean C #define VP_PARAM_NAME 0x1020 macros ready to paste into STM32, ESP32, or Arduino firmware.',
    codeSnippet: '#define VP_CHILLER_STATE 0x1000\n#define VP_SUPPLY_TEMP   0x1002',
    bullets: [
      'Eliminates manual address transcription errors in firmware',
      'Includes parameter scales, data types, and min/max comments'
    ],
    order: 3
  },
  {
    id: 'tips-baudrate-hardware',
    category: 'tips',
    title: 'Baud Rate & Hardware Wiring Rules',
    subtitle: 'UART voltage levels and ground integrity',
    badge: 'Hardware',
    badgeColor: 'amber',
    content: 'Default DWIN baud rate is 115200 8N1 with 3.3V / 5V TTL levels. Always ensure common ground (GND) between microcontroller and display to prevent serial framing errors.',
    bullets: [
      'Connect display TX to MCU RX, display RX to MCU TX, and connect GND together',
      'Power DWIN displays with adequate current (typically 5V @ 500mA - 1A)'
    ],
    order: 4
  }
];

interface ApplicationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'screens' | 'screenlab' | 'parameters' | 'explorer' | 'hexlab' | 'import_export') => void;
}

export const ApplicationGuideModal: React.FC<ApplicationGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  // Topics state
  const [topics, setTopics] = useState<GuideTopic[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GUIDE_TOPICS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load guide topics from localStorage', e);
    }
    return INITIAL_GUIDE_TOPICS;
  });

  const [activeGuideTab, setActiveGuideTab] = useState<GuideCategory | 'all'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Edit/Add Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<GuideCategory>('quickstart');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formBadgeColor, setFormBadgeColor] = useState<'blue' | 'indigo' | 'emerald' | 'purple' | 'amber' | 'slate' | 'rose'>('blue');
  const [formContent, setFormContent] = useState('');
  const [formBullets, setFormBullets] = useState<string[]>(['']);
  const [formCodeSnippet, setFormCodeSnippet] = useState('');

  // Persist topics to localStorage whenever changed
  const saveTopics = (updatedTopics: GuideTopic[], notice?: string) => {
    setTopics(updatedTopics);
    try {
      localStorage.setItem(STORAGE_GUIDE_TOPICS_KEY, JSON.stringify(updatedTopics));
    } catch (e) {
      console.warn('Failed to save guide topics', e);
    }
    if (notice) {
      setFeedbackNotice(notice);
      setTimeout(() => setFeedbackNotice(null), 3500);
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all guide topics and divs back to factory defaults? Custom topics will be cleared.')) {
      saveTopics(INITIAL_GUIDE_TOPICS, 'All guide topics reset to factory default!');
    }
  };

  // Open editor for creating a new div/topic
  const handleOpenAddTopic = (prefilledCategory?: GuideCategory) => {
    setEditingTopicId(null);
    setFormCategory(prefilledCategory && prefilledCategory !== 'custom' ? prefilledCategory : (activeGuideTab === 'all' ? 'quickstart' : activeGuideTab));
    setFormTitle('');
    setFormSubtitle('');
    setFormBadge('New Topic');
    setFormBadgeColor('indigo');
    setFormContent('');
    setFormBullets(['']);
    setFormCodeSnippet('');
    setIsEditorOpen(true);
  };

  // Open editor for modifying an existing div/topic
  const handleOpenEditTopic = (topic: GuideTopic) => {
    setEditingTopicId(topic.id);
    setFormCategory(topic.category);
    setFormTitle(topic.title);
    setFormSubtitle(topic.subtitle || '');
    setFormBadge(topic.badge || '');
    setFormBadgeColor(topic.badgeColor || 'blue');
    setFormContent(topic.content);
    setFormBullets(topic.bullets && topic.bullets.length > 0 ? [...topic.bullets] : ['']);
    setFormCodeSnippet(topic.codeSnippet || '');
    setIsEditorOpen(true);
  };

  // Delete a topic
  const handleDeleteTopic = (topicId: string, topicTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${topicTitle}"?`)) {
      const updated = topics.filter(t => t.id !== topicId);
      saveTopics(updated, `Deleted topic: "${topicTitle}"`);
    }
  };

  // Save changes from editor form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Please enter a title for this topic/div.');
      return;
    }

    const cleanBullets = formBullets.map(b => b.trim()).filter(Boolean);

    if (editingTopicId) {
      // Update existing topic
      const updated = topics.map(t => {
        if (t.id === editingTopicId) {
          return {
            ...t,
            category: formCategory,
            title: formTitle.trim(),
            subtitle: formSubtitle.trim() || undefined,
            badge: formBadge.trim() || undefined,
            badgeColor: formBadgeColor,
            content: formContent.trim(),
            bullets: cleanBullets.length > 0 ? cleanBullets : undefined,
            codeSnippet: formCodeSnippet.trim() || undefined,
            isModified: true
          };
        }
        return t;
      });
      saveTopics(updated, `Updated "${formTitle.trim()}"`);
    } else {
      // Create new topic / div
      const newTopic: GuideTopic = {
        id: `topic-custom-${Date.now()}`,
        category: formCategory,
        title: formTitle.trim(),
        subtitle: formSubtitle.trim() || undefined,
        badge: formBadge.trim() || undefined,
        badgeColor: formBadgeColor,
        content: formContent.trim(),
        bullets: cleanBullets.length > 0 ? cleanBullets : undefined,
        codeSnippet: formCodeSnippet.trim() || undefined,
        isCustom: true,
        order: Date.now()
      };
      saveTopics([...topics, newTopic], `Added new topic: "${formTitle.trim()}"`);
      // If user was on another tab, switch to where it was added
      if (activeGuideTab !== 'all' && activeGuideTab !== formCategory) {
        setActiveGuideTab(formCategory);
      }
    }

    setIsEditorOpen(false);
  };

  const handleAddBulletInput = () => {
    setFormBullets([...formBullets, '']);
  };

  const handleRemoveBulletInput = (index: number) => {
    const updated = formBullets.filter((_, i) => i !== index);
    setFormBullets(updated.length > 0 ? updated : ['']);
  };

  const handleBulletChange = (index: number, val: string) => {
    const updated = [...formBullets];
    updated[index] = val;
    setFormBullets(updated);
  };

  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  // Filtered topics
  const filteredTopics = topics.filter(t => {
    const matchesTab = activeGuideTab === 'all' || t.category === activeGuideTab;
    if (!matchesTab) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchTitle = t.title.toLowerCase().includes(query);
    const matchSubtitle = t.subtitle?.toLowerCase().includes(query);
    const matchContent = t.content.toLowerCase().includes(query);
    const matchBullets = t.bullets?.some(b => b.toLowerCase().includes(query));
    const matchBadge = t.badge?.toLowerCase().includes(query);
    return Boolean(matchTitle || matchSubtitle || matchContent || matchBullets || matchBadge);
  });

  // Count by category
  const getCategoryCount = (cat: GuideCategory) => {
    return topics.filter(t => t.category === cat).length;
  };

  const badgeColorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div 
        className="bg-white border border-slate-200 rounded-2xl max-w-6xl xl:max-w-7xl w-[96vw] max-h-[92vh] h-[92vh] grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[290px_1fr] grid-rows-[auto_1fr_auto] shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-guide-title"
      >
        {/* Modal Header */}
        <div className="col-span-full px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <BookOpen className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 id="app-guide-title" className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>DWIN HEX Design Software — User Guide &amp; Knowledge Base</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-normal">
                  v2.6 Editable
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Interactive guide &amp; custom documentation — edit any div card or add new custom topics and instructions.
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* ADD NEW TOPIC / DIV BUTTON */}
            <button
              type="button"
              onClick={() => handleOpenAddTopic()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Add a new custom div / topic to documentation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Topic / Div</span>
            </button>

            {/* RESET TO DEFAULTS BUTTON */}
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset all guide cards to factory defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* CLOSE MODAL BUTTON */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
              aria-label="Close guide modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback notification toast */}
        {feedbackNotice && (
          <div className="col-span-full bg-emerald-500 text-white px-5 py-1.5 text-xs font-semibold flex items-center justify-between shadow-xs transition-all">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{feedbackNotice}</span>
            </div>
            <button 
              onClick={() => setFeedbackNotice(null)}
              className="text-emerald-100 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Left Navigation Sidebar */}
        <div className="bg-slate-50 border-r border-slate-200 flex flex-col justify-between overflow-y-auto p-3.5 text-xs font-medium min-h-0 space-y-4">
          <div className="space-y-3.5">
            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search topics / divs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-6 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Add Topic Button in Sidebar */}
            <button
              type="button"
              onClick={() => handleOpenAddTopic(activeGuideTab === 'all' ? undefined : activeGuideTab)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Add a new custom div / topic to documentation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Topic / Div</span>
            </button>

            {/* Sections & Categories Heading */}
            <div className="px-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Documentation Sections
            </div>

            {/* Category Nav Buttons */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveGuideTab('quickstart')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'quickstart'
                    ? 'bg-blue-50 text-blue-900 border border-blue-200/80 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>1. Quick Start</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {getCategoryCount('quickstart')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('screenlab')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'screenlab'
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>2. SCREEN Lab</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {getCategoryCount('screenlab')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('parameters')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'parameters'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>3. Registries</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {getCategoryCount('parameters')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('hexprotocol')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'hexprotocol'
                    ? 'bg-purple-50 text-purple-900 border border-purple-200/80 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Binary className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>4. Hex Protocol</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {getCategoryCount('hexprotocol')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('tips')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'tips'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200/80 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>5. Pro Tips</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {getCategoryCount('tips')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('custom')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'custom'
                    ? 'bg-rose-50 text-rose-900 border border-rose-200/80 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>6. Custom Notes</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                  {getCategoryCount('custom')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('all')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  activeGuideTab === 'all'
                    ? 'bg-slate-200/80 text-slate-900 border border-slate-300 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>All Topics</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
                  {topics.length}
                </span>
              </button>
            </div>

            {/* Topic Quick Jump List in Active Section */}
            {activeGuideTab !== 'all' && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="px-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Topics in Section ({filteredTopics.length})
                </div>
                <div className="space-y-0.5 max-h-44 overflow-y-auto custom-nav-scroll pr-1">
                  {filteredTopics.map(topic => (
                    <div
                      key={topic.id}
                      className="text-[11px] text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/70 px-2 py-1 rounded cursor-pointer truncate flex items-center gap-1.5 transition-colors"
                      title={topic.title}
                      onClick={() => {
                        const el = document.getElementById(`topic-card-${topic.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span className="truncate">{topic.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer Info & Reset */}
          <div className="pt-2.5 border-t border-slate-200 space-y-2">
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{topics.length} Total Topics</span>
              <span>{topics.filter(t => t.isCustom).length} Custom</span>
            </div>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] transition-colors cursor-pointer"
              title="Reset all guide cards to factory defaults"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset Factory Defaults</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 text-slate-800 text-xs leading-relaxed bg-slate-50/40 min-h-0">
          {/* Quick Start welcome banner (if on quick start tab or all) */}
          {(activeGuideTab === 'quickstart' || activeGuideTab === 'all') && !searchQuery && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>DWIN DGUS II Interactive Knowledge Base</span>
                </h3>
                <p className="text-xs text-blue-900 mt-1">
                  Every card below can be directly edited via its <strong>Edit</strong> button. You can also add your own custom divs and topics for team notes, customer specs, or pinout diagrams.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenAddTopic('quickstart')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Div</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateTab('screenlab');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Launch SCREEN Lab</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* List of topic cards */}
          {filteredTopics.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-slate-600 font-semibold text-sm">
                {searchQuery ? `No topics match "${searchQuery}"` : 'No topics in this category yet'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click the button below to add your first custom div or topic card to this section.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddTopic(activeGuideTab === 'all' ? undefined : activeGuideTab)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Div / Topic</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTopics.map(topic => {
                const badgeColorClass = badgeColorClasses[topic.badgeColor || 'blue'] || badgeColorClasses.blue;

                return (
                  <div
                    key={topic.id}
                    id={`topic-card-${topic.id}`}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-2xs flex flex-col justify-between transition-all group relative"
                  >
                    <div>
                      {/* Topic Header: Title, Badge, and Action Buttons (Edit / Delete) */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {topic.badge && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColorClass}`}>
                                {topic.badge}
                              </span>
                            )}
                            {topic.isCustom && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                                Custom Div
                              </span>
                            )}
                            {topic.isModified && !topic.isCustom && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                Edited
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-snug">
                            {topic.title}
                          </h4>
                          {topic.subtitle && (
                            <p className="text-[11px] font-medium text-slate-500">
                              {topic.subtitle}
                            </p>
                          )}
                        </div>

                        {/* EDIT BUTTON ON EACH DIV */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTopic(topic)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                            title="Edit this div card"
                          >
                            <Edit3 className="w-3 h-3 text-indigo-600" />
                            <span>Edit</span>
                          </button>

                          {(topic.isCustom || topic.isModified) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTopic(topic.id, topic.title)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete this topic"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content Description */}
                      <p className="text-slate-600 text-xs leading-relaxed mt-2 whitespace-pre-line">
                        {topic.content}
                      </p>

                      {/* Bullets List */}
                      {topic.bullets && topic.bullets.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {topic.bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Code Snippet Box */}
                      {topic.codeSnippet && (
                        <div className="mt-3 p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] border border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                          <code className="text-emerald-300 select-all whitespace-pre">
                            {topic.codeSnippet}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(topic.id, topic.codeSnippet!)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                            title="Copy code snippet"
                          >
                            {copiedSnippetId === topic.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Info */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Category: {topic.category}</span>
                      <span>ID: {topic.id}</span>
                    </div>
                  </div>
                );
              })}

              {/* "+ Add New Div in this Category" Placeholder Card */}
              <div 
                onClick={() => handleOpenAddTopic(activeGuideTab === 'all' ? undefined : activeGuideTab)}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group min-h-[160px]"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-700 group-hover:text-indigo-900 text-xs">
                  + Add New Div / Topic
                </div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Add custom documentation, register notes, or wiring specs to this guide.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="col-span-full px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
            <span>DWIN DGUS II / T5L Architecture</span>
            <span>•</span>
            <span>{topics.length} Documented Topics</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddTopic()}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-700 border border-slate-300 font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Topic / Div</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('screenlab');
              }}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <span>Open SCREEN Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* EDIT / ADD TOPIC & DIV DIALOG FORM MODAL                        */}
      {/* ============================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-100">
          <div 
            className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Form Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingTopicId ? 'Edit Div / Topic Card' : 'Add New Div / Topic Card'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Category / Tab Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as GuideCategory)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="quickstart">1. Quick Start</option>
                    <option value="screenlab">2. SCREEN Lab</option>
                    <option value="parameters">3. Registries (Screen &amp; VP)</option>
                    <option value="hexprotocol">4. Hex Protocol</option>
                    <option value="tips">5. Pro Tips &amp; Best Practices</option>
                    <option value="custom">6. Custom Notes &amp; Specifications</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Badge Label (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Step 4, Tip, UART"
                      value={formBadge}
                      onChange={e => setFormBadge(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-1 focus:ring-indigo-500"
                    />
                    <select
                      value={formBadgeColor}
                      onChange={e => setFormBadgeColor(e.target.value as any)}
                      className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-medium"
                      title="Badge color theme"
                    >
                      <option value="blue">Blue</option>
                      <option value="indigo">Indigo</option>
                      <option value="emerald">Emerald</option>
                      <option value="purple">Purple</option>
                      <option value="amber">Amber</option>
                      <option value="rose">Rose</option>
                      <option value="slate">Slate</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Topic / Div Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Touch Screen Calibration Instructions"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-bold focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Subtitle / Short Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4-point resistive calibration procedure"
                  value={formSubtitle}
                  onChange={e => setFormSubtitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Main Content Description */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Detailed Description / Main Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide clear steps, explanation, or protocol definitions..."
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>

              {/* Bullet Points */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-bold">
                    Bullet Points / Checklist (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddBulletInput}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Bullet</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {formBullets.map((bullet, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-[10px] w-4">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        placeholder="Key point, requirement, or rule..."
                        value={bullet}
                        onChange={e => handleBulletChange(idx, e.target.value)}
                        className="flex-1 px-3 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-1 focus:ring-indigo-500 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBulletInput(idx)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Remove this bullet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Snippet */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Code / Hex Example Snippet (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5A A5 05 82 10 20 00 01"
                  value={formCodeSnippet}
                  onChange={e => setFormCodeSnippet(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-900 text-emerald-400 font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingTopicId ? 'Save Changes' : 'Add Topic / Div'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
