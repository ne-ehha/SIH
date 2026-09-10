type LogoVariant = 'compact' | 'full' | 'login';

interface OceanScopeLogoProps {
  variant?: LogoVariant;
  className?: string;
}

/**
 * OceanScope's scalable identity: a sonar ring, layered ocean wave, and
 * observation dots. It is inline SVG so the mark stays crisp from header to
 * sign-in surface without duplicating raster assets.
 */
export function OceanScopeLogo({ variant = 'full', className }: OceanScopeLogoProps) {
  const showWordmark = variant !== 'compact';
  const showTagline = variant === 'login';
  const width = showTagline ? 286 : showWordmark ? 220 : 62;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} 62`}
      role="img"
      aria-label="OceanScope"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g aria-hidden="true">
        <circle cx="31" cy="31" r="23" fill="none" stroke="#35d6df" strokeWidth="2.2" />
        <circle cx="31" cy="31" r="17" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.42" strokeDasharray="2.5 4" />
        <path d="M12 34.5c5.5-5.4 10.7-5.4 16.1 0s10.8 5.4 16.1 0" fill="none" stroke="#5eead4" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M15 40c4.4-3.9 8.6-3.9 13 0s8.7 3.9 13 0" fill="none" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" opacity="0.78" />
        <circle cx="15" cy="22" r="2.3" fill="#5eead4" />
        <circle cx="45" cy="21" r="1.8" fill="#38bdf8" opacity="0.9" />
        <circle cx="49" cy="39" r="1.4" fill="#67e8f9" opacity="0.72" />
      </g>
      {showWordmark && (
        <g>
          <text x="72" y="31" fill="#f1f5f9" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif" fontSize="22" fontWeight="650" letterSpacing="-0.7">
            OceanScope
          </text>
          {showTagline && (
            <text x="73" y="46" fill="#8eb8c5" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif" fontSize="8.5" fontWeight="600" letterSpacing="2.1">
              CHAOS TO CLARITY
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/** The shared tide-dot loader used by login and workspace entry transitions. */
export function OceanTideDots({ label = 'Preparing workspace' }: { label?: string }) {
  return (
    <div className="login-flow-panel" aria-label={label}>
      <span /><span /><span /><span /><span /><span /><span />
    </div>
  );
}
