/** A product screenshot in a browser frame, matching the visitor's colour scheme. */
export default function Screenshot({ name, alt, width = 1600, height, priority = false, url = "productroot.agarwal-aman041.workers.dev" }: { name: string; alt: string; width?: number; height: number; priority?: boolean; url?: string }) {
  return (
    <figure className="shot">
      <div className="shot-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{url}</span>
      </div>
      <picture>
        <source srcSet={`/landing/${name}-dark.jpg`} media="(prefers-color-scheme: dark)" />
        <img src={`/landing/${name}-light.jpg`} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" />
      </picture>
    </figure>
  );
}
