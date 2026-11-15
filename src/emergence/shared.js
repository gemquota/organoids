export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
export const copy=v=>structuredClone(v);
export const freeze=v=>{if(v&&typeof v==="object"&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v)}return v};
export const active=e=>e&&(e.state==="active"||e.state==="bound"&&e.properties?.lifeStage!=="dead");
export const idOf=x=>typeof x==="object"?x?.id:x;
export const readPath=(value,path)=>path.split(".").reduce((v,key)=>v?.[key],value);
