# Figma-Like Editor — 100% 落地技术架构（React 版）

> 作者：AI 助手 | 定位：OpenClaw + Figma AI 编辑器

---

## 一、核心定位

Figma 本质是：**UI 对象编辑器 + 图层管理系统 + 协作平台**

不是"画图软件"，是**实时协作的对象编辑器**。

---

## 二、技术选型：为什么这样选

### 为什么不 craft.js

craft.js 是好框架，但有致命问题：

| 问题 | craft.js | 后果 |
|------|----------|------|
| React DOM 渲染 | 每个节点是 React 组件 | 1000 个图层 = 1000 个 React 组件 = 卡死 |
| 状态粒度 | 以组件为单位 | 无法实现精确的框选/多选/批量操作 |
| 热更新 | 强依赖 React reconciliation | 复杂 Selection Engine 无法实现 |
| 协作 | 没有内置 | 需要接 Yjs，但 craft 的数据和 Yjs 不兼容 |

**结论**：craft.js 适合"可视化低代码搭建工具"，不适合"Figma 类专业设计编辑器"。

### 为什么 Konva 是过渡方案

**Konva 的问题**：

```
1. DOM Overlay 问题
   Konva Stage → Canvas 元素
   工具栏/输入框 → DOM 元素
   两者坐标系统不同，缩放/平移时必须同步两组坐标
   Figma 用 Canvas 统一渲染，连输入框都是自绘的

2. 事件系统
   Konva 的事件是模拟的，不是真实 DOM 事件
   框选、穿透选择、组合键 需要精确的 DOM 事件系统
   hack Konva 事件比重写还难

3. 性能
   Konva 每帧重绘整个 Stage
   Figma 只重绘变化区域（脏矩形算法）
   1000 个节点，Konva 卡，Figma 流畅

4. WebGL 限制
   Konva WebGL 模式功能残缺
   Figma 最终目标是 WebGL/Metal 渲染
```

**Konva 的价值**：当前阶段快速验证交互，**最终必须自研 Canvas/WebGL 引擎**。

### 推荐技术栈

```
第一阶段（当前 → 6个月）：
  React 18 + Zustand + Konva（过渡）
  + 自研 Scene Graph（核心）
  + 自研 Selection Engine（核心）
  + Yjs（协作预留）
  + IndexedDB（本地持久化）

第二阶段（6-18个月）：
  React（同层渲染优化）
  自研 Canvas Renderer（替代 Konva）
  自研 Layout Engine（替代 CSS Flexbox）
  WebGL 渲染层

第三阶段（18个月+）：
  自研 WebGL 引擎
  Rust/WASM 核心（性能关键路径）
  CRDT（Yjs）协作层
```

---

## 三、数据结构：Scene Graph（最核心）

### 3.1 节点模型

Figma 的 Node 是**递归树结构**，每个节点可以是容器也可以是叶子。

```typescript
// ========== 核心节点类型 ==========

type NodeType =
  | 'document'    // 根节点
  | 'page'        // 页面
  | 'frame'       // Frame（比 Group 高级）
  | 'group'       // 纯分组
  | 'rectangle'   // 矩形
  | 'ellipse'     // 椭圆
  | 'text'        // 文本
  | 'line'        // 线条
  | 'polygon'     // 多边形
  | 'star'        // 星形
  | 'pen'         // 钢笔路径
  | 'image'       // 图片
  | 'component'   // 组件定义
  | 'instance'    // 组件实例
  | 'boolean'     // 布尔运算
  | 'sticky';     // 便签

// ========== 基础节点接口 ==========
interface BaseNode {
  id: string;              // 唯一 ID（nanoid）
  type: NodeType;
  name: string;            // 图层名称（用户可见）
  
  // 变换（相对于父容器）
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;        // 度数
  
  // 状态
  opacity: number;         // 0-1
  visible: boolean;
  locked: boolean;
  
  // 父子关系（真正的树结构）
  parentId: string | null;
  children: string[];      // 子节点 ID 数组
  
  // 混合模式
  blendMode: BlendMode;
  
  // 绝对坐标（计算得出，不存储）
  // absX, absY, absRotation（由父节点 + 本地坐标推算）
}

// ========== 页面节点 ==========
interface PageNode extends BaseNode {
  type: 'page';
  children: string[];      // Frame/组件 ID
}

// ========== Frame 节点 ==========
interface FrameNode extends BaseNode {
  type: 'frame';
  children: string[];
  
  // Frame 特有
  backgroundColor: string;
  cornerRadius: number;
  clipsContent: boolean;   // 裁剪内容
  
  // Auto Layout（可选）
  layoutMode: 'none' | 'horizontal' | 'vertical' | 'grid';
  layoutGap: number;
  layoutPadding: { top: number; right: number; bottom: number; left: number };
  layoutAlign: LayoutAlign;
  layoutCounterAlign: LayoutCounterAlign;
  layoutJustify: LayoutJustify;
  layoutWrap: boolean;
  
  // Constraints（可选）
  constraints: {
    [childId: string]: {
      horizontal: ConstraintHorizontal;
      vertical: ConstraintVertical;
    }
  };
}

// ========== 文本节点 ==========
interface TextNode extends BaseNode {
  type: 'text';
  
  text: string;            // 文本内容（支持 {{variable}} 插值）
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;       // italic 等
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  
  // 自动宽高
  sizing: 'fixed' | 'autoWidth' | 'autoHeight' | 'auto';
  
  // 变量引用
  variableRefs: string[];  // 引用的变量名数组
}

// ========== 组件节点 ==========
interface ComponentNode extends BaseNode {
  type: 'component';
  children: string[];
  
  // 组件定义
  description: string;
  remoteId: string;        // 远程组件 ID（协作时）
  
  // Variant 属性
  variantProperties: Record<string, string>;  // { "size": "small", "color": "primary" }
  
  // 状态覆盖
  stateOverrides: ShapeStateOverrides;
}

// ========== 实例节点 ==========
interface InstanceNode extends BaseNode {
  type: 'instance';
  
  masterComponentId: string;  // 指向 ComponentNode
  overrides: Record<string, Partial<BaseNode>>;  // 覆盖的属性
}

// ========== 布尔运算节点 ==========
interface BooleanNode extends BaseNode {
  type: 'boolean';
  booleanOperation: 'union' | 'subtract' | 'intersect' | 'exclude';
  children: string[];    // 参与布尔运算的子节点
}

// ========== 钢笔路径节点 ==========
interface PenNode extends BaseNode {
  type: 'pen';
  points: PenPoint[];    // 路径点数组
  closed: boolean;        // 是否闭合
  fillRule: 'nonzero' | 'evenodd';
}

// ========== 全局类型别名 ==========
type Shape = FrameNode | TextNode | ComponentNode | InstanceNode | BooleanNode | PenNode | any;

// ========== 枚举定义 ==========
type BlendMode = 
  | 'normal' | 'multiply' | 'screen' | 'overlay' 
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

type LayoutAlign = 'min' | 'center' | 'max' | 'stretch' | 'baseline';
type LayoutCounterAlign = 'min' | 'center' | 'max' | 'stretch';
type LayoutJustify = 'min' | 'center' | 'max' | 'space-between';

type ConstraintHorizontal = 'left' | 'right' | 'center' | 'left-right' | 'scale';
type ConstraintVertical = 'top' | 'bottom' | 'center' | 'top-bottom' | 'scale';
```

