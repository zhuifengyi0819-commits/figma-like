'use client';

import { useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { getTemplatesByLibrary } from '@/lib/componentTemplates';
import { ComponentTemplate } from '@/lib/types';
import { Search, Image as ImageIcon } from 'lucide-react';
import { fileToDataUrl, getImageDimensions } from '@/lib/hooks';
import { v4 as uuid } from 'uuid';

const libraries = [
  { id: 'antd' as const, label: 'Ant Design' },
  { id: 'element' as const, label: 'Element Plus' },
  { id: 'layout' as const, label: '布局模板' },
] as const;

export default function ComponentLibrary() {
  const { addShape, setSelectedIds, setActiveTool } = useEditorStore();
  const [activeLib, setActiveLib] = useState<'antd' | 'element' | 'layout'>('antd');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const items = getTemplatesByLibrary(activeLib);
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [activeLib, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ComponentTemplate[]>();
    filtered.forEach(t => {
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    });
    return map;
  }, [filtered]);

  const handleAddComponent = useCallback((template: ComponentTemplate) => {
    const groupId = uuid();
    const baseX = 200 + Math.random() * 400;
    const baseY = 200 + Math.random() * 200;
    const newIds: string[] = [];

    for (const shapeDef of template.shapes) {
      const id = addShape({
        ...shapeDef,
        x: baseX + shapeDef.x,
        y: baseY + shapeDef.y,
        visible: true,
        locked: false,
        name: `${template.name}`,
        groupId,
        componentId: template.id,
      });
      newIds.push(id);
    }

    if (newIds.length > 0) {
      setSelectedIds(newIds);
      setActiveTool('select');
    }
  }, [addShape, setSelectedIds, setActiveTool]);

  const handleImportImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const dataUrl = await fileToDataUrl(file);
        const dims = await getImageDimensions(dataUrl);
        let w = dims.width; let h = dims.height;
        if (w > 600) { h = h * (600 / w); w = 600; }
        if (h > 400) { w = w * (400 / h); h = 400; }
        const id = addShape({
          type: 'image', x: 200, y: 200, width: w, height: h, src: dataUrl,
          fill: 'transparent', stroke: 'transparent', strokeWidth: 0,
          opacity: 1, rotation: 0, visible: true, locked: false, name: file.name,
        });
        setSelectedIds([id]);
      }
      setActiveTool('select');
    };
    input.click();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-[var(--border)]">
        {libraries.map(lib => (
          <button
            key={lib.id}
            onClick={() => setActiveLib(lib.id)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors border-b-2 ${
              activeLib === lib.id
                ? 'text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
            }`}
          >
            {lib.label}
          </button>
        ))}
      </div>

      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-2 py-1.5">
          <Search size={14} className="text-[var(--text-tertiary)]" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索组件..." className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
          />
        </div>
      </div>

      <div className="px-3 pb-2">
        <button onClick={handleImportImage} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs">
          <ImageIcon size={14} />
          导入图片
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="mb-4">
            <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{category}</h3>
            <div className="space-y-1.5">
              {items.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleAddComponent(template)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all text-left group"
                  title={`${template.name} — ${template.shapes.length} 个元素`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors font-medium">{template.name}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)] ml-2">{template.shapes.length} 个图形</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{template.width}×{template.height}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-tertiary)]">没有找到组件</p>
          </div>
        )}
      </div>
    </div>
  );
}
