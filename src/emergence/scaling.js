export function deriveWorldScale(width,height,referenceWidth,referenceHeight) {
  const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
  const rw=Math.max(1,Number(referenceWidth)||1),rh=Math.max(1,Number(referenceHeight)||1);
  return Math.max(.1,Math.min(100,Math.sqrt((w*h)/(rw*rh))));
}
export function scaleDistance(value,scale) {
  return Math.max(0,Number(value)||0)*Math.max(.1,Math.min(100,Number(scale)||1));
}
export function scaleVelocity(value,scale) { return scaleDistance(value,scale); }