### 3.2 Document 结构

```typescript
interface Document {
  id: string;
  name: string;
  lastModified: string;
  lastModifiedBy: string;
  
  // 文档元数据
  schemaVersion: number;
  sourceFileKey?: string;  // Figma 协作用
  exportSettings: ExportSetting[];
  
  // 页面
  pages: PageNode[];       // Page 节点数组（不是扁平 shapes[]）
  
  // 全局样式
  styles: {
    textStyles: TextStyle[];
    colorStyles: ColorStyle[];
    effectStyles: EffectStyle[];
  };
  
  // 组件库
  components: ComponentNode[];
  
  // 变量
  variables: Variable[];
  
  // 团队协作（预留）
  collaboration?: {
    sessionId: string;
    users: CollaborationUser[];
  };
}

interface PageNode {
  id: string;
  type: 'page';
  name: string;
  children: string[];   // Frame/组件/组的 ID
  parentId: null;       // Page 的 parent 是 document
}
```

### 3.3 现有代码的问题

当前代码用扁平 `shapes: Shape[]` 存储，然后用 `parentId` 模拟树：

```typescript
// ❌ 当前（错误）
shapes: Shape[]  // 扁平数组，通过 parentId 模拟树

// ✅ 正确
pages: PageNode[]  // 真正的树结构
```

**修复方案**：将 `shapes: Shape[]` 重构为 `document: Document` 结构。

---

## 四、Scene Graph Engine（核心引擎）

### 4.1 职责

Scene Graph Engine 负责：
1. **维护树结构**（增删改节点）
2. **计算绝对坐标**（absX, absY = 父.absX + 本地.x）
3. **遍历树**（深度优先 / 广度优先）
4. **查找节点**（byId, byName, byType）
5. **克隆子树**（用于复制/Undo）
6. **序列化和反序列化**（JSON）

### 4.2 实现

```typescript
// lib/scene-graph/SceneGraph.ts

import { BaseNode, Shape, PageNode, Document } from './types';
import { nanoid } from 'nanoid';

export class SceneGraph {
  private document: Document;

  constructor(document?: Document) {
    this.document = document || this.createEmptyDocument();
  }

  // ========== 树遍历 ==========

  /** 深度优先遍历所有节点 */
  traverse(callback: (node: BaseNode) => void, rootId?: string): void {
    const root = rootId ? this.getNode(rootId) : null;
    const stack = root ? [root] : this.document.pages;
    
    while (stack.length > 0) {
      const node = stack.pop()!;
      callback(node);
      // 反序入栈保证顺序
      const children = this.getNodeChildren(node.id);
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
  }

  /** 广度优先遍历 */
  traverseBreadth(callback: (node: BaseNode) => void, rootId?: string): void {
    const root = rootId ? this.getNode(rootId) : null;
    const queue = root ? [root] : [...this.document.pages];
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      callback(node);
      queue.push(...this.getNodeChildren(node.id));
    }
  }

  // ========== 节点查询 ==========

  getNode(id: string): BaseNode | null {
    // 用 Map 优化 O(n) → O(1)
    return this.nodeMap.get(id) || null;
  }

  getNodeChildren(parentId: string): BaseNode[] {
    const parent = this.getNode(parentId);
    if (!parent) return [];
    return (parent.children || []).map(id => this.getNode(id)).filter(Boolean) as BaseNode[];
  }

  getNodeParent(nodeId: string): BaseNode | null {
    const node = this.getNode(nodeId);
    if (!node || !node.parentId) return null;
    return this.getNode(node.parentId);
  }

  /** 计算绝对坐标（递归） */
  getAbsoluteTransform(nodeId: string): { x: number; y: number; rotation: number } {
    const node = this.getNode(nodeId);
    if (!node) return { x: 0, y: 0, rotation: 0 };
    
    const parent = this.getNodeParent(nodeId);
    if (!parent) {
      return { x: node.x, y: node.y, rotation: node.rotation || 0 };
    }
    
    const parentAbs = this.getAbsoluteTransform(parent.id);
    // 简化计算（未考虑旋转嵌套）
    return {
      x: parentAbs.x + node.x,
      y: parentAbs.y + node.y,
      rotation: parentAbs.rotation + (node.rotation || 0)
    };
  }

  // ========== 树操作（核心） ==========

  /** 添加节点到父节点 */
  addNode(node: BaseNode, parentId: string, index?: number): void {
    const parent = this.getNode(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);
    
    node.parentId = parentId;
    node.id = node.id || nanoid();
    
    // 更新父节点 children
    const children = [...(parent.children || [])];
    if (index !== undefined) {
      children.splice(index, 0, node.id);
    } else {
      children.push(node.id);
    }
    parent.children = children;
    
    // 注册到 nodeMap
    this.nodeMap.set(node.id, node);
  }

  /** 删除节点及其所有子树 */
  removeNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node) return;
    
    // 递归删除所有子节点
    const deleteRecursive = (id: string) => {
      const n = this.getNode(id);
      if (!n) return;
      n.children?.forEach(deleteRecursive);
      this.nodeMap.delete(id);
    };
    node.children?.forEach(deleteRecursive);
    this.nodeMap.delete(nodeId);
    
    // 从父节点移除引用
    if (node.parentId) {
      const parent = this.getNode(node.parentId);
      if (parent) {
        parent.children = parent.children?.filter(id => id !== nodeId) || [];
      }
    }
  }

  /** 移动节点到新父节点（带索引） */
  moveNode(nodeId: string, newParentId: string, index?: number): void {
    // 1. 从旧父节点移除
    const node = this.getNode(nodeId);
    if (!node || !node.parentId) return;
    
    const oldParent = this.getNode(node.parentId);
    if (oldParent) {
      oldParent.children = oldParent.children?.filter(id => id !== nodeId) || [];
    }
    
    // 2. 加入新父节点
    node.parentId = newParentId;
    const newParent = this.getNode(newParentId);
    if (newParent) {
      const children = [...(newParent.children || [])];
      if (index !== undefined) {
        children.splice(index, 0, nodeId);
      } else {
        children.push(nodeId);
      }
      newParent.children = children;
    }
  }

  /** 复制节点及其子树 */
  cloneNode(nodeId: string, newParentId: string): string {
    const original = this.getNode(nodeId);
    if (!original) throw new Error(`Node ${nodeId} not found`);
    
    const clone = this.deepClone(original);
    const newId = nanoid();
    clone.id = newId;
    
    // 递归更新所有子节点的 parentId
    const updateParents = (n: BaseNode, oldParentId: string) => {
      n.parentId = n.parentId === original.id ? newId : n.parentId;
      n.children?.forEach(childId => {
        const child = this.getNode(childId);
        if (child) updateParents(child, n.id);
      });
    };
    
    this.addNode(clone, newParentId);
    return newId;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // ========== 序列化 ==========

  toJSON(): Document {
    return this.document;
  }

  static fromJSON(json: Document): SceneGraph {
    const sg = new SceneGraph(json);
    // 重建 nodeMap
    sg.rebuildNodeMap();
    return sg;
  }

  private rebuildNodeMap(): void {
    this.nodeMap.clear();
    this.traverse(node => {
      this.nodeMap.set(node.id, node);
    });
  }
}
```

