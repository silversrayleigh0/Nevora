type IconProps = { size?: number; className?: string };

const base = (size: number) => ({ width: size, height: size, "aria-hidden": true as const });

export const CheckIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 16 16" className={className}>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const UploadIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ShieldIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const FileIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <path d="M7 3h7l5 5v13H7zM14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const AwardIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="9" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9 13.5L8 21l4-2 4 2-1-7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const InfoIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const PencilIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 16 16" className={className}>
    <path d="M10.5 2.5l3 3L6 13H3v-3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const CloseIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 16 16" className={className}>
    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const GoogleIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export const Spinner = ({ size = 16 }: { size?: number }) => (
  <span
    className="spin inline-block rounded-full border-2 border-current border-r-transparent"
    style={{ width: size, height: size }}
    aria-hidden="true"
  />
);
