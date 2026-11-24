import {clamp,finite,active} from './shared.js';

export const methods = {
  applyElectrostatics(options={}) {
    const radius=Math.max(.001,finite(options.radius,120));
    const strength=finite(options.strength,1);
    const softening=Math.max(.001,finite(options.softening,6));
    const maxAcceleration=Math.max(0,finite(options.maxAcceleration,.08));
    const dt=Math.max(0,finite(options.dt,1));
    const charged=[...this.store.entities.values()].filter(e=>active(e)&&!e.parent&&Number.isFinite(e.properties.x)&&Number.isFinite(e.properties.y)&&Math.abs(finite(e.properties.charge))>1e-9);
    const index=this.runtime.spatial.rebuild(charged);
    let pairs=0;
    for(const a of charged) {
      const pa=a.properties,qa=finite(pa.charge),ma=Math.max(.001,finite(pa.mass,1));
      for(const b of index.query(pa.x,pa.y,radius,[])) {
        if(b.id<=a.id||!active(b)||b.parent)continue;
        const pb=b.properties,qb=finite(pb.charge),product=qa*qb;
        if(Math.abs(product)<1e-9)continue;
        const dx=pb.x-pa.x,dy=pb.y-pa.y,d2=dx*dx+dy*dy;
        if(d2>radius*radius)continue;
        const d=Math.sqrt(d2)||softening;
        const magnitude=strength*product/(d2+softening*softening);
        const force=Math.sign(magnitude)*Math.min(maxAcceleration*ma,Math.abs(magnitude));
        const fx=dx/d*force,fy=dy/d*force,mb=Math.max(.001,finite(pb.mass,1));
        pa.vx=finite(pa.vx)-fx/ma*dt;pa.vy=finite(pa.vy)-fy/ma*dt;
        pb.vx=finite(pb.vx)+fx/mb*dt;pb.vy=finite(pb.vy)+fy/mb*dt;
        pairs++;
      }
    }
    return pairs;
  },

  exchangeThermalEnergy(options={}) {
    const radius=Math.max(.001,finite(options.radius,24));
    const conductance=clamp(finite(options.conductance,.04));
    const dt=Math.max(0,finite(options.dt,1));
    if(!conductance||!dt)return 0;
    const entities=[...this.store.entities.values()].filter(e=>active(e)&&!e.parent&&Number.isFinite(e.properties.x)&&Number.isFinite(e.properties.y)&&finite(e.properties.heatCapacity)>0);
    let pairs;
    if(Array.isArray(options.candidatePairs)) {
      pairs=options.candidatePairs.map(([a,b])=>a<b?[a,b]:[b,a]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    } else {
      const index=this.runtime.spatial.rebuild(entities);
      pairs=[];
      for(const a of entities)for(const b of index.query(a.properties.x,a.properties.y,radius,[]))if(b.id>a.id)pairs.push([a.id,b.id]);
    }
    const eligible=new Set(entities.map(e=>e.id));
    let transfers=0;
    for(const [aId,bId] of pairs) {
      if(!eligible.has(aId)||!eligible.has(bId))continue;
      const a=this.store.get(aId),b=this.store.get(bId);
      if(!a||!b||!active(a)||!active(b)||a.parent||b.parent)continue;
      const ca=Math.max(.001,finite(a.properties.heatCapacity,1)),cb=Math.max(.001,finite(b.properties.heatCapacity,1));
      const ta=a.energy/ca,tb=b.energy/cb,distance=Math.hypot(b.properties.x-a.properties.x,b.properties.y-a.properties.y);
      if(distance>radius||Math.abs(ta-tb)<1e-9)continue;
      const hot=ta>tb?a:b,cold=hot===a?b:a;
      const hotCapacity=hot===a?ca:cb,coldCapacity=hot===a?cb:ca;
      const equilibrium=Math.abs(ta-tb)*(hotCapacity*coldCapacity/(hotCapacity+coldCapacity));
      const amount=Math.min(hot.energy,equilibrium*clamp(conductance*dt));
      if(amount>1e-10){this.energy.transfer(hot,cold,amount);transfers++}
    }
    return transfers;
  }
};