---

## 五、Selection Engine（选择系统）

### 5.1 职责

1. **单选** — 点击选中，显示边框+控制点
2. **Shift 多选** — 追加/取消选中
3. **框选** — 拖动矩形框，包含而非点接触
4. **穿透选择** — Cmd+Click 或双击进入组/Frame
5. **全选** — Cmd+A
6. **选择边界计算** — 多选时计算包围盒

### 5.2 Selection State

```typescript
// stores/selectionStore.ts

interface SelectionState {
  // 选中的节点 ID 数组
  selectedIds: string[];
  
  // 当前的"选择上下文"（双击进入组后）
  // 用于穿透选择
  selectionContextId: string | null;  // 当前在哪个 Frame/Group 内
  
  // 选择模式
  mode: 'simple' | 'marquee' | 'deep';
  
  // 框选矩形（屏幕坐标）
  marqueeRect: { x: number; y: number; width: number; height: number } | null;
}

interface SelectionStore {
  // State
  selectedIds: string[];
  selectionContextId: string | null;  // 双击进入的 Frame/Group ID
  marqueeRect: { x: number; y: number; width: number; height: number } | null;
  
  // Actions
  select(id: string, additive?: boolean): void;
  deselect(id: string): void;
  selectOnly(id: string): void;
  selectAll(): void;
  clearSelection(): void;
  
  // 框选
  startMarquee(x: number, y: number): void;
  updateMarquee(x: number, y: number, w: number, h: number): void;
  endMarquee(): void;
  
  // 穿透选择
  enterContext(id: string): void;   // 双击进入 Frame/Group
  exitContext(): void;              // ESC 或点击空白
  selectDeep(id: string): void;     // Cmd+Click 穿透选中
  
  // 计算
  getSelectedNodes(): BaseNode[];
  getSelectionBounds(): { x: number; y: number; width: number; height: number } | null;
  getSelectionCenter(): { x: number; y: number };
}
```

### 5.3 框选算法

```typescript
// lib/selection/contains.ts

/**
 * 点是否在矩形内
 */
function pointInRect(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * 节点是否与矩形相交（用于框选）
 * mode: 'contain' = 节点完全在框内
 *       'intersect' = 节点与框任意相交
 */
function nodeIntersectsRect(
  node: BaseNode,
  rect: { x: number; y: number; width: number; height: number },
  sceneGraph: SceneGraph,
  mode: 'contain' | 'intersect' = 'intersect'
): boolean {
  const abs = sceneGraph.getAbsoluteTransform(node.id);
  const nodeRect = {
    x: abs.x,
    y: abs.y,
    width: node.width,
    height: node.height
  };
  
  if (mode === 'contain') {
    return (
      nodeRect.x >= rect.x &&
      nodeRect.y >= rect.y &&
      nodeRect.x + nodeRect.width <= rect.x + rect.width &&
      nodeRect.y + nodeRect.height <= rect.y + rect.height
    );
  }
  
  // 矩形相交检测
  return !(
    nodeRect.x > rect.x + rect.width ||
    nodeRect.x + nodeRect.width < rect.x ||
    nodeRect.y > rect.y + rect.height ||
    nodeRect.y + nodeRect.height < rect.y
  );
}

/**
 * 获取框选范围内的所有节点
 */
function getNodesInMarquee(
  rect: { x: number; y: number; width: number; height: number },
  sceneGraph: SceneGraph,
  rootId: string,  // 从哪个节点开始搜索（selectionContextId）
  mode: 'contain' | 'intersect' = 'intersect'
): string[] {
  const result: string[] = [];
  
  sceneGraph.traverse(node => {
    if (node.id === rootId) return;  // 不选自己
    if (node.locked || !node.visible) return;
    if (nodeIntersectsRect(node, rect, sceneGraph, mode)) {
      result.push(node.id);
    }
  }, rootId);
  
  return result;
}
```

---

## 六、Transform Engine（变换系统）

### 6.1 职责

1. **移动** — 拖动元素，支持 Shift 锁定轴
2. **缩放** — 八点控制点，Shift 等比，Alt 中心缩放
3. **旋转** — 旋转手柄，Shift 15° 步进
4. **翻转** — H 水平翻转，V 垂直翻转
5. **多选变换** — 批量移动/缩放/旋转

### 6.2 Transform State

```typescript
// stores/transformStore.ts

interface TransformState {
  // 当前变换模式
  mode: 'idle' | 'moving' | 'scaling' | 'rotating' | 'skewing';
  
  // 变换起点（鼠标按下时）
  startPoint: { x: number; y: number };
  
  // 变换过程中的偏移量
  delta: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  
  // 缩放参考点
  scaleOrigin: 'corner' | 'center';
  
  // 旋转中心
  rotationCenter: 'corner' | 'center' | '的自己';
}

interface TransformStore extends TransformState {
  // 启动变换
  startMove(id: string, x: number, y: number): void;
  startScale(id: string, x: number, y: number, origin: 'corner' | 'center'): void;
  startRotate(id: string, x: number, y: number): void;
  
  // 更新变换
  updateMove(x: number, y: number): void;
  updateScale(x: number, y: number, shiftKey: boolean, altKey: boolean): void;
  updateRotate(x: number, y: number, shiftKey: boolean): void;
  
  // 提交变换（生成 Undo 历史）
  commitTransform(): void;
  cancelTransform(): void;
}
```

### 6.3 缩放算法

```typescript
// lib/transform/scale.ts

interface ScaleOptions {
  origin: { x: number; y: number };  // 缩放参考点
  shiftKey: boolean;                  // 等比缩放
  altKey: boolean;                    // 中心缩放
}

/**
 * 计算缩放后的新尺寸和位置
 */
function computeScale(
  node: BaseNode,
  scaleX: number,
  scaleY: number,
  options: ScaleOptions
): { x: number; y: number; width: number; height: number } {
  const { origin, shiftKey } = options;
  
  // 等比缩放
  if (shiftKey) {
    const ratio = Math.max(Math.abs(scaleX), Math.abs(scaleY));
    scaleX = ratio * Math.sign(scaleX || 1);
    scaleY = ratio * Math.sign(scaleY || 1);
  }
  
  // 计算新尺寸
  let newWidth = node.width * Math.abs(scaleX);
  let newHeight = node.height * Math.abs(scaleY);
  
  // 计算新位置（相对于参考点）
  let newX = origin.x + (node.x - origin.x) * scaleX;
  let newY = origin.y + (node.y - origin.y) * scaleY;
  
  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

/**
 * 多选缩放：所有选中节点相对于共同包围盒变换
 */
function computeMultiSelectScale(
  selectedIds: string[],
  sceneGraph: SceneGraph,
  scaleX: number,
  scaleY: number,
  options: ScaleOptions
): Map<string, { x: number; y: number; width: number; height: number }> {
  const result = new Map();
  
  // 计算选中节点的共同包围盒
  const bounds = computeSelectionBounds(selectedIds, sceneGraph);
  if (!bounds) return result;
  
  // 以包围盒中心为参考点
  const origin = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  
  for (const id of selectedIds) {
    const node = sceneGraph.getNode(id);
    if (!node) continue;
    
    // 计算相对于共同包围盒的偏移比例
    const relativeX = (node.x - bounds.x) / bounds.width;
    const relativeY = (node.y - bounds.y) / bounds.height;
    const relativeW = node.width / bounds.width;
    const relativeH = node.height / bounds.height;
    
    // 应用缩放到包围盒，再映射回节点
    const newBounds = {
      x: origin.x + (bounds.x - origin.x) * scaleX,
      y: origin.y + (bounds.y - origin.y) * scaleY,
      width: bounds.width * Math.abs(scaleX),
      height: bounds.height * Math.abs(scaleY)
    };
    
    result.set(id, {
      x: newBounds.x + relativeX * newBounds.width,
      y: newBounds.y + relativeY * newBounds.height,
      width: relativeW * newBounds.width,
      height: relativeH * newBounds.height
    });
  }
  
  return result;
}
```

