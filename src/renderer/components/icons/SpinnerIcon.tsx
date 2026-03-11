import React from 'react';

interface SpinnerIconProps extends React.SVGProps<SVGSVGElement> {
  strokeWidth?: number;
}

const SpinnerIcon: React.FC<SpinnerIconProps> = ({
  className,
  strokeWidth = 4,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className="opacity-25"
    />
    <path
      d="M4 12a8 8 0 0 1 8-8"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className="opacity-75"
    />
  </svg>
);

export default SpinnerIcon;
