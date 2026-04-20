# Delta for canvas-editing

## ADDED Requirements

### Requirement: 画布可以创建基础图形
SHALL 支持创建矩形、圆形、文字、线条四种基础图形。

#### Scenario: 用户在 AI 对话中要求创建图形
- **WHEN** 用户输入"画一个蓝色圆形"或 AI 返回 add_shapes tool call
- **THEN** 系统将对应 Shape 添加到 Zustand store，画布立即渲染该图形

#### Scenario: 图形创建时有默认样式
- **WHEN** 图形创建时未指定样式
- **THEN** 使用默认 fill=#3A3A40, stroke=#5A5A60, strokeWidth=2, opacity=1

### Requirement: 画布支持选择图形
SHALL 支持点击选择图形，Shift+Click 多选。

#### Scenario: 单选图形
- **WHEN** 用户点击画布上的一个图形
- **THEN** 该图形显示选中边框（amber dashed border, 2px），右侧显示 Properties Panel

#### Scenario: 多选图形
- **WHEN** 用户 Shift+Click 多个图形
- **THEN** 所有被点击图形显示选中边框，Properties Panel 显示多选状态（共 N 个）

#### Scenario: 取消选择
- **WHEN** 用户点击画布空白区域或按 Escape
- **THEN** 取消所有选中状态，Properties Panel 隐藏

### Requirement: 选中图形可移动
SHALL 支持拖拽选中图形改变位置。

#### Scenario: 拖拽移动单个图形
- **WHEN** 选中图形后鼠标拖拽
- **THEN** 图形跟随鼠标移动，实时更新 x/y 坐标

#### Scenario: 移动时更新 Layers Panel
- **WHEN** 图形移动后
- **THEN** Layers Panel 对应 LayerItem 的位置信息同步更新

### Requirement: 选中图形可缩放
SHALL 通过拖拽控制点改变图形尺寸。

#### Scenario: 矩形/圆形可等比/非等比缩放
- **WHEN** 选中矩形或圆形时
- **THEN** 显示 8 个控制点（4角+4边），拖拽可改变宽高

#### Scenario: 线条可通过拖拽端点调整
- **WHEN** 选中线条时
- **THEN** 显示两个端点控制点，拖拽改变 points

### Requirement: 选中图形可删除
SHALL 支持 Delete/Backspace 删除选中图形。

#### Scenario: 删除单个图形
- **WHEN** 选中图形后按 Delete/Backspace
- **THEN** 该图形从 shapes 数组移除，画布立即重新渲染

#### Scenario: 删除多个图形
- **WHEN** 多选后按 Delete/Backspace
- **THEN** 所有选中图形全部删除

### Requirement: 画布支持缩放和平移
SHALL 支持滚轮缩放（以光标为中心），Space+拖拽平移。

#### Scenario: 滚轮缩放
- **WHEN** 滚动鼠标滚轮
- **THEN** 以光标位置为中心，zoom 变化（范围 10%-400%）

#### Scenario: Space+拖拽平移
- **WHEN** 按住 Space 并拖拽鼠标
- **THEN** 画布内容跟随拖拽方向移动

### Requirement: 画布有网格背景
SHALL 显示 dot grid 点阵网格背景。

#### Scenario: 网格始终可见
- **WHEN** 画布任意缩放级别
- **THEN** 显示 dot grid，dots 颜色 #252525，间距 20px
