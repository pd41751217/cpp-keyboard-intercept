export {};

/**
 * Initialize the application
 */
async function initializeApp() {
  // IPC from main process (Electron nodeIntegration is enabled)
  let ipcRenderer: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {
    console.warn('ipcRenderer not available:', e);
  }
  // Create video element
  console.log('Initializing app');
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.src = './big-buck-bunny_trailer (1).webm';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.opacity = '0.5'; // 50% transparent background

  // Create main container
  const container = document.createElement('div');
  container.id = 'overlay-root';
  container.style.position = 'relative';
  container.style.width = '90vw';
  container.style.height = '90vh';
  container.style.overflow = 'visible'; // Allow dropdowns to extend beyond container
  container.style.display = 'none'; // Hidden by default

  // Create overlay interface
  const overlayInterface = document.createElement('div');
  overlayInterface.style.position = 'absolute';
  overlayInterface.style.top = '0';
  overlayInterface.style.left = '0';
  overlayInterface.style.width = '100%';
  overlayInterface.style.height = '100%';
  overlayInterface.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  overlayInterface.style.padding = '20px';
  overlayInterface.style.boxSizing = 'border-box';
  overlayInterface.style.zIndex = '10';
  overlayInterface.style.overflow = 'visible'; // Allow dropdowns to extend beyond
  overlayInterface.style.display = 'flex';
  overlayInterface.style.flexDirection = 'column';

  // Create header
  const header = document.createElement('div');
  header.style.marginBottom = '20px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.gap = '20px';

  const title = document.createElement('h1');
  title.textContent = 'Keyboard Mapping';
  title.style.color = 'white';
  title.style.margin = '0';
  title.style.fontFamily = 'Arial, sans-serif';
  title.style.fontSize = '24px';
  title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
  title.style.flex = '1';
  title.style.textAlign = 'left';

  const newButton = document.createElement('button');
  newButton.textContent = 'New';
  newButton.style.backgroundColor = '#4CAF50';
  newButton.style.color = 'white';
  newButton.style.border = 'none';
  newButton.style.padding = '12px 24px';
  newButton.style.borderRadius = '6px';
  newButton.style.fontSize = '16px';
  newButton.style.cursor = 'pointer';
  newButton.style.fontWeight = 'bold';
  newButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  newButton.onmouseover = () => newButton.style.backgroundColor = '#45a049';
  newButton.onmouseout = () => newButton.style.backgroundColor = '#4CAF50';


  const hideButton = document.createElement('button');
  hideButton.textContent = 'Hide (End)';
  hideButton.style.backgroundColor = '#f44336';
  hideButton.style.color = 'white';
  hideButton.style.border = 'none';
  hideButton.style.padding = '12px 24px';
  hideButton.style.borderRadius = '6px';
  hideButton.style.fontSize = '16px';
  hideButton.style.cursor = 'pointer';
  hideButton.style.fontWeight = 'bold';
  hideButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  hideButton.onmouseover = () => hideButton.style.backgroundColor = '#d32f2f';
  hideButton.onmouseout = () => hideButton.style.backgroundColor = '#f44336';

  header.appendChild(title);
  header.appendChild(hideButton);

  // Tabs container
  const tabs = document.createElement('div');
  tabs.style.display = 'flex';
  tabs.style.gap = '8px';
  tabs.style.margin = '0 20px 12px 20px';

  const keyboardTabBtn = document.createElement('button');
  keyboardTabBtn.textContent = 'Keyboard';
  keyboardTabBtn.style.padding = '8px 14px';
  keyboardTabBtn.style.borderRadius = '6px';
  keyboardTabBtn.style.border = '1px solid rgba(255,255,255,0.3)';
  keyboardTabBtn.style.backgroundColor = '#1976d2';
  keyboardTabBtn.style.color = 'white';
  keyboardTabBtn.style.cursor = 'pointer';
  keyboardTabBtn.style.fontWeight = 'bold';

  const mouseTabBtn = document.createElement('button');
  mouseTabBtn.textContent = 'Mouse';
  mouseTabBtn.style.padding = '8px 14px';
  mouseTabBtn.style.borderRadius = '6px';
  mouseTabBtn.style.border = '1px solid rgba(255,255,255,0.3)';
  mouseTabBtn.style.backgroundColor = 'rgba(255,255,255,0.15)';
  mouseTabBtn.style.color = 'white';
  mouseTabBtn.style.cursor = 'pointer';

  tabs.appendChild(keyboardTabBtn);
  tabs.appendChild(mouseTabBtn);

  // Create mapping rows container (Keyboard)
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'mapping-rows-container';
  rowsContainer.style.maxHeight = 'calc(100vh - 240px)';
  rowsContainer.style.overflowY = 'auto';
  rowsContainer.style.overflowX = 'visible'; // Allow dropdowns to extend beyond container
  rowsContainer.style.padding = '20px';
  rowsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  rowsContainer.style.borderRadius = '8px';
  rowsContainer.style.backdropFilter = 'blur(10px)';
  rowsContainer.style.border = '2px solid rgba(255, 255, 255, 0.3)';
  rowsContainer.style.margin = '0 20px';
  rowsContainer.style.position = 'relative';
  rowsContainer.style.zIndex = '100';
  rowsContainer.style.flex = '1 1 auto';
  rowsContainer.style.minHeight = '0';

  // Keyboard footer (holds New button at bottom)
  const keyboardFooter = document.createElement('div');
  keyboardFooter.style.display = 'flex';
  keyboardFooter.style.justifyContent = 'flex-end';
  keyboardFooter.style.gap = '10px';
  keyboardFooter.style.margin = '10px 20px 0 20px';
  keyboardFooter.appendChild(newButton);

  // Create mouse mapping container
  const mouseContainer = document.createElement('div');
  mouseContainer.className = 'mouse-mapping-container';
  mouseContainer.style.maxHeight = 'calc(100vh - 240px)';
  mouseContainer.style.overflowY = 'auto';
  mouseContainer.style.overflowX = 'visible';
  mouseContainer.style.padding = '20px';
  mouseContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  mouseContainer.style.borderRadius = '8px';
  mouseContainer.style.backdropFilter = 'blur(10px)';
  mouseContainer.style.border = '2px solid rgba(255, 255, 255, 0.3)';
  mouseContainer.style.margin = '0 20px';
  mouseContainer.style.position = 'relative';
  mouseContainer.style.zIndex = '100';
  mouseContainer.style.display = 'none';
  mouseContainer.style.flex = '1 1 auto';
  mouseContainer.style.minHeight = '0';

  // Build Mouse Mapping UI
  const mouseUI = createMouseMappingSection();
  mouseContainer.appendChild(mouseUI);

  // Add elements to containers
  //container.appendChild(video);
  overlayInterface.appendChild(header);
  overlayInterface.appendChild(tabs);
  overlayInterface.appendChild(rowsContainer);
  overlayInterface.appendChild(keyboardFooter);
  overlayInterface.appendChild(mouseContainer);
  container.appendChild(overlayInterface);
  document.body.appendChild(container);

  // Load saved settings or initialize with default row
  loadSettings(rowsContainer);

  // New button click handler (only for Keyboard tab)
  newButton.addEventListener('click', () => {
    addMappingRow(rowsContainer);
  });

  // Tab switching logic
  function activateKeyboardTab() {
    title.textContent = 'Keyboard Mapping';
    rowsContainer.style.display = 'block';
    mouseContainer.style.display = 'none';
    keyboardFooter.style.display = 'flex';
    keyboardTabBtn.style.backgroundColor = '#1976d2';
    mouseTabBtn.style.backgroundColor = 'rgba(255,255,255,0.15)';
  }
  function activateMouseTab() {
    title.textContent = 'Mouse Mapping';
    rowsContainer.style.display = 'none';
    mouseContainer.style.display = 'block';
    keyboardFooter.style.display = 'none';
    keyboardTabBtn.style.backgroundColor = 'rgba(255,255,255,0.15)';
    mouseTabBtn.style.backgroundColor = '#1976d2';
  }
  keyboardTabBtn.addEventListener('click', activateKeyboardTab);
  mouseTabBtn.addEventListener('click', activateMouseTab);

  // Helper to collect mouse settings from UI for IPC
  function collectMouseSettingsFromUi(): MouseSettings {
    const def: MouseSettings = { swapButtons: false, numpad5Primary: false, numpadPlusSecondary: false, yAxisInvert: false, movingSpeed: 1.0 };
    try {
      const mc = document.querySelector('.mouse-mapping-container') as HTMLElement | null;
      if (!mc) return def;
      const getBool = (k: string) => !!((mc.querySelector(`input[type="checkbox"][data-setting="${k}"]`) as HTMLInputElement | null)?.checked);
      const speedEl = mc.querySelector('input[type="range"][data-setting="movingSpeed"]') as HTMLInputElement | null;
      return {
        swapButtons: getBool('swapButtons'),
        numpad5Primary: getBool('numpad5Primary'),
        numpadPlusSecondary: getBool('numpadPlusSecondary'),
        yAxisInvert: getBool('yAxisInvert'),
        movingSpeed: speedEl ? Math.max(0.1, Math.min(5.0, parseFloat(speedEl.value || '1.0'))) : 1.0,
      };
    } catch { return def; }
  }

  // Hide button click handler
  hideButton.addEventListener('click', () => {
    saveSettingsToFile(rowsContainer);
    const root = document.getElementById('overlay-root');
    if (root) {
      root.style.display = 'none';
    }
    // Send settings to main to apply (same as IPC handler)
    try {
      const rows = rowsContainer.querySelectorAll('.mapping-row');
      const keyboard: any[] = [];
      rows.forEach((row, index) => {
        const source = row.querySelector('.source-select button') as HTMLButtonElement | null;
        const mode = row.querySelector('.mode-select button') as HTMLButtonElement | null;
        const target = row.querySelector('.target-select button') as HTMLButtonElement | null;
        keyboard.push({
          id: `mapping-${index}`,
          sourceKey: source?.textContent || '',
          mode: mode?.textContent || '',
          targetKey: target?.textContent || '',
        });
      });
      if (ipcRenderer) {
        const mouse = collectMouseSettingsFromUi();
        ipcRenderer.send('overlay:apply-settings', { keyboard, mouse });
      }
    } catch (e) { 
    }
  });

  // Listen to overlay show/hide from main via IPC
  if (ipcRenderer) {
    ipcRenderer.on('overlay:show', () => {
      try {
        loadSettingsFromFile(rowsContainer);
        const root = document.getElementById('overlay-root');
        if (root) root.style.display = 'block';
        // Send settings to main to apply
        try {
          const rows = rowsContainer.querySelectorAll('.mapping-row');
          const keyboard: any[] = [];
          rows.forEach((row, index) => {
            const source = row.querySelector('.source-select button') as HTMLButtonElement | null;
            const mode = row.querySelector('.mode-select button') as HTMLButtonElement | null;
            const target = row.querySelector('.target-select button') as HTMLButtonElement | null;
            keyboard.push({
              id: `mapping-${index}`,
              sourceKey: source?.textContent || '',
              mode: mode?.textContent || '',
              targetKey: target?.textContent || '',
            });
          });
          const mouse = collectMouseSettingsFromUi();
          ipcRenderer.send('overlay:apply-settings', { keyboard, mouse });
        } catch (e) { console.warn('Failed to send settings on show', e); }
      } catch (e) {
        console.error('IPC overlay:show error', e);
      }
    });

    ipcRenderer.on('overlay:hide', () => {
      try {
        saveSettingsToFile(rowsContainer);
        const root = document.getElementById('overlay-root');
        if (root) root.style.display = 'none';
        // Send settings to main to apply
        try {
          const rows = rowsContainer.querySelectorAll('.mapping-row');
          const keyboard: any[] = [];
          rows.forEach((row, index) => {
            const source = row.querySelector('.source-select button') as HTMLButtonElement | null;
            const mode = row.querySelector('.mode-select button') as HTMLButtonElement | null;
            const target = row.querySelector('.target-select button') as HTMLButtonElement | null;
            keyboard.push({
              id: `mapping-${index}`,
              sourceKey: source?.textContent || '',
              mode: mode?.textContent || '',
              targetKey: target?.textContent || '',
            });
          });
          const mouse = collectMouseSettingsFromUi();
          ipcRenderer.send('overlay:apply-settings', { keyboard, mouse });
        } catch (e) { console.warn('Failed to send settings on hide', e); }
      } catch (e) {
        console.error('IPC overlay:hide error', e);
      }
    });
  }
}

