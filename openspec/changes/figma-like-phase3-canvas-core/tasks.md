# Tasks: figma-like Phase 3 — Canvas Core

## 1. 图层树系统重构

- [ ] 1.1 Shape 数据结构增加 `parentId?: string` 字段
- [ ] 1.2 实现 `getShapeChildren(id: string): Shape[]`
- [ ] 1.3 实现 `getShapeAncestors(id: string): Shape[]`
- [ ] 1.4 LayerPanel 支持嵌套显示（缩进 + 展开/折叠）
- [ ] 1.5 实现图层拖拽重排序（Konva 层级 + Store 更新）

## 2. 选择高亮系统升级

- [ ] 2.1 Konva Transformer 配置 8 锚点（4 角 + 4 边中）
- [ ] 2.2 添加旋转手柄（顶部延伸线 + 圆点）
- [ ] 2.3 多选时显示统一边界框
- [ ] 2.4 选择边框样式（虚线、颜色、宽度）

## 3. Frame 容器能力

- [ ] 3.1 Frame 渲染时设置 clip + overflow hidden
- [ ] 3.2 子元素坐标转换为画布绝对坐标
- [ ] 3.3 Frame 变换（x,y,width,height,rotation）传递给子元素
- [ ] 3.4 嵌套 Frame 支持（递归坐标转换）

## 4. 多选操作

- [ ] 4.1 Shift+Click 多选逻辑
- [ ] 4.2 多选移动时保持相对位置
- [ ] 4.3 多选变换（缩放、旋转）统一应用

## 5. 右键上下文菜单

- [ ] 5.1 画布空白处右键（创建形状、粘贴）
- [ ] 5.2 元素上右键（复制、删除、置顶、置底、锁定）
- [ ] 5.3 Frame 内右键（创建 Frame、取消编组）

## 6. 集成测试

- [ ] 6.1 选择单个元素高亮正确
- [ ] 6.2 嵌套 Frame 内元素选择正确
- [ ] 6.3 拖拽重排图层顺序正确
- [ ] 6.4 多选变换正确
