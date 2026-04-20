# Delta for local-persistence

## ADDED Requirements

### Requirement: 图形数据本地持久化
SHALL 将 Shapes 数组保存到 localStorage。

#### Scenario: 图形创建/修改时自动保存
- **WHEN** shapes 数组发生任何变化（添加/移动/删除/属性修改）
- **THEN** 自动同步到 localStorage key `ai-canvas:shapes`

#### Scenario: 页面加载时恢复数据
- **WHEN** 用户打开页面
- **THEN** 从 localStorage 读取 `ai-canvas:shapes`，恢复到 Zustand store

#### Scenario: localStorage 无数据
- **WHEN** localStorage key 不存在或为空
- **THEN** 使用空数组初始化，显示空白画布

### Requirement: 聊天记录本地持久化
SHALL 将 ChatHistory 保存到 localStorage。

#### Scenario: 聊天消息自动保存
- **WHEN** 用户发送消息或 AI 返回响应
- **THEN** 完整 ChatHistory 数组保存到 localStorage key `ai-canvas:chat`

#### Scenario: 聊天历史限制
- **WHEN** ChatHistory 超过 50 条
- **THEN** 只保留最近 50 条消息

#### Scenario: 页面加载时恢复聊天
- **WHEN** 用户打开页面
- **THEN** 从 localStorage 读取 `ai-canvas:chat`，恢复到 ChatPanel

### Requirement: Ctrl+S 手动保存
SHALL 支持快捷键保存当前状态。

#### Scenario: Ctrl+S 保存
- **WHEN** 用户按 Ctrl/Cmd + S
- **THEN** 立即写入 localStorage，显示保存成功提示（StatusBar）

### Requirement: 画布缩放/平移状态不持久化
SHALL 每次打开页面时重置 zoom 和 pan 为默认值。

#### Scenario: 页面加载时重置视口
- **WHEN** 用户打开页面
- **THEN** zoom=1, pan={x:0, y:0}（画布居中显示）