// Key options data
const keyOptions = [
  // Letters A-Z
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  // Numbers 0-9
  ...Array.from({ length: 10 }, (_, i) => i.toString()),
  // Function keys F1-F12
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  // Numpad keys
  ...Array.from({ length: 10 }, (_, i) => `Numpad${i}`),
  // Special keys
  'Space', 'Enter', 'Tab', 'Shift', 'Ctrl', 'Alt', 'Backspace', 'Delete',
  'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'CapsLock',
  'NumLock', 'ScrollLock', 'PrintScreen', 'Pause', 'Menu', 'Left', 'Right',
  'Up', 'Down', 'Win', 'Apps', 'VolumeUp', 'VolumeDown', 'VolumeMute',
  'MediaPlay', 'MediaPause', 'MediaStop', 'MediaNext', 'MediaPrev'
];

const modeOptions = ['remap', 'block', 'pass'];

// Settings management
interface KeyMapping {
  id: string;
  sourceKey: string;
  mode: string;
  targetKey: string;
}

interface MouseSettings {
  swapButtons: boolean;
  numpad5Primary: boolean;
  numpadPlusSecondary: boolean;
  yAxisInvert: boolean;
  movingSpeed: number; // 1-20
}

interface Settings {
  keyboard: KeyMapping[];
  mouse: MouseSettings;
}

