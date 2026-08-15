import { memo } from "react";
import { Smartphone, Package, type LucideIcon } from "lucide-react";
import { Avatar } from "@heroui/react";

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
  alt,
  size = "md",
  className = "",
  fallbackIcon: Icon,
}: BaseAvatarProps) {
  const { container, icon } = sizeConfig[size];

  return (
    <Avatar
      className={`${container} border border-divider bg-card shrink-0 ${className}`}
    >
      <Avatar.Image src={src || undefined} alt={alt} className="object-cover" />
      <Avatar.Fallback className="flex items-center justify-center bg-transparent">
        <Icon className={`${icon} text-foreground-subtle`} />
      </Avatar.Fallback>
    </Avatar>
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
