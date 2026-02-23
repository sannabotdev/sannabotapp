/**
 * SannaAvatar – Cute blue-haired anime girl avatar for the Sanna AI assistant.
 * Pure SVG, no external image assets needed.
 */
import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';

interface SannaAvatarProps {
  /** Width & height of the avatar (square) */
  size?: number;
}

export function SannaAvatar({ size = 48 }: SannaAvatarProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        {/* Hair gradient – rich blue */}
        <LinearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#5B9CFF" />
          <Stop offset="100%" stopColor="#2D5FD6" />
        </LinearGradient>

        {/* Skin gradient */}
        <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFE0C2" />
          <Stop offset="100%" stopColor="#FCCBA0" />
        </LinearGradient>

        {/* Background gradient */}
        <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#1C1C2E" />
          <Stop offset="100%" stopColor="#2A2A40" />
        </LinearGradient>
      </Defs>

      {/* Background circle */}
      <Circle cx="60" cy="60" r="58" fill="url(#bgGrad)" />
      <Circle cx="60" cy="60" r="58" fill="none" stroke="#5B9CFF" strokeWidth="2" opacity="0.5" />

      {/* ── Neck / Body hint ── */}
      <Rect x="50" y="90" width="20" height="14" rx="4" fill="url(#skinGrad)" />
      {/* Shoulders / collar */}
      <Path
        d="M30 115 Q30 98 50 95 L70 95 Q90 98 90 115"
        fill="#4A7CFF"
      />
      {/* Collar detail */}
      <Path
        d="M50 95 L60 105 L70 95"
        fill="none"
        stroke="#FFE0C2"
        strokeWidth="1.5"
      />

      {/* ── Hair back (behind head) ── */}
      <Path
        d="M25 55 Q20 45 22 35 Q25 20 40 14 Q50 8 60 8 Q70 8 80 14 Q95 20 98 35 Q100 45 95 55 Q98 70 95 85 Q92 95 85 95 L80 80 Q78 70 77 60 L43 60 Q42 70 40 80 L35 95 Q28 95 25 85 Q22 70 25 55 Z"
        fill="url(#hairGrad)"
      />

      {/* ── Face ── */}
      <Ellipse cx="60" cy="58" rx="25" ry="28" fill="url(#skinGrad)" />

      {/* ── Bangs (front hair) ── */}
      {/* Left side bangs */}
      <Path
        d="M35 50 Q34 38 38 28 Q42 22 48 20 Q44 30 42 40 Q40 48 38 52 Z"
        fill="url(#hairGrad)"
      />
      {/* Center-left bang */}
      <Path
        d="M42 46 Q40 34 44 24 Q48 18 54 16 Q50 26 48 36 Q46 42 44 48 Z"
        fill="url(#hairGrad)"
      />
      {/* Center bang */}
      <Path
        d="M49 44 Q48 32 52 22 Q56 14 60 12 Q64 14 68 22 Q72 32 71 44 Q66 38 60 36 Q54 38 49 44 Z"
        fill="url(#hairGrad)"
      />
      {/* Center-right bang */}
      <Path
        d="M76 46 Q78 34 76 24 Q72 18 66 16 Q70 26 72 36 Q74 42 76 48 Z"
        fill="url(#hairGrad)"
      />
      {/* Right side bangs */}
      <Path
        d="M85 50 Q86 38 82 28 Q78 22 72 20 Q76 30 78 40 Q80 48 82 52 Z"
        fill="url(#hairGrad)"
      />

      {/* Hair top arc – makes the top of hair smooth */}
      <Path
        d="M30 45 Q28 28 40 16 Q50 8 60 8 Q70 8 80 16 Q92 28 90 45"
        fill="url(#hairGrad)"
      />

      {/* ── Side hair strands ── */}
      <Path
        d="M35 55 Q30 60 28 70 Q26 80 30 88 Q32 82 33 74 Q34 66 35 58 Z"
        fill="url(#hairGrad)"
      />
      <Path
        d="M85 55 Q90 60 92 70 Q94 80 90 88 Q88 82 87 74 Q86 66 85 58 Z"
        fill="url(#hairGrad)"
      />

      {/* ── Eyes ── */}
      {/* Left eye white */}
      <Ellipse cx="49" cy="56" rx="7" ry="8" fill="white" />
      {/* Left eye iris */}
      <Ellipse cx="49" cy="57" rx="5" ry="6" fill="#4A7CFF" />
      {/* Left eye pupil */}
      <Circle cx="49" cy="57" r="2.8" fill="#1C1C2E" />
      {/* Left eye highlight */}
      <Circle cx="47" cy="55" r="1.8" fill="white" opacity="0.9" />
      <Circle cx="51" cy="59" r="1" fill="white" opacity="0.5" />

      {/* Right eye white */}
      <Ellipse cx="71" cy="56" rx="7" ry="8" fill="white" />
      {/* Right eye iris */}
      <Ellipse cx="71" cy="57" rx="5" ry="6" fill="#4A7CFF" />
      {/* Right eye pupil */}
      <Circle cx="71" cy="57" r="2.8" fill="#1C1C2E" />
      {/* Right eye highlight */}
      <Circle cx="69" cy="55" r="1.8" fill="white" opacity="0.9" />
      <Circle cx="73" cy="59" r="1" fill="white" opacity="0.5" />

      {/* ── Eyebrows ── */}
      <Path d="M42 47 Q49 44 55 47" fill="none" stroke="#2D5FD6" strokeWidth="1.2" strokeLinecap="round" />
      <Path d="M65 47 Q71 44 78 47" fill="none" stroke="#2D5FD6" strokeWidth="1.2" strokeLinecap="round" />

      {/* ── Nose ── */}
      <Path d="M59 64 Q60 66 61 64" fill="none" stroke="#E8B894" strokeWidth="1" strokeLinecap="round" />

      {/* ── Mouth (cute smile) ── */}
      <Path d="M54 72 Q57 76 60 76 Q63 76 66 72" fill="none" stroke="#E87878" strokeWidth="1.5" strokeLinecap="round" />

      {/* ── Blush spots ── */}
      <Ellipse cx="42" cy="67" rx="5" ry="3" fill="#FFAAAA" opacity="0.35" />
      <Ellipse cx="78" cy="67" rx="5" ry="3" fill="#FFAAAA" opacity="0.35" />

      {/* ── Hair ornament (small star/gem) ── */}
      <Circle cx="38" cy="40" r="3" fill="#FFD700" opacity="0.8" />
      <Circle cx="38" cy="40" r="1.5" fill="#FFF5CC" opacity="0.9" />
    </Svg>
  );
}

export default SannaAvatar;