const STORAGE_KEY = 'gs-setting';


// Save settings to file
function saveSettingsToFile(container: HTMLElement): void {
  const rows = container.querySelectorAll('.mapping-row');
  const mappings: KeyMapping[] = [];
  
  rows.forEach((row, index) => {
    const sourceSelect = row.querySelector('.source-select') as any;
    const modeSelect = row.querySelector('.mode-select') as any;
    const targetSelect = row.querySelector('.target-select') as any;
    
    if (sourceSelect && modeSelect && targetSelect) {
      const getSelected = (sel: any): string => {
        try {
          // First try the selectedValue function
          if (sel && typeof sel.selectedValue === 'function') {
            const v = sel.selectedValue();
            if (v && typeof v === 'string' && v.length > 0 && !/^(Source Key|Target Key|Mode|Source Key▼|Target Key▼|Mode▼)$/.test(v)) {
              return v;
            }
          }
          
          // Try the button's selectedValue property
          const btn = sel.querySelector('button') as HTMLButtonElement | null;
          if (btn && (btn as any).selectedValue) {
            const v = (btn as any).selectedValue;
            if (v && typeof v === 'string' && v.length > 0 && !/^(Source Key|Target Key|Mode|Source Key▼|Target Key▼|Mode▼)$/.test(v)) {
              return v;
            }
          }
          
          // Fallback to button text content (but filter out arrow)
          if (btn && btn.textContent) {
            const text = btn.textContent.replace(/[▼▲]$/, '').trim();
            if (text && text.length > 0 && !/^(Source Key|Target Key|Mode|Source Key▼|Target Key▼|Mode▼)$/.test(text)) {
              return text;
            }
          }
        } catch (err) {
        }
        return '';
      };

      const sourceKey = getSelected(sourceSelect);
      const mode = getSelected(modeSelect);
      const targetKey = getSelected(targetSelect);
      
      // Only save rows that have valid sourceKey and mode
      // For block/pass modes, targetKey can be empty or same as sourceKey
      if (sourceKey && mode) {
        // For block and pass modes, use sourceKey as targetKey if targetKey is empty
        const finalTargetKey = targetKey || sourceKey;
        
        mappings.push({
          id: `mapping-${index}`,
          sourceKey: sourceKey,
          mode: mode,
          targetKey: finalTargetKey
        });
        
      } else {
      }
    }
  });
  
  // Collect mouse settings from UI
  const mouseContainer = document.querySelector('.mouse-mapping-container') as HTMLElement | null;
  const mouseDefaults: MouseSettings = {
    swapButtons: false,
    numpad5Primary: false,
    numpadPlusSecondary: false,
    yAxisInvert: false,
    movingSpeed: 1.0
  };
  const mouse: MouseSettings = { ...mouseDefaults };
  try {
    if (mouseContainer) {
      const getBool = (key: string): boolean => {
        const el = mouseContainer.querySelector(`input[type="checkbox"][data-setting="${key}"]`) as HTMLInputElement | null;
        return !!(el && el.checked);
      };
      const speedEl = mouseContainer.querySelector('input[type="range"][data-setting="movingSpeed"]') as HTMLInputElement | null;
      mouse.swapButtons = getBool('swapButtons');
      mouse.numpad5Primary = getBool('numpad5Primary');
      mouse.numpadPlusSecondary = getBool('numpadPlusSecondary');
      mouse.yAxisInvert = getBool('yAxisInvert');
      mouse.movingSpeed = speedEl ? Math.max(0.1, Math.min(5.0, parseFloat(speedEl.value || '1.0'))) : 1.0;
    }
  } catch (e) { }

  const settings: Settings = { keyboard: mappings, mouse };
  const dataStr = JSON.stringify(settings, null, 2);
  
  
  // Save to localStorage as backup
  localStorage.setItem(STORAGE_KEY, dataStr);
  
  // Try to save to file using Electron APIs (silent save)
  try {
    // Use Electron's require to access Node.js fs module
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Save to user's Documents folder
    const documentsPath = path.join(os.homedir(), 'Documents');
    const filePath = path.join(documentsPath, 'gs_setting.json');
    
    fs.writeFileSync(filePath, dataStr, 'utf8');
  } catch (error) {
  }
}

