'use client';

import { useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Variable } from '@/lib/types';
import { Plus, Trash2, X, ChevronDown } from 'lucide-react';

interface VariablePickerProps {
  value?: string; // variable id
  onChange: (variableId: string) => void;
  excludeIds?: string[]; // for setVariable action: exclude the variable being set
  className?: string;
}

function VariableBadge({ variable, onDelete }: { variable: Variable; onDelete?: () => void }) {
  const typeColors: Record<string, string> = {
    string: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    number: 'bg-green-500/20 text-green-400 border-green-500/30',
    boolean: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const colorClass = typeColors[variable.type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${colorClass}`}>
      {variable.name}
      {variable.type !== 'boolean' && (
        <span className="opacity-60 text-[9px]">({variable.type})</span>
      )}
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="ml-0.5 hover:opacity-80">
          <X size={9} />
        </button>
      )}
    </span>
  );
}

export default function VariablePicker({ value, onChange, excludeIds = [], className = '' }: VariablePickerProps) {
  const { variables, addVariable, updateVariable, deleteVariable, getVariableValue } = useEditorStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'string' | 'number' | 'boolean'>('string');
  const [newDefault, setNewDefault] = useState('');

  const selectedVar = variables.find(v => v.id === value);
  const availableVars = variables.filter(v => !excludeIds.includes(v.id));

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    let defaultVal: string | number | boolean = newDefault;
    if (newType === 'number') defaultVal = parseFloat(newDefault) || 0;
    else if (newType === 'boolean') defaultVal = newDefault === 'true';
    const id = addVariable(newName.trim(), newType, defaultVal);
    onChange(id);
    setIsCreating(false);
    setIsOpen(false);
    setNewName('');
    setNewDefault('');
    setNewType('string');
  }, [newName, newType, newDefault, addVariable, onChange]);

  const handleDelete = useCallback((id: string) => {
    if (value === id) onChange('');
    deleteVariable(id);
  }, [value, onChange, deleteVariable]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent)] transition-colors text-[11px] text-[var(--text-primary)]"
      >
        {selectedVar ? (
          <VariableBadge variable={selectedVar} />
        ) : (
          <span className="text-[var(--text-tertiary)]">选择变量…</span>
        )}
        <ChevronDown size={11} className="text-[var(--text-tertiary)] flex-shrink-0 ml-1" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setIsCreating(false); }} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
            {/* Existing variables list */}
            <div className="max-h-48 overflow-y-auto">
              {availableVars.length === 0 && !isCreating ? (
                <div className="px-3 py-4 text-center text-[11px] text-[var(--text-tertiary)]">
                  暂无变量，点击下方创建
                </div>
              ) : (
                availableVars.map(v => (
                  <div key={v.id} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors">
                    <input
                      type="radio"
                      checked={v.id === value}
                      onChange={() => { onChange(v.id); setIsOpen(false); }}
                      className="accent-[var(--accent)]"
                    />
                    <div className="flex-1 min-w-0" onClick={() => { onChange(v.id); setIsOpen(false); }}>
                      <VariableBadge variable={v} />
                      <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">
                        = {String(getVariableValue(v.id) ?? v.defaultValue)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--danger)] hover:opacity-80 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Create new variable */}
            {isCreating ? (
              <div className="border-t border-[var(--border)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }}
                    placeholder="变量名称"
                    className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as 'string' | 'number' | 'boolean')}
                    className="bg-[var(--bg-deep)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <input
                    value={newDefault}
                    onChange={e => setNewDefault(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }}
                    placeholder={`默认值 (${newType})`}
                    className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreate} className="flex-1 py-1 rounded bg-[var(--accent)] text-white text-[11px] font-medium hover:opacity-90">
                    创建
                  </button>
                  <button onClick={() => setIsCreating(false)} className="px-3 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] text-[11px] hover:bg-[var(--bg-hover)]">
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] text-[11px] text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Plus size={11} />
                新建变量
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
