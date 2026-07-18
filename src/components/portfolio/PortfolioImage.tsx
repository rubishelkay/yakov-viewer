"use client";

import { LoaderCircle } from "lucide-react";
import type { ImgHTMLAttributes } from "react";
import { useCallback, useState } from "react";

type PortfolioImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  wrapperClassName?: string;
};

export function PortfolioImage({
  alt = "",
  className,
  onError,
  onLoad,
  wrapperClassName,
  ...props
}: PortfolioImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const wrapperClasses = ["portfolio-image", wrapperClassName].filter(Boolean).join(" ");
  const connectImage = useCallback((image: HTMLImageElement | null) => {
    if (!image?.complete) return;
    queueMicrotask(() => setState(image.naturalWidth > 0 ? "loaded" : "error"));
  }, []);

  return (
    <span aria-busy={state === "loading"} className={wrapperClasses} data-image-state={state}>
      {state === "loading" ? (
        <span aria-hidden className="portfolio-image__loader">
          <LoaderCircle />
        </span>
      ) : null}
      <img
        {...props}
        alt={alt}
        className={className}
        onError={(event) => {
          setState("error");
          onError?.(event);
        }}
        onLoad={(event) => {
          setState("loaded");
          onLoad?.(event);
        }}
        ref={connectImage}
      />
    </span>
  );
}