---

## 七、Snap Engine（智能辅助线系统）

### 7.1 职责

拖动时实时显示：
- **对齐线**（水平/垂直）
- **距离线**（到最近元素的距离）
- **相等间距**（多个元素间距相等）
- **中心点**（元素中心对齐）

### 7.2 Snap Line 数据结构

```typescript
// lib/snap/types.ts

type SnapLineType = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'gap';

interface SnapLine {
  type: SnapLineType;
  position: number;              // 位置（画布坐标）
  sourceId: string;            // 来源节点
  targetId?: string;            // 目标节点（对齐到）
  label?: string;               // 显示的距离值
}

interface SnapResult {
  snappedX: number | null;     // 吸附后的 X（null = 不吸附）
  snappedY: number | null;     // 吸附后的 Y
  snapLines: SnapLine[];       // 这次吸附产生的辅助线
  guides: SnapGuide[];          // 用户自定义参考线
}

// 吸附阈值（像素）
const SNAP_THRESHOLD = 8;

// 参考点枚举
type SnapAnchor = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';

/**
 * 获取节点的所有参考点（用于吸附计算）
 */
function getNodeAnchors(node: BaseNode, absX: number, absY: number): Array<{ anchor: SnapAnchor; x: number; y: number }> {
  return [
    { anchor: 'left',    x: absX,              y: absY + node.height / 2 },
    { anchor: 'right',   x: absX + node.width, y: absY + node.height / 2 },
    { anchor: 'top',     x: absX + node.width / 2, y: absY },
    { anchor: 'bottom',  x: absX + node.width / 2, y: absY + node.height },
    { anchor: 'centerX', x: absX + node.width / 2, y: absY + node.height / 2 },
    { anchor: 'centerY', x: absX + node.width / 2, y: absY + node.height / 2 },
  ];
}

/**
 * 吸附计算核心
 */
function computeSnap(
  draggingNode: { x: number; y: number; width: number; height: number },
  excludeIds: string[],         // 排除的节点（被拖动的节点自身）
  sceneGraph: SceneGraph,
  viewport: { x: number; y: number; zoom: number }  // 用于阈值计算
): SnapResult {
  const THRESHOLD = SNAP_THRESHOLD / viewport.zoom;
  const anchors = getNodeAnchors(
    draggingNode as BaseNode,
    draggingNode.x,
    draggingNode.y
  );
  
  const result: SnapResult = { snappedX: null, snappedY: null, snapLines: [], guides: [] };
  const allAnchors: Array<{ x: number; y: number; id: string; anchor: SnapAnchor }> = [];
  
  // 收集所有可吸附的参考点
  sceneGraph.traverse(node => {
    if (excludeIds.includes(node.id)) return;
    if (node.locked || !node.visible) return;
    
    const abs = sceneGraph.getAbsoluteTransform(node.id);
    const nodeAnchors = getNodeAnchors(node, abs.x, abs.y);
    nodeAnchors.forEach(a => allAnchors.push({ ...a, id: node.id }));
  });
  
  // 对每个拖动节点的锚点，找最近的参考点
  for (const anchor of anchors) {
    for (const ref of allAnchors) {
      // X 轴吸附
      if (Math.abs(anchor.x - ref.x) < THRESHOLD) {
        result.snappedX = draggingNode.x + (ref.x - anchor.x);
        result.snapLines.push({
          type: ref.anchor.includes('X') ? 'centerX' : 'left',
          position: ref.x,
          sourceId: ref.id,
          label: Math.round(Math.abs(draggingNode.x + (ref.x - anchor.x) - ref.x)).toString()
        });
      }
      
      // Y 轴吸附
      if (Math.abs(anchor.y - ref.y) < THRESHOLD) {
        result.snappedY = draggingNode.y + (ref.y - anchor.y);
        result.snapLines.push({
          type: ref.anchor.includes('Y') ? 'centerY' : 'top',
          position: ref.y,
          sourceId: ref.id,
          label: Math.round(Math.abs(draggingNode.y + (ref.y - anchor.y) - ref.y)).toString()
        });
      }
    }
  }
  
  return result;
}
```

---

## 八、Keyboard Manager（快捷键系统）

### 8.1 设计思路

Figma 的快捷键是**全局的、与工具状态无关的**。V 永远是 Move，R 永远是 Rect。

