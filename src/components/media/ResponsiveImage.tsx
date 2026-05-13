import type { CSSProperties, ImgHTMLAttributes } from "react";

import type { Photo } from "@/content/schema";
import { getResponsiveImageAttrs, type ImagePreset } from "@/lib/images";

type ResponsiveImageProps = {
  photo: Photo;
  preset: ImagePreset;
  sizes: string;
  priority?: boolean;
  className?: string;
} & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "width" | "height" | "sizes" | "loading" | "alt"
>;

export function ResponsiveImage({
  photo,
  preset,
  sizes,
  priority = false,
  className,
  style,
  ...props
}: ResponsiveImageProps) {
  const attrs = getResponsiveImageAttrs(photo, preset);
  const imageStyle: CSSProperties = {
    ...attrs.style,
    ...style
  };

  return (
    <img
      {...props}
      className={className}
      src={attrs.src}
      srcSet={attrs.srcSet}
      sizes={sizes}
      width={attrs.width}
      height={attrs.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      style={imageStyle}
    />
  );
}
