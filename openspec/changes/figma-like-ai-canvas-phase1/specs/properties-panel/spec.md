# Delta for properties-panel

## ADDED Requirements

### Requirement: 选中单个图形时显示完整属性
SHALL 在选中图形时显示所有可编辑属性。

#### Scenario: 选中图形显示属性编辑器
- **WHEN** 用户选中一个图形
- **THEN** Properties Panel 显示：Position(X/Y), Size(W/H 或 Radius), Fill, Stroke, Stroke Width, Opacity, Rotation

#### Scenario: 属性编辑实时生效
- **WHEN** 用户修改任何属性输入框
- **THEN** 画布上图形立即更新对应属性

### Requirement: 位置属性编辑
SHALL 支持 X/Y 坐标输入框编辑。

#### Scenario: 输入 X 坐标
- **WHEN** 用户在 X 输入框输入数字
- **THEN** 图形 x 坐标更新

#### Scenario: 输入 Y 坐标
- **WHEN** 用户在 Y 输入框输入数字
- **THEN** 图形 y 坐标更新

### Requirement: 尺寸属性编辑
SHALL 支持 W/H（矩形）或 Radius（圆形）编辑。

#### Scenario: 矩形显示 W/H
- **WHEN** 选中矩形
- **THEN** Properties Panel 显示 Width 和 Height 输入框

#### Scenario: 圆形显示 Radius
- **WHEN** 选中圆形
- **THEN** Properties Panel 显示 Radius 输入框

#### Scenario: 线条显示长度（只读）
- **WHEN** 选中线条
- **THEN** Properties Panel 显示 length（根据两点计算，只读）

### Requirement: 外观属性编辑
SHALL 支持 Fill color, Stroke color, Stroke Width 编辑。

#### Scenario: 修改填充色
- **WHEN** 用户在 Fill 颜色框选择颜色
- **THEN** 图形 fill 更新，支持颜色选择器或 HEX 输入

#### Scenario: 修改描边色
- **WHEN** 用户在 Stroke 颜色框选择颜色
- **THEN** 图形 stroke 更新

#### Scenario: 修改描边宽度
- **WHEN** 用户在 Stroke Width 输入数字
- **THEN** 图形 strokeWidth 更新

### Requirement: 透明度属性
SHALL 支持 Opacity 0-100% 滑块编辑。

#### Scenario: 调整透明度
- **WHEN** 用户拖动 Opacity 滑块或输入 0-100
- **THEN** 图形 opacity 更新（内部存 0-1）

### Requirement: 旋转属性
SHALL 支持 Rotation 度数输入。

#### Scenario: 输入旋转角度
- **WHEN** 用户在 Rotation 输入框输入度数
- **THEN** 图形 rotation 更新（正值=顺时针）

### Requirement: 图层顺序调整
SHALL 支持 Bring Forward / Send Backward 按钮。

#### Scenario: 上移图层
- **WHEN** 用户点击"上移"按钮
- **THEN** 该图形在 shapes 数组中后移一位（渲染顺序上移）

#### Scenario: 下移图层
- **WHEN** 用户点击"下移"按钮
- **THEN** 该图形在 shapes 数组中前移一位（渲染顺序下移）

### Requirement: 多选时显示批量操作
SHALL 在多选时显示共同属性并支持批量修改。

#### Scenario: 多选时显示共同属性
- **WHEN** 用户选中 2+ 个图形
- **THEN** Properties Panel 显示共同的属性（Fill/Stroke/Opacity 等），修改时批量应用

#### Scenario: 位置和尺寸显示"—"
- **WHEN** 多选时位置/尺寸不一致
- **THEN** X/Y/W/H 显示"—"，表示多个值

### Requirement: 无选中图形时隐藏
SHALL 在无选中图形时隐藏 Properties Panel 或显示空状态。

#### Scenario: 无选中时
- **WHEN** 用户点击画布空白区域取消选择
- **THEN** Properties Panel 隐藏或显示"选择图形以编辑属性"
