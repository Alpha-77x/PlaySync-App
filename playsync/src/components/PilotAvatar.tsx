import React from 'react';
import type { AvatarId } from '../utils/playerProfile';

interface PilotAvatarProps {
  avatarId: AvatarId;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
};

export const PilotAvatar: React.FC<PilotAvatarProps> = ({
  avatarId,
  color,
  size = 'md',
  className = '',
}) => {
  return (
    <div
      style={{
        borderColor: `${color}88`,
        backgroundColor: `${color}14`,
        boxShadow: `0 0 18px ${color}22`,
      }}
      className={`${SIZE_CLASSES[size]} rounded-2xl border flex items-center justify-center shrink-0 overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 40 40"
        className="w-[74%] h-[74%]"
        fill="none"
        aria-hidden="true"
      >
        {avatarId === 'apex-visor' && (
          <>
            <path d="M8 22C8 13.5 13.5 8 20 8C26.5 8 32 13.5 32 22V28L25 32H15L8 28V22Z" stroke={color} strokeWidth="2.2" />
            <path d="M11 19H29L26 24H14L11 19Z" fill={color} fillOpacity="0.85" />
            <path d="M16 12H24" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {avatarId === 'cyber-helm' && (
          <>
            <polygon points="20,6 32,14 30,29 20,34 10,29 8,14" stroke={color} strokeWidth="2.2" />
            <path d="M12 18L20 22L28 18" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="20" cy="14" r="2.3" fill={color} />
          </>
        )}
        {avatarId === 'cryo-fox' && (
          <>
            <path d="M9 11L15 16H25L31 11L29 25L20 33L11 25L9 11Z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M14 21L18 23M26 21L22 23" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <polygon points="20,25 22.5,28.5 17.5,28.5" fill={color} />
          </>
        )}
        {avatarId === 'rail-knight' && (
          <>
            <path d="M10 12L20 7L30 12V24L20 33L10 24V12Z" stroke={color} strokeWidth="2.2" />
            <path d="M14 17H26M20 12V28" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <rect x="16" y="19" width="8" height="3.5" rx="1" fill={color} />
          </>
        )}
        {avatarId === 'nova-spark' && (
          <>
            <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="2.2" />
            <path d="M20 9L23 17L31 20L23 23L20 31L17 23L9 20L17 17L20 9Z" fill={color} fillOpacity="0.9" />
            <circle cx="20" cy="20" r="2.5" fill="#000000" />
          </>
        )}
        {avatarId === 'orbit-crest' && (
          <>
            <circle cx="20" cy="20" r="7" fill={color} fillOpacity="0.85" />
            <ellipse cx="20" cy="20" rx="14" ry="5.5" transform="rotate(-25 20 20)" stroke="#ffffff" strokeWidth="2" />
            <ellipse cx="20" cy="20" rx="14" ry="5.5" transform="rotate(25 20 20)" stroke={color} strokeWidth="2" />
          </>
        )}
        {avatarId === 'drift-crown' && (
          <>
            <path d="M8 28L10 14L16 20L20 11L24 20L30 14L32 28H8Z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" fill={color} fillOpacity="0.28" />
            <path d="M10 31H30" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {avatarId === 'void-hawk' && (
          <>
            <path d="M7 16L20 9L33 16L26 22L20 32L14 22L7 16Z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M14 18L20 21L26 18" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="20" cy="14.5" r="2" fill={color} />
          </>
        )}
      </svg>
    </div>
  );
};
