type FcLogoAvatarProps = {
  size?: number;
};

export function FcLogoAvatar({
  size = 40,
}: FcLogoAvatarProps) {
  return (
    <div
      aria-label="FieldsConnect logo"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white p-1"
      style={{ height: size, width: size }}
    >
      <img
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
        src="/icons/fc-logo.png"
      />
    </div>
  );
}