// Load settings from file
function loadSettingsFromFile(container: HTMLElement): void {
  try {
    let settings: Settings | null = null;
    
    // Try to load from file first
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const documentsPath = path.join(os.homedir(), 'Documents');
      const filePath = path.join(documentsPath, 'gs_setting.json');
      
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        settings = JSON.parse(fileData);
      }
    } catch (fileError) {
    }
    
    // Fallback to localStorage if file loading failed
    if (!settings) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        settings = JSON.parse(saved);
      }
    }
    
    // Clear existing rows
    container.innerHTML = '';
    
    if (settings && (settings as any).keyboard && (settings as any).keyboard.length > 0) {
      // Load saved mappings
      (settings as any).keyboard.forEach((mapping: KeyMapping) => {
        const row = addMappingRow(container);
        // Fill values safely via button text/selectedValue
        setTimeout(() => {
          try {
            const sourceBtn = row.querySelector('.source-select button') as HTMLButtonElement | null;
            const modeBtn = row.querySelector('.mode-select button') as HTMLButtonElement | null;
            const targetBtn = row.querySelector('.target-select button') as HTMLButtonElement | null;

            if (sourceBtn && mapping.sourceKey) {
              sourceBtn.textContent = mapping.sourceKey;
              (sourceBtn as any).selectedValue = mapping.sourceKey;
            }
            if (modeBtn && mapping.mode) {
              modeBtn.textContent = mapping.mode;
              (modeBtn as any).selectedValue = mapping.mode;
            }
            if (targetBtn && mapping.targetKey) {
              targetBtn.textContent = mapping.targetKey;
              (targetBtn as any).selectedValue = mapping.targetKey;
            }
          } catch {}
        }, 50);
      });
    } else {
      // Add default row if no saved settings
      addMappingRow(container);
    }

    // Apply mouse settings into UI if present
    try {
      const mouseContainer = document.querySelector('.mouse-mapping-container') as HTMLElement | null;
      if (mouseContainer) {
        const setBool = (key: string, value: boolean) => {
          const el = mouseContainer.querySelector(`input[type="checkbox"][data-setting="${key}"]`) as HTMLInputElement | null;
          if (el) el.checked = !!value;
        };
        const speedEl = mouseContainer.querySelector('input[type="range"][data-setting="movingSpeed"]') as HTMLInputElement | null;
        const speedBadge = speedEl ? (speedEl.parentElement?.querySelector('span') as HTMLSpanElement | null) : null;
        const mouse = settings && (settings as any).mouse ? (settings as any).mouse as MouseSettings : undefined;
        if (mouse) {
          setBool('swapButtons', !!mouse.swapButtons);
          setBool('numpad5Primary', !!mouse.numpad5Primary);
          setBool('numpadPlusSecondary', !!mouse.numpadPlusSecondary);
          setBool('yAxisInvert', !!mouse.yAxisInvert);
          if (speedEl) {
            const v = String(Math.max(0.1, Math.min(5.0, Number(mouse.movingSpeed) || 1.0)));
            speedEl.value = v;
            if (speedBadge) speedBadge.textContent = parseFloat(v).toFixed(1);
          }
        }
      }
    } catch (e) { }
  } catch (error) {
    console.error('Error loading settings:', error);
    // Add default row on error
    addMappingRow(container);
  }
}

