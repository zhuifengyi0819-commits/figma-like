# Proposal: figma-like-ai-canvas-phase1

## Why

做一个"边聊边画"的 Figma-like 画布工具。核心差异化在于：不是用工具画图，而是用自然语言描述，AI 帮你生成和修改图形。解决传统设计工具"操作复杂、门槛高"的问题——你只需要"帮我在这个位置画一个蓝色的圆"。

当前项目已有：
- SPEC.md 完整设计规范（Warm Industrial Workshop 美学）
- Next.js + Konva + Zustand + Tailwind 技术骨架
- 基础组件目录结构

**Phase 1 目标**：完成核心画布编辑 + AI 对话生成图形，让"边聊边画"真正可用。

## What Changes

Phase 1 完成以下核心能力：

1. **画布引擎**：支持矩形/圆形/文字/线条的创建、选择、移动、缩放、删除
2. **AI 对话层**：LLM Function Calling，将"画一个XX"翻译为图形并渲染到画布
3. **图层面板**：左侧图层列表，支持选择/可见性/锁定/删除
4. **属性面板**：右侧属性编辑（位置/尺寸/颜色/透明度/旋转）
5. **持久化**：Shapes + ChatHistory 本地存储

## Capabilities

### New Capabilities
- `canvas-editing`: 画布基础编辑（创建/选择/变换/删除图形）
- `ai-chat-layer`: AI 对话生成图形（Function Calling Schema）
- `layer-panel`: 图层面板管理
- `properties-panel`: 属性编辑面板
- `local-persistence`: 本地存储持久化

### Modified Capabilities
-（空，此为全新项目）

## Impact

- 新增 AI 集成模块（LLM API 调用）
- Konva 画布渲染层
- Zustand Store 扩展（shapes/selection/chat）
- 4个主要 UI 组件区域

## Context

项目定位：个人 AI 画布工具，强调"warm workshop"美学和自然语言交互。

当前状态：技术骨架已搭建，SPEC.md 定义清晰，CLAUDE.md 定义了 AI 角色。缺少真正的业务代码实现。

## Goals / Non-Goals

**Goals:**
- 画布支持 4 种基础图形（rect/circle/text/line）
- AI 聊天能理解"画一个XX"并正确生成图形
- 图层和属性面板完整可用
- 数据本地持久化（localStorage）

**Non-Goals:**
- 不做多人协作/实时同步
- 不做文件导入/导出（PNG/SVG 等）
- 不做组件库/素材库
- 不做 authentication 用户系统

## Decisions

1. **Canvas Library**: 使用 `react-konva`（已选型，SPEC.md 确定）
2. **AI Provider**: MiniMax API（项目中已配）
3. **Function Calling**: AI 输出 JSON shapes 数组，通过 `add_shapes` tool 回调
4. **State Management**: Zustand（已选型）
5. **Styling**: Tailwind + CSS Variables（已选型）

## Risks / Trade-offs

- AI 生成图形的坐标理解可能不准（需要明确的 Canvas size context）
- Konva 与 React 18+ 并发模式可能的兼容问题
- localStorage 容量限制（大量图形时）
