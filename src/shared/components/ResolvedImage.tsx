import React, { useEffect, useState } from 'react';
import { isLocalImageRef, resolveLocalImageSource } from '../utils/localImageStore';

type ResolvedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
};

const ResolvedImage: React.FC<ResolvedImageProps> = ({ alt = '', src, ...props }) => {
  const [resolvedSrc, setResolvedSrc] = useState(() => (isLocalImageRef(src) ? '' : src || ''));

  useEffect(() => {
    let isCurrent = true;

    setResolvedSrc(isLocalImageRef(src) ? '' : src || '');
    void resolveLocalImageSource(src)
      .then((nextSrc) => {
        if (isCurrent) {
          setResolvedSrc(nextSrc);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setResolvedSrc('');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [src]);

  return <img {...props} src={resolvedSrc} alt={alt} />;
};

export default ResolvedImage;