// Load settings on startup (from localStorage as fallback)
function loadSettings(container: HTMLElement): void {
  loadSettingsFromFile(container);
}


function addMappingRow(container: HTMLElement, mapping?: KeyMapping) {
  const row = document.createElement('div');
  row.className = 'mapping-row';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '10px';
  row.style.marginBottom = '10px';

  // Source Key Option
  const sourceSelect = createSelect(keyOptions, 'Source Key');
  sourceSelect.className = 'source-select';
  sourceSelect.style.flex = '1';

  // Mode Option
  const modeSelect = createSelect(modeOptions, 'Mode');
  modeSelect.className = 'mode-select';
  modeSelect.style.flex = '1';

  // Target Key Option
  const targetSelect = createSelect(keyOptions, 'Target Key');
  targetSelect.className = 'target-select';
  targetSelect.style.flex = '1';

  // Set values if mapping provided
  if (mapping) {
    setTimeout(() => {
      if (mapping.sourceKey) {
        const sourceButton = sourceSelect.querySelector('button') as HTMLButtonElement;
        if (sourceButton) {
          sourceButton.textContent = mapping.sourceKey;
          (sourceButton as any).selectedValue = mapping.sourceKey;
        }
      }
      if (mapping.mode) {
        const modeButton = modeSelect.querySelector('button') as HTMLButtonElement;
        if (modeButton) {
          modeButton.textContent = mapping.mode;
          (modeButton as any).selectedValue = mapping.mode;
        }
      }
      if (mapping.targetKey) {
        const targetButton = targetSelect.querySelector('button') as HTMLButtonElement;
        if (targetButton) {
          targetButton.textContent = mapping.targetKey;
          (targetButton as any).selectedValue = mapping.targetKey;
        }
      }
    }, 100);
  }

  // Remove button
  const removeBtn = createIconButton('🗑️', 'Remove', '#f44336');
  removeBtn.addEventListener('click', () => {
    container.removeChild(row);
  });

  // Up button
  const upBtn = createIconButton('⬆️', 'Move Up', '#2196F3');
  upBtn.addEventListener('click', () => {
    const prevRow = row.previousElementSibling;
    if (prevRow) {
      container.insertBefore(row, prevRow);
    }
  });

  // Down button
  const downBtn = createIconButton('⬇️', 'Move Down', '#2196F3');
  downBtn.addEventListener('click', () => {
    const nextRow = row.nextElementSibling;
    if (nextRow) {
      container.insertBefore(nextRow, row);
    }
  });

  // Add all elements to row
  row.appendChild(sourceSelect);
  row.appendChild(modeSelect);
  row.appendChild(targetSelect);
  row.appendChild(removeBtn);
  row.appendChild(upBtn);
  row.appendChild(downBtn);

  container.appendChild(row);
  return row;
}

