// lib/keyboard/KeyboardManager.ts
// Global keyboard shortcut system — V/R/T/F/P always = Move/Rect/Text/Frame/Pen
// regardless of current tool state

export type KeyAction =
  // Tools
  | 'move' | 'rect' | 'frame' | 'text' | 'pen'
  | 'ellipse' | 'line' | 'polygon' | 'star' | 'image' | 'sticky'
  // Organization
  | 'group' | 'ungroup'
  | 'component' | 'instance'
  // Edit
  | 'undo' | 'redo' | 'copy' | 'paste' | 'cut' | 'duplicate' | 'delete'
  // Selection
  | 'selectAll' | 'deselect'
  // Transform
  | 'scale' | 'rotate' | 'flipH' | 'flipV'
  // View
  | 'zoomIn' | 'zoomOut' | 'zoomFit' | 'zoom100'
  | 'pan'       // Space held
  // Layer ordering
  | 'bringFront' | 'sendBack' | 'bringForward' | 'sendBackward'
  // Lock/Hide
  | 'lock' | 'hide'
  // Search
  | 'search' | 'quickSwitch';

interface KeyBinding {
  action: KeyAction;
  keys: string[];        // e.g. ['V'] or ['Ctrl', 'C']
  preventDefault: boolean;
}

const BINDINGS: KeyBinding[] = [
  // === Tools ===
  { action: 'move',     keys: ['V'],                   preventDefault: false },
  { action: 'rect',     keys: ['R'],                   preventDefault: false },
  { action: 'frame',    keys: ['F'],                   preventDefault: false },
  { action: 'text',     keys: ['T'],                   preventDefault: false },
  { action: 'pen',      keys: ['P'],                   preventDefault: false },
  { action: 'ellipse',  keys: ['O'],                   preventDefault: false },
  { action: 'line',     keys: ['L'],                   preventDefault: false },
  { action: 'polygon',  keys: ['Y'],                   preventDefault: false },
  { action: 'star',     keys: ['S'],                   preventDefault: false },
  { action: 'sticky',  keys: ['Shift', 'S'],           preventDefault: false },

  // === Organization ===
  { action: 'group',    keys: ['Ctrl', 'G'],           preventDefault: true  },
  { action: 'ungroup',  keys: ['Ctrl', 'Shift', 'G'],   preventDefault: true  },
  { action: 'component', keys: ['Ctrl', 'Alt', 'K'],   preventDefault: true  },
  { action: 'instance', keys: ['Ctrl', 'Alt', 'I'],    preventDefault: true  },

  // === Edit ===
  { action: 'undo',     keys: ['Ctrl', 'Z'],            preventDefault: true  },
  { action: 'redo',     keys: ['Ctrl', 'Shift', 'Z'],  preventDefault: true  },
  { action: 'redo',     keys: ['Ctrl', 'Y'],            preventDefault: true  },
  { action: 'copy',     keys: ['Ctrl', 'C'],            preventDefault: true  },
  { action: 'paste',    keys: ['Ctrl', 'V'],            preventDefault: true  },
  { action: 'cut',      keys: ['Ctrl', 'X'],            preventDefault: true  },
  { action: 'duplicate', keys: ['Ctrl', 'D'],           preventDefault: true  },
  { action: 'delete',   keys: ['Delete'],               preventDefault: true  },
  { action: 'delete',   keys: ['Backspace'],            preventDefault: true  },

  // === Selection ===
  { action: 'selectAll', keys: ['Ctrl', 'A'],           preventDefault: true  },
  { action: 'deselect', keys: ['Escape'],               preventDefault: true  },

  // === Transform ===
  { action: 'scale',    keys: ['K'],                    preventDefault: false },
  { action: 'rotate',   keys: ['Shift', 'R'],           preventDefault: false },
  { action: 'flipH',    keys: ['Shift', 'H'],           preventDefault: true  },
  { action: 'flipV',   keys: ['Shift', 'V'],           preventDefault: true  },

  // === View ===
  { action: 'zoomIn',   keys: ['+'],                    preventDefault: false },
  { action: 'zoomIn',   keys: ['='],                    preventDefault: false },
  { action: 'zoomOut',  keys: ['-'],                    preventDefault: false },
  { action: 'zoomFit',  keys: ['Shift', '1'],           preventDefault: false },
  { action: 'zoom100',  keys: ['Shift', '0'],           preventDefault: false },
  { action: 'pan',      keys: ['Space'],               preventDefault: false },

  // === Layer ordering ===
  { action: 'bringFront',  keys: ['Ctrl', 'Shift', ']'], preventDefault: true },
  { action: 'sendBack',    keys: ['Ctrl', 'Shift', '['], preventDefault: true },
  { action: 'bringForward', keys: ['Ctrl', ']'],         preventDefault: true },
  { action: 'sendBackward', keys: ['Ctrl', '['],         preventDefault: true },

  // === Lock/Hide ===
  { action: 'lock',     keys: ['Ctrl', 'Shift', 'L'],   preventDefault: true  },
  { action: 'hide',     keys: ['Ctrl', 'Shift', 'H'],   preventDefault: true  },

  // === Search ===
  { action: 'search',   keys: ['Ctrl', '/'],            preventDefault: true  },
  { action: 'quickSwitch', keys: ['Ctrl', '\\'],         preventDefault: true  },
];

