'use client';

import { useCallback } from 'react';
import { ActiveOverlay, Shape } from '@/lib/types';
import OverlayPanel from './OverlayPanel';

interface OverlayPortalProps {
  overlays: ActiveOverlay[];
  allShapes: Shape[];
  onClose: (overlayId: string) => void;
}

export default function OverlayPortal({ overlays, allShapes, onClose }: OverlayPortalProps) {
  const handleClose = useCallback((overlayId: string) => {
    onClose(overlayId);
  }, [onClose]);

  return (
    <>
      {overlays.map(overlay => {
        const targetFrame = allShapes.find(s => s.id === overlay.targetFrameId);
        if (!targetFrame) return null;

        return (
          <OverlayPanel
            key={overlay.id}
            targetFrame={targetFrame}
            allShapes={allShapes}
            config={overlay.config}
            triggerRect={null} // triggerRect not available from DOM in this context
            visible={true}
            onClose={() => handleClose(overlay.id)}
          />
        );
      })}
    </>
  );
}