// Create mapping row with existing data
function createMappingRow(mapping: KeyMapping): HTMLElement {
  const container = document.querySelector('.mapping-rows-container') as HTMLElement;
  if (container) {
    return addMappingRow(container, mapping);
  }
  return document.createElement('div');
}

function createSelect(options: string[], placeholder: string): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.minWidth = '120px';
  container.style.zIndex = '9999';

  // Create the select button
  const selectButton = document.createElement('button');
  selectButton.textContent = placeholder;
  selectButton.style.padding = '8px 12px';
  selectButton.style.borderRadius = '4px';
  selectButton.style.border = '1px solid rgba(255, 255, 255, 0.3)';
  selectButton.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
  selectButton.style.color = '#333';
  selectButton.style.fontSize = '14px';
  selectButton.style.width = '100%';
  selectButton.style.textAlign = 'left';
  selectButton.style.cursor = 'pointer';
  selectButton.style.display = 'flex';
  selectButton.style.justifyContent = 'space-between';
  selectButton.style.alignItems = 'center';

  // Add dropdown arrow
  const arrow = document.createElement('span');
  arrow.textContent = '▼';
  arrow.style.fontSize = '12px';
  arrow.style.marginLeft = '8px';
  selectButton.appendChild(arrow);

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.style.position = 'fixed'; // Use fixed positioning to break out of containers
  dropdown.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
  dropdown.style.border = '1px solid rgba(255, 255, 255, 0.3)';
  dropdown.style.borderRadius = '4px';
  dropdown.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  dropdown.style.maxHeight = '200px';
  dropdown.style.overflowY = 'auto';
  dropdown.style.zIndex = '99999'; // Very high z-index to appear above everything
  dropdown.style.display = 'none';
  dropdown.style.minWidth = '120px';

  // Add options to dropdown
  options.forEach(option => {
    const optionElement = document.createElement('div');
    optionElement.textContent = option;
    optionElement.style.padding = '8px 12px';
    optionElement.style.cursor = 'pointer';
    optionElement.style.color = '#333';
    optionElement.style.fontSize = '14px';
    optionElement.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
    
    optionElement.onmouseover = () => {
      optionElement.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
    };
    optionElement.onmouseout = () => {
      optionElement.style.backgroundColor = 'transparent';
    };
    
    optionElement.onclick = () => {
      // Update button text while preserving the arrow
      const currentArrow = selectButton.querySelector('span');
      selectButton.textContent = option;
      if (currentArrow) {
        selectButton.appendChild(currentArrow);
      }
      dropdown.style.display = 'none';
      // Store the selected value
      (selectButton as any).selectedValue = option;
    };
    
    dropdown.appendChild(optionElement);
  });

  // Toggle dropdown on button click
  selectButton.onclick = (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    
    
    if (!isOpen) {
      // Calculate position for fixed dropdown
      const buttonRect = selectButton.getBoundingClientRect();
      dropdown.style.left = buttonRect.left + 'px';
      dropdown.style.top = (buttonRect.bottom + window.scrollY) + 'px';
      dropdown.style.width = buttonRect.width + 'px';
    }
    
    dropdown.style.display = isOpen ? 'none' : 'block';
    arrow.textContent = isOpen ? '▼' : '▲';
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
    arrow.textContent = '▼';
  });

  container.appendChild(selectButton);
  
  // Append dropdown to document body so it can extend beyond containers
  document.body.appendChild(dropdown);

  // Add getter for selected value
  (container as any).value = () => (selectButton as any).selectedValue || '';
  (container as any).selectedValue = () => (selectButton as any).selectedValue || '';
  
  // Clean up dropdown when container is removed
  const originalRemove = container.remove;
  container.remove = function() {
    if (dropdown.parentNode) {
      dropdown.parentNode.removeChild(dropdown);
    }
    originalRemove.call(this);
  };

  return container;
}

