// lib/history/HistoryManager.ts
// Command Pattern based undo/redo system.
// Supports: Move, Delete, Create, Resize, Rotate, Group, Reorder, PropertyChange.

import type { SceneGraph } from '@/lib/scene-graph';

export interface Command {
  id: string;
  name: string;            // display name for undo menu
  execute(): void;
  undo(): void;
  /** If true, this command can be merged with the previous same-type command */
  mergeable?: boolean;
  /** For mergeable commands: timestamp of last execution */
  timestamp?: number;
}

/** How many commands to keep in history */
const MAX_HISTORY = 100;

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private sceneGraph: SceneGraph;
  private isExecuting = false;
  private lastCommand: Command | null = null;

  constructor(sceneGraph: SceneGraph) {
    this.sceneGraph = sceneGraph;
  }

  // ============================================================
  // Execute / Undo / Redo
  // ============================================================

  execute(command: Command): void {
    if (this.isExecuting) return;
    this.isExecuting = true;

    // Merge with last command if mergeable and recent (< 500ms)
    if (
      this.lastCommand &&
      command.mergeable &&
      this.lastCommand.constructor === command.constructor &&
      this.lastCommand.timestamp !== undefined &&
      Date.now() - this.lastCommand.timestamp < 500
    ) {
      // Merge: just update timestamp, no new stack entry
      command.timestamp = Date.now();
      this.lastCommand = command;
      this.isExecuting = false;
      return;
    }

    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // clear redo on new action
    this.lastCommand = command;

    // Trim history
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }

    this.isExecuting = false;
  }

  undo(): Command | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    this.isExecuting = true;
    command.undo();
    this.redoStack.push(command);
    this.isExecuting = false;
    return command;
  }

  redo(): Command | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    this.isExecuting = true;
    command.execute();
    this.undoStack.push(command);
    this.isExecuting = false;
    return command;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  // ============================================================
  // Built-in Commands
  // ============================================================

  /** Command: move one or more nodes by delta */
  moveCommand(
    nodeIds: string[],
    dx: number,
    dy: number,
    name = 'Move'
  ): Command {
    const snapshots = new Map<string, { x: number; y: number }>();
    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) snapshots.set(id, { x: node.x, y: node.y });
    }

    return {
      id: `move-${Date.now()}`,
      name,
      mergeable: true,
      timestamp: Date.now(),
      execute: () => {
        for (const id of nodeIds) {
          const node = this.sceneGraph.getNode(id);
          if (!node) continue;
          this.sceneGraph.updateNode(id, { x: node.x + dx, y: node.y + dy });
        }
      },
      undo: () => {
        for (const [id, snap] of snapshots) {
          this.sceneGraph.updateNode(id, { x: snap.x, y: snap.y });
        }
      },
    };
  }

  /** Command: delete nodes */
  deleteCommand(nodeIds: string[], name = 'Delete'): Command {
    type NodeSnapshot = {
      parentId: string | null;
      index: number;
      data: Record<string, unknown>;
    };
    const snapshots = new Map<string, NodeSnapshot>();

    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node) continue;
      const parentId = node.parentId;
      const index = this.sceneGraph.getIndexInParent(id);
      const data = { ...node } as Record<string, unknown>;
      snapshots.set(id, { parentId, index, data });
    }

    return {
      id: `delete-${Date.now()}`,
      name,
      execute: () => {
        for (const id of nodeIds) {
          this.sceneGraph.removeNode(id);
        }
      },
      undo: () => {
        // Restore in reverse order of deletion to preserve indices
        const sorted = [...snapshots.entries()].sort((a, b) => a[1].index - b[1].index);
        for (const [id, snap] of sorted) {
          if (snap.parentId) {
            this.sceneGraph.addNode(snap.data as any, snap.parentId, snap.index);
          }
        }
      },
    };
  }

  /** Command: resize/rotate a node */
  transformCommand(
    nodeId: string,
    before: { x: number; y: number; width: number; height: number; rotation: number },
    after: { x: number; y: number; width: number; height: number; rotation: number },
    name = 'Transform'
  ): Command {
    return {
      id: `transform-${Date.now()}`,
      name,
      mergeable: true,
      timestamp: Date.now(),
      execute: () => {
        this.sceneGraph.updateNode(nodeId, after);
      },
      undo: () => {
        this.sceneGraph.updateNode(nodeId, before);
      },
    };
  }

  /** Command: reorder node */
  reorderCommand(
    nodeId: string,
    fromIndex: number,
    toIndex: number,
    name = 'Reorder'
  ): Command {
    return {
      id: `reorder-${Date.now()}`,
      name,
      execute: () => {
        this.sceneGraph.reorderNode(nodeId, toIndex);
      },
      undo: () => {
        this.sceneGraph.reorderNode(nodeId, fromIndex);
      },
    };
  }

  /** Command: duplicate nodes (Alt+Drag) */
  duplicateCommand(
    sourceIds: string[],
    newIdMap: Map<string, string>,
    parentId: string,
    name = 'Duplicate'
  ): Command {
    // Snapshot source nodes
    const sourceSnapshots = new Map<string, Record<string, unknown>>();
    for (const id of sourceIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) sourceSnapshots.set(id, { ...node } as Record<string, unknown>);
    }

    return {
      id: `duplicate-${Date.now()}`,
      name,
      execute: () => {
        for (const [srcId, newId] of newIdMap) {
          const src = sourceSnapshots.get(srcId);
          if (!src) continue;
          const dup = { ...src, id: newId } as any;
          this.sceneGraph.addNode(dup, parentId);
        }
      },
      undo: () => {
        for (const newId of newIdMap.values()) {
          this.sceneGraph.removeNode(newId);
        }
      },
    };
  }

  /** Command: group nodes */
  groupCommand(
    nodeIds: string[],
    groupId: string,
    parentId: string,
    name = 'Group'
  ): Command {
    const originalParents = new Map<string, { parentId: string; index: number }>();
    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) {
        originalParents.set(id, { parentId: node.parentId || parentId, index: this.sceneGraph.getIndexInParent(id) });
      }
    }

    return {
      id: `group-${Date.now()}`,
      name,
      execute: () => {
        const groupData = {
          id: groupId,
          type: 'group' as const,
          name: 'Group',
          parentId,
          children: nodeIds,
          x: 0, y: 0, width: 0, height: 0,
          rotation: 0,
          visible: true, locked: false,
        };
        this.sceneGraph.addNode(groupData as any, parentId);

        for (const id of nodeIds) {
          this.sceneGraph.updateNode(id, { parentId: groupId });
        }
      },
      undo: () => {
        for (const id of nodeIds) {
          const orig = originalParents.get(id);
          if (orig) {
            this.sceneGraph.updateNode(id, { parentId: orig.parentId });
            this.sceneGraph.reorderNode(id, orig.index);
          }
        }
        this.sceneGraph.removeNode(groupId);
      },
    };
  }

  /** Command: ungroup (dissolve group) */
  ungroupCommand(
    groupId: string,
    childrenIds: string[],
    parentId: string,
    groupIndex: number,
    name = 'Ungroup'
  ): Command {
    return {
      id: `ungroup-${Date.now()}`,
      name,
      execute: () => {
        for (const childId of childrenIds) {
          this.sceneGraph.updateNode(childId, { parentId });
          this.sceneGraph.reorderNode(childId, groupIndex);
        }
        this.sceneGraph.removeNode(groupId);
      },
      undo: () => {
        const groupData = {
          id: groupId,
          type: 'group' as const,
          name: 'Group',
          parentId,
          children: childrenIds,
          x: 0, y: 0, width: 0, height: 0,
          rotation: 0,
          visible: true, locked: false,
        } as any;
        this.sceneGraph.addNode(groupData, parentId, groupIndex);
        for (const childId of childrenIds) {
          this.sceneGraph.updateNode(childId, { parentId: groupId });
        }
      },
    };
  }

  /** Command: change a node property */
  propertyCommand<K extends keyof any>(
    nodeId: string,
    key: K,
    beforeValue: any,
    afterValue: any,
    name = 'Change Property'
  ): Command {
    return {
      id: `property-${Date.now()}`,
      name,
      mergeable: true,
      timestamp: Date.now(),
      execute: () => {
        this.sceneGraph.updateNode(nodeId, { [key]: afterValue } as any);
      },
      undo: () => {
        this.sceneGraph.updateNode(nodeId, { [key]: beforeValue } as any);
      },
    };
  }
}