```typescript
// lib/keyboard/KeyboardManager.ts

type KeyAction =
  | 'move'       // V
  | 'rect'       // R
  | 'frame'      // F
  | 'text'       // T
  | 'pen'        // P
  | 'ellipse'    // O
  | 'line'       // L
  | 'sticky'     // S
  | 'component'  // Ctrl+Alt+K
  | 'instance'   // Ctrl+Alt+I
  | 'group'      // Ctrl+G
  | 'ungroup'    // Ctrl+Shift+G
  | 'undo'       // Ctrl+Z
  | 'redo'       // Ctrl+Shift+Z / Ctrl+Y
  | 'copy'       // Ctrl+C
  | 'paste'      // Ctrl+V
  | 'duplicate'  // Ctrl+D
  | 'delete'     // Delete / Backspace
  | 'selectAll'  // Ctrl+A
  | 'deselect'   // Escape
  | 'scale'      // K
  | 'rotate'     // Shift+R
  | 'zoomIn'     // +
  | 'zoomOut'    // -
  | 'zoomFit'    // Shift+1
  | 'zoom100'    // Shift+0
  | 'pan'        // Space (hold)
  | 'flipH'      // Shift+H
  | 'flipV'      // Shift+V
  | 'lock'       // Ctrl+Shift+L
  | 'hide'       // Ctrl+Shift+H
  | 'bringFront' // Ctrl+Shift+]
  | 'sendBack'   // Ctrl+Shift+['
  ;

interface KeyBinding {
  action: KeyAction;
  keys: string[];      // ['V'] 或 ['Ctrl', 'C']
  preventDefault: boolean;
}

const BINDINGS: KeyBinding[] = [
  // 工具
  { action: 'move',      keys: ['V'],              preventDefault: false },
  { action: 'rect',      keys: ['R'],              preventDefault: false },
  { action: 'frame',     keys: ['F'],              preventDefault: false },
  { action: 'text',      keys: ['T'],              preventDefault: false },
  { action: 'pen',       keys: ['P'],              preventDefault: false },
  { action: 'ellipse',   keys: ['O'],              preventDefault: false },
  { action: 'line',      keys: ['L'],              preventDefault: false },
  { action: 'sticky',    keys: ['S'],              preventDefault: false },
  
  // 组织
  { action: 'group',     keys: ['Ctrl', 'G'],      preventDefault: true },
  { action: 'ungroup',   keys: ['Ctrl', 'Shift', 'G'], preventDefault: true },
  { action: 'component', keys: ['Ctrl', 'Alt', 'K'],    preventDefault: true },
  { action: 'instance',  keys: ['Ctrl', 'Alt', 'I'],    preventDefault: true },
  
  // 编辑
  { action: 'undo',      keys: ['Ctrl', 'Z'],      preventDefault: true },
  { action: 'redo',      keys: ['Ctrl', 'Shift', 'Z'],  preventDefault: true },
  { action: 'copy',      keys: ['Ctrl', 'C'],      preventDefault: true },
  { action: 'paste',     keys: ['Ctrl', 'V'],      preventDefault: true },
  { action: 'duplicate', keys: ['Ctrl', 'D'],      preventDefault: true },
  { action: 'delete',    keys: ['Delete'],         preventDefault: true },
  { action: 'delete',    keys: ['Backspace'],      preventDefault: true },
  
  // 选择
  { action: 'selectAll',  keys: ['Ctrl', 'A'],      preventDefault: true },
  { action: 'deselect',  keys: ['Escape'],         preventDefault: true },
  
  // 变换
  { action: 'scale',     keys: ['K'],              preventDefault: false },
  { action: 'flipH',     keys: ['Shift', 'H'],     preventDefault: true },
  { action: 'flipV',     keys: ['Shift', 'V'],     preventDefault: true },
  
  // 视图
  { action: 'zoomIn',    keys: ['+'],               preventDefault: false },
  { action: 'zoomOut',   keys: ['-'],              preventDefault: false },
  { action: 'zoomFit',   keys: ['Shift', '1'],      preventDefault: false },
  { action: 'zoom100',   keys: ['Shift', '0'],      preventDefault: false },
  { action: 'pan',       keys: ['Space'],          preventDefault: false },
  
  // 图层顺序
  { action: 'bringFront', keys: ['Ctrl', 'Shift', ']'], preventDefault: true },
  { action: 'sendBack',  keys: ['Ctrl', 'Shift', '['],  preventDefault: true },
  
  // 锁定/隐藏
  { action: 'lock',      keys: ['Ctrl', 'Shift', 'L'],  preventDefault: true },
  { action: 'hide',      keys: ['Ctrl', 'Shift', 'H'],  preventDefault: true },
];

export class KeyboardManager {
  private listeners: Map<KeyAction, Array<() => void>> = new Map();
  private activeKeys: Set<string> = new Set();
  private enabled: boolean = true;
  
  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
  }
  
  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
  
  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
  
  /** 注册快捷键回调 */
  on(action: KeyAction, callback: () => void): () => void {
    const arr = this.listeners.get(action) || [];
    arr.push(callback);
    this.listeners.set(action, arr);
    
    return () => {
      const a = this.listeners.get(action) || [];
      this.listeners.set(action, a.filter(cb => cb !== callback));
    };
  }
  
  /** 判断当前按下的键是否匹配某个组合键 */
  private matchesBinding(keys: string[]): boolean {
    const pressed = this.activeKeys;
    
    for (const k of keys) {
      if (k === 'Ctrl') {
        if (!pressed.has('Control') && !pressed.has('Meta')) return false;
      } else if (k === 'Shift') {
        if (!pressed.has('Shift')) return false;
      } else if (k === 'Alt') {
        if (!pressed.has('Alt')) return false;
      } else {
        if (!pressed.has(k)) return false;
      }
    }
    return true;
  }
  
  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return;
    
    this.activeKeys.add(e.key);
    this.activeKeys.add(e.code);
    
    for (const binding of BINDINGS) {
      if (this.matchesBinding(binding.keys)) {
        if (binding.preventDefault) {
          e.preventDefault();
        }
        
        const callbacks = this.listeners.get(binding.action);
        callbacks?.forEach(cb => cb());
        
        // 找到匹配就停止（避免一个按键触发多个 action）
        break;
      }
    }
  }
  
  private handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.key);
    this.activeKeys.delete(e.code);
  }
  
  /** 检查某个 action 当前是否被按下 */
  isPressed(action: KeyAction): boolean {
    const binding = BINDINGS.find(b => b.action === action);
    if (!binding) return false;
    return this.matchesBinding(binding.keys);
  }
}
```

### 8.2 使用方式

```typescript
// 在 Editor.tsx 或 Canvas 初始化时

const keyboard = useRef(new KeyboardManager());

useEffect(() => {
  const k = keyboard.current;
  
  k.on('undo', () => editorStore.getState().undo());
  k.on('redo', () => editorStore.getState().redo());
  k.on('delete', () => deleteSelectedNodes());
  k.on('duplicate', () => duplicateSelectedNodes());
  k.on('selectAll', () => selectionStore.getState().selectAll());
  k.on('deselect', () => selectionStore.getState().clearSelection());
  k.on('copy', () => copyToClipboard());
  k.on('paste', () => pasteFromClipboard());
  
  // 工具切换
  k.on('move', () => setTool('move'));
  k.on('rect', () => setTool('rect'));
  k.on('frame', () => setTool('frame'));
  
  // 变换
  k.on('scale', () => setTransformMode('scale'));
  
  // Alt + Drag = 复制
  k.on('duplicate', () => {
    // 在 mousedown 监听器中检测 Alt 键实现
  });
  
  return () => k.destroy();
}, []);
```

---

## 九、Layer Tree（图层面板）

### 9.1 Layer Tree 数据结构

