import type { ReactNode } from "react";
import Image, { type ImageProps } from "next/image";
import { sanityImageUrl } from "@/lib/sanity";

type MediaFrameVariant = "hero" | "editorial" | "record" | "mark";

type MediaFrameProps = Omit<ImageProps, "className"> & {
  variant?: MediaFrameVariant;
  frameClassName?: string;
  imageClassName?: string;
  caption?: ReactNode;
  sourceWidth?: number;
};

export function MediaFrame({
  variant = "editorial",
  frameClassName = "",
  imageClassName = "",
  caption,
  sourceWidth = 1200,
  alt,
  src,
  ...imageProps
}: MediaFrameProps) {
  const decorative = alt === "";
  const optimizedSrc = typeof src === "string" ? sanityImageUrl(src, sourceWidth) : src;

  return (
    <figure className={`media-frame media-frame--${variant} ${frameClassName}`.trim()}>
      <div className="media-frame-mount">
        <Image
          {...imageProps}
          src={optimizedSrc}
          alt={alt}
          className={`media-frame-image ${imageClassName}`.trim()}
        />
      </div>
      {caption ? <figcaption className="media-frame-caption">{caption}</figcaption> : null}
      <span className="media-frame-guard" aria-hidden="true" />
      {decorative ? null : <span className="sr-only">Artwork frame</span>}
    </figure>
  );
}
