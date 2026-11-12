/**
 * "Vercel Edge" aura for the dark theme: three blended radial layers forming a lit
 * arc across the top of the page. The layers use screen/lighten blending, so this
 * element must sit directly against the page background (no isolated parent and no
 * background of its own). It is hidden on the light theme.
 */
export function AuraBackground() {
  return (
    <div className="aura" aria-hidden="true">
      <div className="aura-layer aura-layer-1" />
      <div className="aura-layer aura-layer-2" />
      <div className="aura-layer aura-layer-3" />
    </div>
  );
}