```typescript
// components/LayerTree.tsx

interface LayerTreeNodeProps {
  nodeId: string;
  depth: number;           // 缩进层级
  isExpanded: boolean;     // 是否展开
  isSelected: boolean;
}

/**
 * 虚拟化图层列表（大型项目必须）
 * 使用 react-window 或 @tanstack/react-virtual
 */
function LayerTree({ rootNodeId }: { rootNodeId: string }) {
  const { selectedIds, select, toggleExpand } = useSelectionStore();
  const sceneGraph = useSceneGraph();
  
  // 虚拟化：只渲染可见节点
  // const { listProps, item } = useVirtualList(visibleNodes, { height: 28 });
  
  return (
    <div className="layer-tree">
      <LayerTreeNode nodeId={rootNodeId} depth={0} />
    </div>
  );
}

function LayerTreeNode({ nodeId, depth }: LayerTreeNodeProps) {
  const node = sceneGraph.getNode(nodeId);
  const { selectedIds, select, toggleExpand } = useSelectionStore();
  const { expandedIds } = useExpandedStore();
  
  if (!node) return null;
  
  const isExpanded = expandedIds.has(nodeId);
  const isSelected = selectedIds.includes(nodeId);
  const hasChildren = node.children && node.children.length > 0;
  
  // 双击：如果是容器，进入穿透选择上下文
  const handleDoubleClick = () => {
    if (hasChildren) {
      selectionStore.getState().enterContext(nodeId);
    }
  };
  
  // 拖拽排序：可以拖动图层到新的位置/父节点
  const handleDragEnd = (newParentId: string, index: number) => {
    sceneGraph.moveNode(nodeId, newParentId, index);
  };
  
  return (
    <>
      <div
        className={`layer-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => select(nodeId)}
        onDoubleClick={handleDoubleClick}
        draggable
        onDragEnd={(e) => {
          // 计算 drop 目标
          const dropTarget = findDropTarget(e);  // 实现省略
          handleDragEnd(dropTarget.parentId, dropTarget.index);
        }}
      >
        {/* 展开/折叠箭头 */}
        <button
          className="expand-btn"
          onClick={(e) => { e.stopPropagation(); toggleExpand(nodeId); }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        
        {/* 图层类型图标 */}
        <span className="layer-icon">{getNodeIcon(node.type)}</span>
        
        {/* 图层名称（可编辑） */}
        {editingId === nodeId ? (
          <input
            className="layer-name-input"
            value={node.name}
            onChange={(e) => sceneGraph.updateNodeName(nodeId, e.target.value)}
            onBlur={() => setEditingId(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="layer-name"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingId(nodeId); }}
          >
            {node.name}
          </span>
        )}
        
        {/* 工具按钮 */}
        <button className="visibility-btn" onClick={(e) => { e.stopPropagation(); sceneGraph.toggleVisible(nodeId); }}>
          {node.visible ? '👁' : '👁‍🗨'}
        </button>
        <button className="lock-btn" onClick={(e) => { e.stopPropagation(); sceneGraph.toggleLocked(nodeId); }}>
          {node.locked ? '🔒' : '🔓'}
        </button>
      </div>
      
      {/* 递归渲染子节点 */}
      {isExpanded && hasChildren && (
        <div className="layer-children">
          {node.children.map(childId => (
            <LayerTreeNode key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}
```

---

## 十、Canvas Renderer（渲染器）

### 10.1 为什么当前 Konva 有问题

```
当前架构：
  Konva Stage（Canvas）
  + DOM Overlay（图层名称编辑、输入框）
  + DOM Toolbar（工具栏）
  = 三套坐标系统必须同步

Figma 架构：
  统一 Canvas 渲染（包含所有 UI 元素）
  = 一套坐标系统
```

### 10.2 渲染器接口（抽象）

```typescript
// lib/renderer/Renderer.ts

interface Renderer {
  /** 初始化 */
  init(container: HTMLElement): void;
  
  /** 销毁 */
  destroy(): void;
  
  /** 清空画布 */
  clear(): void;
  
  /** 渲染单帧（完整重绘） */
  renderFrame(sceneGraph: SceneGraph, camera: Camera, selection: SelectionState): void;
  
  /** 增量更新（只重绘变化的节点） */
  updateNodes(nodeIds: string[]): void;
  
  /** 设置视口变换（缩放/平移） */
  setViewport(x: number, y: number, zoom: number): void;
  
  /** 获取视口信息 */
  getViewport(): { x: number; y: number; zoom: number };
  
  /** 坐标转换 */
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number };
  
  /** 拾取（hit test）— 找到鼠标位置下的节点 */
  hitTest(screenX: number, screenY: number): string | null;
  
  /** 缩放适应内容 */
  zoomToFit(bounds: { x: number; y: number; width: number; height: number }): void;
  
  /** 设置光标 */
  setCursor(cursor: string): void;
  
  /** 绘制选框 */
  drawSelectionBox(bounds: { x: number; y: number; width: number; height: number }, color?: string): void;
  
  /** 绘制辅助线 */
  drawSnapLines(lines: SnapLine[]): void;
  
  /** 绘制框选矩形 */
  drawMarquee(rect: { x: number; y: number; width: number; height: number }): void;
}

interface Camera {
  x: number;       // 平移 X
  y: number;       // 平移 Y
  zoom: number;    // 缩放（0.1 到 10）
}
```

### 10.3 当前 Konva 实现（过渡方案）

```typescript
// lib/renderer/KonvaRenderer.ts

export class KonvaRenderer implements Renderer {
  private stage: Konva.Stage;
  private mainLayer: Konva.Layer;
  private overlayLayer: Konva.Layer;
  private gridLayer: Konva.Layer;
  private selectionLayer: Konva.Layer;
  
  constructor(container: HTMLElement) {
    this.stage = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
    });
    
    this.gridLayer = new Konva.Layer();
    this.mainLayer = new Konva.Layer();
    this.overlayLayer = new Konva.Layer();
    this.selectionLayer = new Konva.Layer();
    
    this.stage.add(this.gridLayer, this.mainLayer, this.overlayLayer, this.selectionLayer);
    
    // 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      this.stage.width(container.clientWidth);
      this.stage.height(container.clientHeight);
    });
    resizeObserver.observe(container);
  }
  
  setViewport(x: number, y: number, zoom: number): void {
    // 应用到所有层
    const scale = zoom;
    const position = { x, y };
    
    [this.gridLayer, this.mainLayer, this.overlayLayer].forEach(layer => {
      layer.scale({ x: scale, y: scale });
      layer.position(position);
    });
    
    this.selectionLayer.scale({ x: scale, y: scale });
    this.selectionLayer.position(position);
  }
  
  hitTest(screenX: number, screenY: number): string | null {
    // 考虑缩放和平移
    const transform = this.mainLayer.getAbsoluteTransform().copy().invert();
    const canvasPos = transform.point({ x: screenX, y: screenY });
    
    // 使用 Konva 内置拾取
    const shape = this.mainLayer.getIntersection(canvasPos.x, canvasPos.y);
    if (shape) {
      return shape.id();  // 节点 ID
    }
    return null;
  }
  
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const transform = this.mainLayer.getAbsoluteTransform().copy().invert();
    return transform.point({ x: screenX, y: screenY });
  }
  
  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    return this.mainLayer.getAbsoluteTransform().point({ x: canvasX, y: canvasY });
  }
  
  renderFrame(sceneGraph: SceneGraph, camera: Camera, selection: SelectionState): void {
    // 清空主图层
    this.mainLayer.destroyChildren();
    
    // 按深度排序渲染（z-index）
    const sortedNodes = this.getNodesByDepth(sceneGraph);
    
    for (const node of sortedNodes) {
      const abs = sceneGraph.getAbsoluteTransform(node.id);
      const shape = this.createKonvaShape(node, abs);
      this.mainLayer.add(shape);
    }
    
    // 渲染选中框
    this.renderSelection(selection);
    
    this.mainLayer.batchDraw();
  }
  
  private createKonvaShape(node: BaseNode, abs: { x: number; y: number; rotation: number }): Konva.Shape {
    // 根据 node.type 创建对应 Konva 图形
    switch (node.type) {
      case 'rectangle':
      case 'frame':
        return new Konva.Rect({
          id: node.id,
          x: abs.x,
          y: abs.y,
          width: node.width,
          height: node.height,
          fill: (node as any).fill,
          stroke: (node as any).stroke,
          strokeWidth: (node as any).strokeWidth,
          cornerRadius: (node as any).cornerRadius,
          rotation: abs.rotation,
          opacity: node.opacity,
        });
      
      case 'ellipse':
        return new Konva.Ellipse({
          id: node.id,
          x: abs.x + node.width / 2,
          y: abs.y + node.height / 2,
          radiusX: node.width / 2,
          radiusY: node.height / 2,
          fill: (node as any).fill,
          stroke: (node as any).stroke,
          strokeWidth: (node as any).strokeWidth,
          rotation: abs.rotation,
          opacity: node.opacity,
        });
      
      case 'text':
        return new Konva.Text({
          id: node.id,
          x: abs.x,
          y: abs.y,
          text: (node as any).text,
          fontSize: (node as any).fontSize,
          fontFamily: (node as any).fontFamily,
          fill: (node as any).fill || '#000',
          rotation: abs.rotation,
          opacity: node.opacity,
        });
      
      // ... 其他类型
      
      default:
        return new Konva.Rect({
          id: node.id,
          x: abs.x,
          y: abs.y,
          width: node.width,
          height: node.height,
          stroke: '#ccc',
          strokeWidth: 1,
        });
    }
  }
  
  private renderSelection(selection: SelectionState): void {
    this.selectionLayer.destroyChildren();
    
    for (const id of selection.selectedIds) {
      const node = sceneGraph.getNode(id);
      if (!node) continue;
      
      const abs = sceneGraph.getAbsoluteTransform(id);
      
      // 选中框
      const box = new Konva.Rect({
        x: abs.x - 1,
        y: abs.y - 1,
        width: node.width + 2,
        height: node.height + 2,
        stroke: '#D4A853',
        strokeWidth: 1 / camera.zoom,  // 缩放时不失真
        dash: [4 / camera.zoom, 4 / camera.zoom],
      });
      
      // 八点控制点
      const handles = this.createResizeHandles(abs, node, camera.zoom);
      
      this.selectionLayer.add(box);
      handles.forEach(h => this.selectionLayer.add(h));
    }
    
    this.selectionLayer.batchDraw();
  }
  
  drawMarquee(rect: { x: number; y: number; width: number; height: number }): void {
    // 绘制框选矩形
    // ...
  }
  
  drawSnapLines(lines: SnapLine[]): void {
    // 绘制吸附辅助线
    // ...
  }
}
```

---

## 十一、Undo/Redo 系统（Command Pattern）

### 11.1 Command 接口

```typescript
// lib/history/Command.ts

