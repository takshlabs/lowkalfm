import type { ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

type MediaFrameVariant = "hero" | "editorial" | "record" | "mark";

type MediaFrameProps = Omit<ImageProps, "className"> & {
  variant?: MediaFrameVariant;
  frameClassName?: string;
  imageClassName?: string;
  caption?: ReactNode;
};

export function MediaFrame({
  variant = "editorial",
  frameClassName = "",
  imageClassName = "",
  caption,
  alt,
  ...imageProps
}: MediaFrameProps) {
  const decorative = alt === "";

  return (
    <figure className={`media-frame media-frame--${variant} ${frameClassName}`.trim()}>
      <div className="media-frame-mount">
        <Image
          {...imageProps}
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
