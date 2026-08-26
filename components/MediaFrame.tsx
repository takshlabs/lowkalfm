import type { ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

type MediaFrameVariant = "hero" | "editorial" | "record" | "mark" | "fill";

type MediaFrameProps = Omit<ImageProps, "className"> & {
  variant?: MediaFrameVariant;
  frameClassName?: string;
  imageClassName?: string;
  caption?: ReactNode;
};

/**
 * A Lowkal image is never left sitting raw on the page. Every image passes
 * through this frame, so each one carries the same mount, crop, and offset
 * rule.
 *
 * Use variant="fill" when the frame must stretch to a positioned parent, such
 * as a hero panel or a card that already owns its aspect ratio.
 */
export function MediaFrame({
  variant = "editorial",
  frameClassName = "",
  imageClassName = "",
  caption,
  alt,
  ...imageProps
}: MediaFrameProps) {
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
    </figure>
  );
}