interface Command {
  id: string;
  name: string;           // 用于显示（"Move Rectangle", "Delete Frame"）
  timestamp: number;
  
  /** 执行命令 */
  execute(): void;
  
  /** 撤销命令 */
  undo(): void;
  
  /** 可选：检查是否可以执行 */
  canExecute?(): boolean;
}

/** 复合命令（用于批量操作） */
class CompositeCommand implements Command {
  id = nanoid();
  timestamp = Date.now();
  
  constructor(public name: string, public commands: Command[]) {}
  
  execute() { this.commands.forEach(c => c.execute()); }
  undo() { [...this.commands].reverse().forEach(c => c.undo()); }
}

/** 具体的命令实现 */
class MoveNodesCommand implements Command {
  id = nanoid();
  timestamp = Date.now();
  
  constructor(
    private nodeIds: string[],
    private deltaX: number,
    private deltaY: number,
    private sceneGraph: SceneGraph
  ) {}
  
  get name() { return `Move ${this.nodeIds.length} node(s)`; }
  
  execute() {
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.x += this.deltaX;
        node.y += this.deltaY;
      }
    }
  }
  
  undo() {
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.x -= this.deltaX;
        node.y -= this.deltaY;
      }
    }
  }
}

class DeleteNodesCommand implements Command {
  private backup: Map<string, { node: BaseNode; parentId: string; index: number }> = new Map();
  
  constructor(private nodeIds: string[], private sceneGraph: SceneGraph) {}
  
  get name() { return `Delete ${this.nodeIds.length} node(s)`; }
  
  execute() {
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      const parent = this.sceneGraph.getNodeParent(id);
      if (node && parent) {
        const index = parent.children.indexOf(id);
        this.backup.set(id, { node: JSON.parse(JSON.stringify(node)), parentId: parent.id, index });
        this.sceneGraph.removeNode(id);
      }
    }
  }
  
  undo() {
    // 按倒序恢复（保持原来的顺序）
    const sorted = [...this.backup.entries()].sort((a, b) => a[1].index - b[1].index);
    for (const [id, { node, parentId, index }] of sorted) {
      this.sceneGraph.addNode(node, parentId, index);
    }
  }
}

class AddNodeCommand implements Command {
  constructor(
    private node: BaseNode,
    private parentId: string,
    private index: number | undefined,
    private sceneGraph: SceneGraph
  ) {}
  
  get name() { return `Add ${this.node.type}`; }
  
  execute() {
    this.sceneGraph.addNode(this.node, this.parentId, this.index);
  }
  
  undo() {
    this.sceneGraph.removeNode(this.node.id);
  }
}

class GroupNodesCommand implements Command {
  private groupId: string;
  private group: GroupNode;
  
  constructor(
    private nodeIds: string[],
    private parentId: string,
    sceneGraph: SceneGraph
  ) {
    // 计算包围盒确定 group 位置
    const bounds = computeBounds(nodeIds, sceneGraph);
    this.groupId = nanoid();
    this.group = {
      id: this.groupId,
      type: 'group',
      name: 'Group',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      parentId,
      children: nodeIds,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      rotation: 0,
    };
  }
  
  get name() { return 'Group'; }
  
  execute() {
    // 创建组
    this.sceneGraph.addNode(this.group, this.parentId);
    // 移动子节点到组内（保持相对坐标）
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.x -= this.group.x;
        node.y -= this.group.y;
        this.sceneGraph.moveNode(id, this.groupId);
      }
    }
  }
  
  undo() {
    // 移出组
    for (const id of this.nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        node.x += this.group.x;
        node.y += this.group.y;
        this.sceneGraph.moveNode(id, this.parentId);
      }
    }
    this.sceneGraph.removeNode(this.groupId);
  }
}
```

### 11.2 History Manager

```typescript
// lib/history/HistoryManager.ts

const MAX_HISTORY = 100;

export class HistoryManager {
  private history: Command[] = [];
  private historyIndex: number = -1;
  private listeners: Array<() => void> = [];
  
  /** 执行命令并添加到历史 */
  execute(command: Command) {
    // 如果当前不在历史末尾，截断后面的历史
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    command.execute();
    this.history.push(command);
    this.historyIndex++;
    
    // 限制历史长度
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
      this.historyIndex--;
    }
    
