'use client';

import { useEffect, useCallback } from 'react';

interface BackdropProps {
  visible: boolean;
  color?: string;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export default function Backdrop({ visible, color = 'rgba(0,0,0,0.5)', onClick, onKeyDown }: BackdropProps) {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onKeyDown?.(e);
    }
  }, [onKeyDown]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[900] animate-backdrop-in"
      style={{ backgroundColor: color }}
      onClick={handleClick}
      aria-label="关闭叠加层"
    />
  );
}