export class KeyboardManager {
  private listeners: Map<KeyAction, Set<() => void>> = new Map();
  private activeKeys: Set<string> = new Set();
  private _enabled: boolean = true;
  private _destroyed: boolean = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  get enabled(): boolean { return this._enabled; }
  enable() { this._enabled = true; }
  disable() { this._enabled = false; }

  /** Check if a specific key is currently held down */
  isKeyDown(key: string): boolean {
    return this.activeKeys.has(key);
  }

  /** Check if any key matching an action's binding is currently pressed */
  isActionPressed(action: KeyAction): boolean {
    const binding = BINDINGS.find(b => b.action === action);
    if (!binding) return false;
    return this.matchesBinding(binding.keys);
  }

  /** Subscribe to an action. Returns unsubscribe function. */
  on(action: KeyAction, callback: () => void): () => void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(callback);

    return () => {
      this.listeners.get(action)?.delete(callback);
    };
  }

  /** Emit an action manually (for programmatic use) */
  emit(action: KeyAction): void {
    const callbacks = this.listeners.get(action);
    if (!callbacks) return;
    callbacks.forEach(cb => cb());
  }

  private matchesBinding(keys: string[]): boolean {
    for (const k of keys) {
      switch (k) {
        case 'Ctrl':
          if (!this.activeKeys.has('Control') && !this.activeKeys.has('Meta')) return false;
          break;
        case 'Shift':
          if (!this.activeKeys.has('Shift')) return false;
          break;
        case 'Alt':
          if (!this.activeKeys.has('Alt')) return false;
          break;
        default:
          if (!this.activeKeys.has(k)) return false;
      }
    }
    return true;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this._destroyed || !this._enabled) return;

    // Track active keys
    this.activeKeys.add(e.key);

    // Try to match bindings in order (first match wins)
    for (const binding of BINDINGS) {
      if (this.matchesBinding(binding.keys)) {
        if (binding.preventDefault) {
          e.preventDefault();
        }

        // Don't emit pan key when typing in an input
        const target = e.target as HTMLElement;
        if (binding.action !== 'pan' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          continue;
        }

        const callbacks = this.listeners.get(binding.action);
        callbacks?.forEach(cb => cb());
        break;
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.key);
  }

  /** Get display string for a key combination (e.g. "⌘C", "Ctrl+Shift+G") */
  static keyComboDisplay(keys: string[]): string {
    const labels: Record<string, string> = {
      'Ctrl': '⌃', 'Shift': '⇧', 'Alt': '⌥', 'Meta': '⌘',
      'Delete': '⌫', 'Backspace': '⌫', 'Escape': '⎋',
      'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
      ' ': 'Space',
    };

    return keys.map(k => labels[k] || k.toUpperCase()).join('');
  }

  /** Get binding for an action */
  static getBinding(action: KeyAction): KeyBinding | undefined {
    return BINDINGS.find(b => b.action === action);
  }
}
