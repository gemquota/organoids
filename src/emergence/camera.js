export function constrainCamera({x=0,y=0,scale=1,worldWidth,worldHeight,viewWidth,viewHeight,minScale=0,maxScale=1}={}) {
  const min=Math.max(0,Number.isFinite(minScale)?minScale:0);
  const max=Math.max(min,Number.isFinite(maxScale)?maxScale:1);
  const nextScale=Math.max(min,Math.min(max,Number.isFinite(scale)?scale:min));
  const width=Math.max(0,Number.isFinite(worldWidth)?worldWidth:0)*nextScale;
  const height=Math.max(0,Number.isFinite(worldHeight)?worldHeight:0)*nextScale;
  const vw=Math.max(0,Number.isFinite(viewWidth)?viewWidth:0);
  const vh=Math.max(0,Number.isFinite(viewHeight)?viewHeight:0);
  const left=Number.isFinite(x)?x:0;
  const top=Number.isFinite(y)?y:0;
  return {
    x:width<=vw?(vw-width)/2:Math.max(vw-width,Math.min(0,left)),
    y:height<=vh?(vh-height)/2:Math.max(vh-height,Math.min(0,top)),
    scale:nextScale
  };
}
