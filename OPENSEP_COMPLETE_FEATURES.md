# figma_like — 完整功能完善计划

## 当前状态
- Phase 1-3: Canvas/图层/AI/布尔运算/Path/AutoLayout/Component ✅
- Phase 4: 双击编辑组件 ✅  
- Phase 6: Prototype 交互系统 ✅ (含 code review 修复)
- TypeScript: 0 errors | Git: 全部 push | Vercel: 自动部署

## 待完成功能清单

### 🔴 P0 — 核心缺失功能（影响完整 Figma 体验）

#### 1. Prototype 变量系统
- **Variable store** — `variables: Variable[]` + `scopes: VariableScope[]` 在 useEditorStore
- **变量 picker UI** — 在 InteractionEditor 中选择/创建变量
- **变量插值** — 在 text 层中用 `{{variableName}}` 语法
- **变量赋值的 action** — `setVariable` action type
- 文件: `stores/useEditorStore.ts`, `components/PropertiesPanel.tsx`

#### 2. Component States（组件状态机）
- **StateType** — `default | hover | active | pressed | focused | disabled`
- **StateOverride** — 记录每个状态的属性覆盖
- **状态切换 action** — `setState(state: StateType)` action
- **hover/active 样式应用** — 在 Canvas 渲染时检查状态
- 文件: `lib/types.ts`, `Canvas.tsx`, `components/PropertiesPanel.tsx`

#### 3. Conditional Logic（条件连线）
- **Condition type** — `{ leftVar: string; op: '==' | '!=' | '>' | '<'; rightVal: string }`
- **ConditionalEdge** — 带条件的连线，条件满足才高亮
- **条件编辑器 UI** — 在 Flow 模式中编辑条件
- 文件: `lib/types.ts`, `components/prototype/FlowEdge.tsx`

#### 4. whileDragging Trigger（拖拽触发器）
- **拖拽跟随** — drag 元素实时跟随鼠标
- **位置吸附** — snap to positions
- **drag 结束触发** — onDragEnd 事件
- 文件: `components/PrototypePlayer.tsx`

### 🟡 P1 — 重要但非阻塞

#### 5. Prototype Share Link（原型分享）
- 生成唯一 prototype URL (含 prototypeMode + startFrame)
- 从 URL 启动直接进入 PREVIEW 模式

#### 6. Overflow Scroll（溢出滚动）
- prototype frame 超出视口时的滚动行为
- scroll-x / scroll-y 属性

#### 7. Grid Overlay（网格叠加层）
- LayoutGrid 在编辑模式可视化
- column / row / grid 三种网格

#### 8. Shared Library（组件库同步）
- 检测实例与 master 差异
- "更新所有实例" 按钮

#### 9. Blend Fills（混合填充）
- Figma 同一层支持多个 fills，每个可设置混合模式
- fills: Fill[] (已有结构，但渲染只用了单 fill)

#### 10. Per-Corner Radius（独立圆角）
- `cornerRadiusTopLeft/TopRight/BottomRight/BottomLeft`
- UI: 4 个独立输入框 + link toggle

### 🟢 P2 — 体验优化

#### 11. Component Search（组件库搜索增强）
- 图标预览
- 分类筛选
- 收藏功能

#### 12. Hotspot Visualization（热点可视化）
- 无可见内容的交互元素显示 hotspot 点
- FLOW 模式下 hover 显示

#### 13. Prototype Device Presets（设备预设）
- iPhone SE / iPhone 14 / iPad / Desktop 快捷切换
- DevicePreviewModal 已有时，扩展到 prototype preview

#### 14. Token Animation（Token 过渡动画）
- 变量值变化时的平滑过渡
- prototype transition 支持 token 插值

---

## 执行顺序（按依赖关系）

### Sprint 1: Prototype 变量 + Component States
1. Variable system (store + UI)
2. Component States (types + rendering)
3. Variable in text interpolation
4. setVariable action

### Sprint 2: Conditional Logic + whileDragging
5. Conditional edges (types + FlowEdge rendering)
6. whileDragging implementation
7. Overflow scroll

### Sprint 3: 体验增强
8. Prototype share link
9. Grid overlay
10. Per-corner radius
11. Blend fills (multi-fill rendering)
12. Shared library sync

---

## 文件结构参考

```
src/
├── components/
│   ├── prototype/
│   │   ├── VariablePicker.tsx    [新建]
│   │   ├── ConditionEditor.tsx   [新建]
│   │   └── StateIndicator.tsx     [新建]
│   ├── Canvas.tsx                  [修改: Component States 渲染]
│   └── PropertiesPanel.tsx         [修改: Variable picker, State selector]
├── stores/
│   └── useEditorStore.ts           [修改: Variable CRUD, State management]
└── lib/
    ├── types.ts                     [修改: Variable, Condition, StateType]
    └── smartAnimate.ts              [修改: Variable interpolation]
```
