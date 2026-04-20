import { useEffect, useRef, useState } from 'react';

export function useImage(src: string | undefined): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'error'] {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const srcRef = useRef<string | undefined>(undefined);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      srcRef.current = src;
      return;
    }

    // Skip if src unchanged and we already have an image
    if (src === srcRef.current && imgRef.current) return;
    srcRef.current = src;

    // Abort previous image if any
    if (imgRef.current) {
      imgRef.current.onload = null;
      imgRef.current.onerror = null;
    }

    const img = new window.Image();
    imgRef.current = img;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImage(img);
      setStatus('loaded');
    };
    img.onerror = () => {
      setStatus('error');
      imgRef.current = null;
    };

    img.src = src;
    // Intentionally: do NOT setStatus('loading') here — only async callbacks update state

    return () => {
      img.onload = null;
      img.onerror = null;
    };
    // image is intentionally omitted: we never read it in this effect
     
  }, [src]);

  return [image, status];
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}
