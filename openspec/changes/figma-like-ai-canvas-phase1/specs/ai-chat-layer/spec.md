# Delta for ai-chat-layer

## ADDED Requirements

### Requirement: AI 对话面板可以发送消息
SHALL 支持用户在 ChatPanel 输入文字并发送给 LLM。

#### Scenario: 发送文本消息
- **WHEN** 用户在 ChatPanel 输入框输入文字并按 Enter
- **THEN** 消息显示在 ChatHistory（user 消息右侧），AI 返回响应（ai 消息左侧）

#### Scenario: 多行输入
- **WHEN** 用户输入多行文本
- **THEN** Shift+Enter 换行，Enter 发送

#### Scenario: 空消息不发送
- **WHEN** 用户输入空消息或仅空格
- **THEN** 不发送，提示输入内容

### Requirement: AI 理解"画图"意图并调用 add_shapes
SHALL 识别用户的画图指令并通过 Function Calling 返回 shapes。

#### Scenario: AI 解析"画一个XX"
- **WHEN** 用户说"在画布中央画一个红色的圆形，半径50"
- **THEN** AI 理解意图，调用 add_shapes tool，传入 shapes=[{type:"circle", x:960, y:540, radius:50, fill:"red"}]

#### Scenario: AI 解析"帮我画个矩形"
- **WHEN** 用户说"在左上角画一个 200x100 的矩形"
- **THEN** AI 调用 add_shapes tool，生成对应矩形

#### Scenario: AI 无法理解画图指令
- **WHEN** 用户说的话题与画布无关
- **THEN** AI 正常回复，不调用 tool

### Requirement: add_shapes tool 正确执行
SHALL 当 AI 返回 add_shapes tool call 时正确添加图形到画布。

#### Scenario: 工具调用成功
- **WHEN** AI 返回 add_shapes tool call，shapes 数组有效
- **THEN** 每个 shape 添加到 Zustand store，画布立即渲染，系统返回 "已添加 N 个图形"

#### Scenario: 工具调用参数无效
- **WHEN** AI 返回的 shapes 包含无效参数（如缺少 type/x/y）
- **THEN** 系统返回错误 "图形参数不完整"，消息不添加到画布

#### Scenario: 工具调用后 AI 显示结果
- **WHEN** add_shapes 执行完成
- **THEN** AI 消息中显示 "✅ 已添加 [图形类型] 到画布" 并描述图形属性

### Requirement: AI 始终知道 Canvas 上下文
SHALL 每次对话都向 AI 传递 Canvas size 和当前选中图形信息。

#### Scenario: AI 获取 Canvas 上下文
- **WHEN** 用户发送任何消息
- **THEN** System Prompt 包含：Canvas size=1920×1080，当前 shapes 数量，选中图形（如有）

#### Scenario: AI 理解相对位置描述
- **WHEN** 用户说"在这个圆形旁边画一个矩形"
- **THEN** AI 知道选中的是一个圆形，能计算出相对位置

### Requirement: 快捷命令支持
SHALL 支持内置快捷命令提升体验。

#### Scenario: /clear 清空画布
- **WHEN** 用户输入 "/clear"
- **THEN** 清空所有 shapes，显示 "画布已清空"

#### Scenario: /undo 撤销
- **WHEN** 用户输入 "/undo"
- **THEN** 撤销最后一次操作（shapes 变化）

#### Scenario: 未知快捷命令
- **WHEN** 用户输入未知快捷命令（如 "/foo"）
- **THEN** AI 回复"未知命令，可用：/clear 清空画布"
