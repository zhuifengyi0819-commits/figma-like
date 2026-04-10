import { useEffect, useRef, useState } from 'react';

export function useImage(src: string | undefined): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'error'] {
  const [image, setImage] = useState<HTMLImageElement>();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const prevSrc = useRef<string>(undefined);

  useEffect(() => {
    if (!src) { setImage(undefined); setStatus('loading'); return; }
    if (src === prevSrc.current && image) return;
    prevSrc.current = src;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => { setImage(img); setStatus('loaded'); };
    img.onerror = () => { setStatus('error'); };

    img.src = src;
    setStatus('loading');

    return () => { img.onload = null; img.onerror = null; };
  }, [src]);// eslint-disable-line react-hooks/exhaustive-deps

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
