import { memo, useState } from "react";
import { Smartphone, Package, type LucideIcon } from "lucide-react";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeConfig: Record<AvatarSize, { container: string; icon: string }> = {
  sm: { container: "size-6 rounded-md", icon: "size-3" },
  md: { container: "size-10 rounded-xl", icon: "size-5" },
  lg: { container: "size-14 rounded-2xl", icon: "size-8" },
};

interface BaseAvatarProps extends AvatarProps {
  fallbackIcon: LucideIcon;
}

const BaseAvatar = memo(function BaseAvatar({
  src,
  alt = "",
  size = "md",
  className = "",
  fallbackIcon: Icon,
}: BaseAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const { container, icon } = sizeConfig[size];

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className={`${container} border border-divider bg-card object-cover shrink-0 ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={`${container} border border-divider bg-card flex items-center justify-center shrink-0 ${className}`}
      aria-label={alt}
    >
      <Icon className={`${icon} text-foreground-subtle`} />
    </div>
  );
});

export const AppAvatar = memo(function AppAvatar({
  alt = "App",
  ...props
}: AvatarProps) {
  return <BaseAvatar alt={alt} fallbackIcon={Smartphone} {...props} />;
});

export const BundleAvatar = memo(function BundleAvatar({
  alt = "Bundle",
  ...props
}: AvatarProps) {
  return <BaseAvatar alt={alt} fallbackIcon={Package} {...props} />;
});
