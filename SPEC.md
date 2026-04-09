# AI Canvas — Personal Figma-Like Tool

## 1. Concept & Vision

**"Digital Workshop"** — A personal creative canvas that feels like a well-lit craftsman's workbench. Not cold and corporate, but warm and inviting — a tool you'd actually enjoy using daily. The interface blends the precision of professional design software with the warmth of a creative studio. Every interaction should feel intentional and responsive, as if the tool anticipates your intent.

## 2. Design Language

### Aesthetic Direction
**Warm Industrial Workshop** — Deep charcoal foundations with amber/copper accents. The feel of a master craftsman's tools: precise, beautiful, purpose-built. Dark without being cold; technical without being sterile.

### Color Palette
```css
--bg-deep: #0D0D0F;           /* Deepest background */
--bg-surface: #151518;         /* Panel backgrounds */
--bg-elevated: #1C1C21;        /* Cards, inputs */
--bg-hover: #252529;           /* Hover states */
--border: #2A2A30;             /* Subtle borders */
--border-active: #3D3D45;      /* Active borders */
--text-primary: #E8E4DF;       /* Warm off-white */
--text-secondary: #8A8680;     /* Muted text */
--text-tertiary: #5C5A56;      /* Disabled/hint */
--accent: #D4A853;             /* Warm amber - primary accent */
--accent-hover: #E5B85C;       /* Amber hover */
--accent-muted: #8B7235;       /* Muted amber for backgrounds */
--success: #7CB77C;            /* Muted green */
--danger: #C75D5D;             /* Warm red */
--canvas-bg: #1A1A1D;          /* Canvas background */
--shape-stroke: #3A3A40;       /* Default shape stroke */
```

### Typography
- **Display/Headers**: "Instrument Sans" (Google Fonts) — modern, geometric, distinctive
- **Body/UI**: "Instrument Sans" at various weights
- **Monospace** (code, coordinates): "JetBrains Mono" — technical precision
- Fallbacks: system-ui, -apple-system, sans-serif

### Spatial System
- Base unit: 4px
- Panel padding: 16px
- Element spacing: 8px (tight), 12px (normal), 16px (loose)
- Border radius: 6px (small), 8px (medium), 12px (large)
- Subtle shadows with warm undertones

### Motion Philosophy
- **Micro-interactions**: 150ms ease-out for hovers, state changes
- **Panel transitions**: 200ms ease-out
- **Canvas zoom**: smooth interpolation with momentum
- **Shape selection**: immediate ring appear, 100ms scale pulse
- **Chat messages**: slide-in from bottom, 200ms staggered

