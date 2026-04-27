type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

const radiusMap: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full"
};

export default function Skeleton({
  className = "",
  width,
  height,
  rounded = "md"
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      aria-hidden
      className={`skeleton ${radiusMap[rounded]} ${className}`}
      style={style}
    />
  );
}

export function SkeletonText({
  width = "100%",
  height = 12,
  className = ""
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return <Skeleton width={width} height={height} rounded="md" className={className} />;
}