function createIconButton(icon: string, title: string, color: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.innerHTML = icon;
  button.title = title;
  button.style.backgroundColor = color;
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '8px 12px';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '16px';
  button.style.minWidth = '40px';
  button.style.height = '40px';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
  
  button.onmouseover = () => {
    button.style.opacity = '0.8';
    button.style.transform = 'scale(1.05)';
  };
  button.onmouseout = () => {
    button.style.opacity = '1';
    button.style.transform = 'scale(1)';
  };

  return button;
}

// Mouse Mapping UI builders (UI only)
function createMouseMappingSection(): HTMLDivElement {
  const section = document.createElement('div');
  section.style.display = 'flex';
  section.style.flexDirection = 'column';
  section.style.gap = '14px';

  section.appendChild(createCheckboxRow('Swap Primary/Secondary buttons'));
  section.appendChild(createCheckboxRow('Numpad 5 as Primary Button'));
  section.appendChild(createCheckboxRow('Numpad + as Secondary Button'));
  section.appendChild(createCheckboxRow('Y-axis Revert'));
  section.appendChild(createSliderRow('Moving Speed', 0.1, 5.0, 1.0));

  return section;
}

function createCheckboxRow(labelText: string): HTMLDivElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '12px';
  row.style.padding = '12px 14px';
  row.style.backgroundColor = 'rgba(255,255,255,0.06)';
  row.style.border = '1px solid rgba(255,255,255,0.25)';
  row.style.borderRadius = '8px';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.style.transform = 'scale(1.2)';
  checkbox.style.cursor = 'pointer';
  // map label to setting key
  const keyMap: Record<string, string> = {
    'Swap Primary/Secondary buttons': 'swapButtons',
    'Numpad 5 as Primary Button': 'numpad5Primary',
    'Numpad + as Secondary Button': 'numpadPlusSecondary',
    'Y-axis Revert': 'yAxisInvert'
  };
  const settingKey = keyMap[labelText];
  if (settingKey) checkbox.setAttribute('data-setting', settingKey);

  const label = document.createElement('label');
  label.textContent = labelText;
  label.style.color = 'white';
  label.style.fontFamily = 'Arial, sans-serif';
  label.style.fontSize = '14px';

  row.appendChild(checkbox);
  row.appendChild(label);
  return row;
}

