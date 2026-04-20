# Delta for layer-panel

## ADDED Requirements

### Requirement: 左侧面板显示所有图形图层
SHALL 在 Layers Panel 列出 canvas 上所有图形。

#### Scenario: 图形列表按创建顺序显示
- **WHEN** 用户创建多个图形
- **THEN** Layers Panel 底部显示最新创建的图形，最顶部是最早的（newest at bottom）

#### Scenario: 每个 LayerItem 显示图形类型图标和名称
- **WHEN** LayerItem 渲染时
- **THEN** 显示对应图标（rect/circle/text/line）和默认名称"[类型] 1"等

### Requirement: 点击 LayerItem 选中画布上对应图形
SHALL 支持图层面板与画布联动选择。

#### Scenario: 点击 LayerItem 选中图形
- **WHEN** 用户点击 LayerItem
- **THEN** 画布上对应图形显示选中边框，LayerItem 本身高亮（accent border）

#### Scenario: 选中图形时 Layers Panel 自动滚动到对应项
- **WHEN** 画布上选中某个图形
- **THEN** Layers Panel 自动滚动显示对应 LayerItem（如果不可见）

### Requirement: LayerItem 支持可见性切换
SHALL 支持 Eye icon 切换图形显示/隐藏。

#### Scenario: 隐藏图形
- **WHEN** 用户点击 LayerItem 的 Eye icon
- **THEN** 图形 `visible=false`，画布上不渲染，LayerItem 显示 dimmed（50% opacity）

#### Scenario: 显示图形
- **WHEN** 隐藏状态下再次点击 Eye icon
- **THEN** 图形 `visible=true`，恢复正常显示

### Requirement: LayerItem 支持锁定切换
SHALL 支持 Lock icon 切换图形锁定状态。

#### Scenario: 锁定图形
- **WHEN** 用户点击 LayerItem 的 Lock icon
- **THEN** 图形 `locked=true`，画布上该图形不可选择/拖拽/缩放，LayerItem 显示 lock 图标

#### Scenario: 解锁图形
- **WHEN** 锁定状态下再次点击 Lock icon
- **THEN** 图形 `locked=false`，恢复正常交互

### Requirement: LayerItem 支持删除
SHALL 支持 hover 显示删除按钮。

#### Scenario: hover 显示删除按钮
- **WHEN** 鼠标 hover 到 LayerItem
- **THEN** 右侧显示 delete icon

#### Scenario: 点击删除
- **WHEN** 用户点击 LayerItem 的删除按钮
- **THEN** 该图形从 shapes 数组移除

### Requirement: 多选时批量操作
SHALL 在多选时显示"已选择 N 个"。

#### Scenario: 多选时面板头部显示数量
- **WHEN** 用户在画布上多选图形
- **THEN** Layers Panel 顶部显示"已选择 N 个"