    this.notify();
  }
  
  /** 撤销 */
  undo() {
    if (this.historyIndex < 0) return;
    
    const command = this.history[this.historyIndex];
    command.undo();
    this.historyIndex--;
    
    this.notify();
  }
  
  /** 重做 */
  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    
    this.historyIndex++;
    const command = this.history[this.historyIndex];
    command.execute();
    
    this.notify();
  }
  
  /** 是否有可撤销的操作 */
  canUndo(): boolean { return this.historyIndex >= 0; }
  
  /** 是否有可重做的操作 */
  canRedo(): boolean { return this.historyIndex < this.history.length - 1; }
  
  /** 订阅变化 */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  private notify() {
    this.listeners.forEach(l => l());
  }
  
  /** 获取历史列表（用于显示） */
  getHistory(): Command[] { return this.history; }
  getHistoryIndex(): number { return this.historyIndex; }
}
```

---

## 十二、整体代码结构

```
src/
├── app/
│   └── page.tsx                    # 编辑器入口
│
├── components/
│   ├── Editor.tsx                  # 编辑器主容器（协调所有子系统）
│   ├── Canvas.tsx                   # Canvas 主渲染区
│   │
│   ├── layers/
│   │   ├── LayerPanel.tsx           # 左侧图层面板
│   │   ├── LayerTree.tsx           # 图层树（虚拟化）
│   │   └── LayerTreeNode.tsx       # 单个图层节点
│   │
│   ├── toolbar/
│   │   ├── Toolbar.tsx             # 顶部工具栏
│   │   └── ToolButton.tsx          # 工具按钮
│   │
│   ├── properties/
│   │   ├── PropertiesPanel.tsx     # 右侧属性面板
│   │   ├── FillSection.tsx          # 填充属性
│   │   ├── StrokeSection.tsx       # 描边属性
│   │   ├── TextSection.tsx         # 文本属性
│   │   └── LayoutSection.tsx       # 布局属性（Auto Layout / Constraints）
│   │
│   ├── prototype/
│   │   ├── PrototypeToolbar.tsx     # 原型工具栏
│   │   ├── PrototypePlayer.tsx     # 原型预览播放器
│   │   ├── PrototypeOverlay.tsx    # 原型流程连线
│   │   ├── FlowEdge.tsx            # 流程连线 SVG
│   │   ├── OverlayPanel.tsx        # 浮层面板
│   │   ├── OverlayPortal.tsx       # 浮层 Portal
│   │   └── Backdrop.tsx            # 遮罩背景
│   │
│   └── shared/
│       ├── ColorPicker.tsx         # 颜色选择器
│       ├── Input.tsx               # 通用输入框
│       └── Select.tsx              # 通用下拉框
│
├── stores/
│   ├── useEditorStore.ts           # 主编辑器状态（Zustand）
│   ├── useSelectionStore.ts        # 选择状态
│   ├── useToolStore.ts             # 当前工具
│   ├── useViewportStore.ts         # 视口状态（缩放/平移）
│   └── useHistoryStore.ts           # 历史记录状态
│
├── lib/
│   ├── types.ts                    # 全局类型定义
│   │
│   ├── scene-graph/
│   │   ├── SceneGraph.ts           # 场景图引擎
│   │   ├── NodeMap.ts              # O(1) 节点查找 Map
│   │   └── index.ts
│   │
│   ├── renderer/
│   │   ├── Renderer.ts             # 渲染器接口
│   │   ├── KonvaRenderer.ts        # Konva 实现（过渡）
│   │   └── WebGLRenderer.ts        # WebGL 实现（未来）
│   │
│   ├── selection/
│   │   ├── SelectionEngine.ts      # 选择引擎
│   │   ├── contains.ts             # 碰撞检测
│   │   └── deepSelect.ts            # 穿透选择
│   │
│   ├── transform/
│   │   ├── TransformEngine.ts      # 变换引擎
│   │   ├── scale.ts                # 缩放算法
│   │   ├── rotate.ts               # 旋转算法
│   │   └── multiSelect.ts           # 多选变换
│   │
│   ├── snap/
│   │   ├── SnapEngine.ts           # 吸附引擎
│   │   ├── types.ts                 # SnapLine 等类型
│   │   └── compute.ts               # 吸附计算
│   │
│   ├── keyboard/
│   │   ├── KeyboardManager.ts      # 快捷键管理器
│   │   └── bindings.ts              # 快捷键绑定配置
│   │
│   ├── history/
│   │   ├── HistoryManager.ts        # 历史管理器
│   │   ├── Command.ts              # Command 接口和实现
│   │   └── index.ts
│   │
│   ├── layout/
│   │   ├── LayoutEngine.ts         # Auto Layout 引擎
│   │   ├── FlexboxLayout.ts         # Flexbox 算法
│   │   └── ConstraintsEngine.ts   # Constraints 引擎
│   │
│   ├── components/
│   │   ├── ComponentEngine.ts      # 组件引擎
│   │   ├── VariantManager.ts        # Variant 管理
│   │   └── OverrideEngine.ts        # 覆盖属性引擎
│   │
│   ├── prototype/
│   │   ├── PrototypeEngine.ts      # 原型交互引擎
│   │   ├── TransitionEngine.ts     # 转场动画引擎
│   │   └── evaluateConditions.ts    # 条件判断
│   │
│   ├── variables/
│   │   ├── VariableEngine.ts        # 变量引擎
│   │   └── interpolate.ts          # 变量插值
│   │
│   ├── export/
│   │   ├── SVGExporter.ts          # SVG 导出
│   │   ├── PNGExporter.ts          # PNG 导出
│   │   └── PDFExporter.ts          # PDF 导出
│   │
│   ├── ai/
│   │   ├── AIChat.tsx              # AI 对话组件
│   │   └── promptTemplates.ts      # AI 提示词模板
│   │
│   ├── easing.ts                   # 缓动函数
│   ├── smartAnimate.ts             # 智能动画
│   ├── colors.ts                   # 颜色工具
│   ├── geometry.ts                 # 几何工具
│   ├── nanoid.ts                   # ID 生成
│   └── debounce.ts                 # 防抖
│
├── hooks/
│   ├── useSceneGraph.ts            # SceneGraph React hook
│   ├── useSelection.ts             # 选择状态 hook
│   ├── useKeyboard.ts              # 键盘 hook
│   ├── useViewport.ts              # 视口 hook
│   ├── useDrag.ts                  # 拖拽 hook
│   ├── useResize.ts                # 缩放 hook
│   └── useHistory.ts               # 历史 hook
│
└── styles/
    └── globals.css                 # 全局样式
```

---

## 十三、重构计划（建议路线）

### Phase 0: 架构准备（2-3 周）

1. **定义 Scene Graph 类型系统**（types.ts）
2. **实现 SceneGraph.ts 引擎**
3. **实现 NodeMap（O(1) 查找）**
4. **迁移现有 shapes[] → document 结构**

### Phase 1: Canvas 核心（4-6 周）

1. **实现 KonvaRenderer**
2. **实现 SelectionEngine（单选/框选/多选）**
3. **实现 TransformEngine（移动/缩放/旋转）**
4. **实现 SnapEngine（辅助线）**
5. **实现 KeyboardManager**
6. **实现 HistoryManager（Undo/Redo）**

### Phase 2: 图层系统（3-4 周）

1. **实现 LayerTree（虚拟化）**
2. **实现拖拽排序**
3. **实现双击进入组（穿透选择）**
4. **实现图层重命名/锁定/隐藏**

### Phase 3: 专业能力（6-8 周）

1. **Auto Layout 引擎**
2. **Constraints 引擎**
3. **Component + Variant 系统**
4. **布尔运算引擎**
5. **钢笔工具**

### Phase 4: 协作 + AI（8+ 周）

1. **Yjs 协作层**
2. **AI 生成 UI**
3. **设计转代码**
4. **插件系统**

---

## 十四、一句话总结

> **Scene Graph 是地基，所有功能都建在上面。**
> 
> 当前项目最大的问题是 Scene Graph 形同虚设（扁平数组模拟树）。
> 
> **如果只能做一件事：先把 SceneGraph.ts 写对。**

---

*文档版本：v1.0 | 最后更新：2026-04-20*