### Visual Assets
- **Icons**: Lucide React — consistent 1.5px stroke weight
- **Decorative**: Subtle noise texture overlay on panels (5% opacity)
- **Canvas grid**: Dot pattern, very subtle (#252525)

## 3. Layout & Structure

### Three-Panel Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]  AI Canvas                          [?] [Settings]      │
├──────────┬──────────────────────────────────────┬───────────────┤
│          │                                      │               │
│  LAYERS  │                                      │    CHAT       │
│          │                                      │               │
│  ──────  │                                      │  ───────────  │
│  [list]  │         CANVAS                       │  [messages]  │
│          │         (Konva Stage)                 │               │
│          │                                      │  ───────────  │
│          │                                      │  PROPERTIES   │
│          │                                      │  (when shape  │
│          │                                      │   selected)   │
│          │                                      │               │
├──────────┴──────────────────────────────────────┴───────────────┤
│  Status: Ready          Zoom: 100%          Canvas: 1920×1080   │
└─────────────────────────────────────────────────────────────────┘
```

### Panel Dimensions
- **Left (Layers)**: 240px fixed width
- **Right (Chat + Properties)**: 320px fixed width
- **Center (Canvas)**: Flexible, fills remaining space
- **Header**: 48px height
- **Footer/Status**: 32px height

### Responsive Strategy
- Minimum viewport: 1024×600
- Below 1024px: collapse left panel to icon-only (48px)
- Right panel always visible

## 4. Features & Interactions

### Canvas (Core)
- **Pan**: Space + drag, or middle-mouse drag
- **Zoom**: Scroll wheel (centered on cursor), pinch on trackpad
- **Select**: Click shape, shows selection ring (amber dashed border)
- **Multi-select**: Shift + click
- **Move**: Drag selected shape(s)
- **Delete**: Backspace/Delete key on selected shapes
- **Deselect**: Click empty canvas area or Escape

### Layers Panel (Left)
- **List**: All shapes, newest at bottom (reverse of traditional layers)
- **Item click**: Select corresponding shape on canvas
- **Visibility toggle**: Eye icon per layer
- **Lock toggle**: Lock icon per layer
- **Hover state**: Shows quick actions (delete, duplicate)
- **Active shape**: Highlighted with accent border

### AI Chat (Right Top)
- **Input**: Multi-line textarea, Shift+Enter for new line, Enter to send
- **AI persona**: Helpful canvas assistant
- **Message types**:
  - User message: Right-aligned, accent background
  - AI response: Left-aligned, surface background
  - Tool call (shape added): Inline indicator
- **Quick commands**: "/clear", "/export", "/grid 10"
- **Context awareness**: AI knows canvas size, selected shapes

### Properties Panel (Right Bottom)
- Shown when shape is selected
- **Position**: X, Y inputs (editable)
- **Size**: W, H inputs (editable)
- **Appearance**: Fill color, Stroke color, Stroke width
- **Opacity**: Slider 0-100%
- **Rotation**: Degree input
- **Order**: Bring Forward, Send Backward buttons

### Shape Creation
- **AI command**: "Draw a blue circle in the center"
- AI outputs JSON, system adds shape to canvas
- Shape appears with subtle scale-in animation
- Immediate selection after creation

### Material/Favorites System
- **Save**: Click star icon on selected shape
- **Storage**: localStorage with named templates
- **Use**: AI can reference "my saved button style"

### Keyboard Shortcuts
- `Space + Drag`: Pan canvas
- `Cmd/Ctrl + 0`: Reset zoom to 100%
- `Cmd/Ctrl + 1`: Zoom to fit
- `Delete/Backspace`: Delete selected
- `Escape`: Deselect all
- `Cmd/Ctrl + A`: Select all
- `Cmd/Ctrl + S`: Quick save to localStorage

## 5. Component Inventory

### Header
- Logo (inline SVG, amber accent)
- Title "AI Canvas" in Instrument Sans medium
- Help icon (opens shortcuts modal)
- Settings gear (future)

### LayerItem
- States: default, hover (show actions), selected (accent border), locked (dimmed), hidden (strikethrough)
- Type icon (rect/circle/text/line)
- Name (editable on double-click)
- Visibility toggle (eye icon)
- Lock toggle (lock icon)

### Canvas
- Konva Stage container
- Dot grid background
- Shapes rendered from state
- Selection indicators
- Transform handles when selected

### ChatMessage
- User: right-aligned, --bg-elevated background, rounded corners (sharp on right)
- AI: left-aligned, --bg-surface background, rounded corners (sharp on left)
- Avatar: small amber circle with "AI" or user initial
- Timestamp on hover

### PropertyInput
- Label (text-secondary, small)
- Input field (bg-elevated, border on focus)
- Unit suffix where applicable (px, °, %)
- Increment/decrement arrows

### ShapeRenderer
- Renders based on type: Rect, Circle, Text, Line
- Handles selection state
- Applies styles from shape data

### StatusBar
- Connection status indicator (dot + text)
- Zoom level (clickable to reset)
- Canvas dimensions
- Shape count

## 6. Technical Approach

### Stack
- **Framework**: Next.js 14+ (App Router)
- **Canvas**: react-konva + konva
- **State**: Zustand (single store for shapes, selection, UI state)
- **Styling**: Tailwind CSS + CSS variables for theme
- **Icons**: lucide-react

### Data Model
```typescript
interface Shape {
  id: string;
  type: 'rect' | 'circle' | 'text' | 'line';
  x: number;
  y: number;
  width?: number;      // for rect
  height?: number;     // for rect
  radius?: number;     // for circle
  text?: string;       // for text
  points?: number[];   // for line [x1, y1, x2, y2]
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

interface AppState {
  shapes: Shape[];
  selectedIds: string[];
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  chatHistory: ChatMessage[];
  savedMaterials: Material[];
}
```

### AI Integration (Function Calling Schema)
```typescript
// Tool: add_shapes
{
  name: "add_shapes",
  description: "Add one or more shapes to the canvas",
  parameters: {
    type: "object",
    properties: {
      shapes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { enum: ["rect", "circle", "text", "line"] },
            x: { type: "number" },
            y: { type: "number" },
            width?: { type: "number" },
            height?: { type: "number" },
            radius?: { type: "number" },
            text?: { type: "string" },
            fill?: { type: "string" },
            stroke?: { type: "string" },
          },
          required: ["type", "x", "y"]
        }
      }
    }
  }
}
```

### File Structure
```
/app
  /page.tsx              # Main editor page
  /layout.tsx             # Root layout with fonts
  /globals.css            # CSS variables, base styles
/components
  /Editor.tsx             # Main three-panel layout
  /Canvas.tsx             # Konva stage wrapper
  /LayerPanel.tsx         # Left panel layers list
  /ChatPanel.tsx          # Right panel chat
  /PropertiesPanel.tsx    # Right panel properties
  /Header.tsx             # Top header bar
  /StatusBar.tsx          # Bottom status bar
  /LayerItem.tsx          # Single layer row
  /ChatMessage.tsx        # Single chat message
  /ShapeRenderer.tsx      # Konva shape renderer
/stores
  /useEditorStore.ts      # Zustand store
/lib
  /shapes.ts              # Shape utilities
  /storage.ts             # localStorage helpers
  /ai.ts                  # AI prompt/system config
/public
  /favicon.svg
```

### Local Storage Keys
- `ai-canvas:shapes` — Current canvas shapes
- `ai-canvas:materials` — Saved shape templates
- `ai-canvas:chat` — Chat history (last 50 messages)

### Canvas Coordinate System
- Default canvas size: 1920×1080
- All AI prompts include: "Canvas size is 1920×1080. Coordinates are from top-left (0,0)."