function createSliderRow(labelText: string, min: number, max: number, value: number): HTMLDivElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '12px';
  row.style.padding = '12px 14px';
  row.style.backgroundColor = 'rgba(255,255,255,0.06)';
  row.style.border = '1px solid rgba(255,255,255,0.25)';
  row.style.borderRadius = '8px';

  const label = document.createElement('label');
  label.textContent = labelText;
  label.style.color = 'white';
  label.style.fontFamily = 'Arial, sans-serif';
  label.style.fontSize = '14px';
  label.style.minWidth = '120px';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = '0.1'; // Allow decimal steps
  slider.value = String(value);
  slider.style.flex = '1';
  slider.style.cursor = 'pointer';
  slider.setAttribute('data-setting', 'movingSpeed');

  const valueBadge = document.createElement('span');
  valueBadge.textContent = String(value);
  valueBadge.style.color = 'white';
  valueBadge.style.fontFamily = 'Arial, sans-serif';
  valueBadge.style.fontSize = '14px';
  valueBadge.style.minWidth = '28px';
  valueBadge.style.textAlign = 'right';

  slider.addEventListener('input', () => {
    const val = parseFloat((slider as HTMLInputElement).value);
    valueBadge.textContent = val.toFixed(1);
  });

  row.appendChild(label);
  row.appendChild(slider);
  row.appendChild(valueBadge);
  return row;
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Expose functions to window so main process can call via executeJavaScript
declare global {
  interface Window {
    loadSettingsFromFile?: (container?: HTMLElement) => void;
    saveSettingsToFile?: (container?: HTMLElement) => void;
    __overlay_loadSettings?: () => void;
    __overlay_saveSettings?: () => void;
  }
}

// Bind renderer functions to window with safe wrappers
(window as any).loadSettingsFromFile = (container?: HTMLElement) => {
  try {
    const target = container || (document.querySelector('.mapping-rows-container') as HTMLElement | null);
    if (target) {
      loadSettingsFromFile(target);
      console.log('loadSettingsFromFile invoked via window binding');
    } else {
      console.warn('loadSettingsFromFile: rows container not found');
    }
  } catch (err) {
    console.error('loadSettingsFromFile (window) error:', err);
  }
};

(window as any).saveSettingsToFile = (container?: HTMLElement) => {
  try {
    const target = container || (document.querySelector('.mapping-rows-container') as HTMLElement | null);
    if (target) {
      saveSettingsToFile(target);
    } else {
    }
  } catch (err) {
  }
};

// Convenience wrappers without parameters for executeJavaScript()
(window as any).__overlay_loadSettings = () => (window as any).loadSettingsFromFile();
(window as any).__overlay_saveSettings = () => (window as any).saveSettingsToFile();
