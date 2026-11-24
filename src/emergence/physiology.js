import {clamp,finite,active} from './shared.js';

export const methods={
  advanceCellularProcesses(options={}) {
    const cells=[...this.store.entities.values()].filter(e=>(e.type==='protocell'||e.type==='cell')&&active(e)&&!e.parent);
    const uptakeRadius=Math.max(1,finite(options.uptakeRadius,48)),uptakeAmount=Math.max(0,finite(options.uptakeAmount,.04));
    let transported=0,metabolised=0,grown=0,divided=0;
    const index=this.runtime.spatial.rebuild(this.store.entities.values());
    for(const cell of cells) {
      const membrane=this.store.outgoing(cell.id,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='membrane');
      if(membrane&&uptakeAmount>0) {
        const nearby=index.query(finite(cell.properties.x),finite(cell.properties.y),uptakeRadius,[]);
        for(const nutrient of nearby)if(nutrient.type==='substrate'&&nutrient.state==='active'&&nutrient.parent!==cell.id&&this.energy.quantity(nutrient,'substrate')>0) {
          const amount=this.transport(membrane.id,nutrient.id,cell.id,'substrate',uptakeAmount);
          if(amount>0){transported+=amount;break}
        }
      }
      const available=this.energy.quantity(cell,'substrate');
      if(available>0){const result=this.metabolize(cell.id,{substrate:'substrate',amount:Math.min(available,Math.max(0,finite(options.metabolismAmount,.03))),efficiency:clamp(finite(options.efficiency,.72))});metabolised+=result.consumed}
      if(cell.energy>=Math.max(0,finite(options.growthCost,.0005))&&this.grow(cell.id,{biomass:Math.max(0,finite(options.growthAmount,.002)),energyCost:Math.max(0,finite(options.growthCost,.0005)),maturity:Math.max(.1,finite(options.maturity,1.5))}))grown++;
      const interval=Math.max(1,Math.floor(finite(options.reproductionInterval,1800)));
      if(this.lifecycle.stage(cell)==='mature'&&(options.forceReproduction||this.runtime.scheduler.tick>0&&this.runtime.scheduler.tick%interval===0)&&cell.energy>finite(options.reproductionCost,.01)) {
        try{if(this.fission(cell.id,{share:clamp(finite(options.reproductionShare,.25)),energyCost:Math.max(0,finite(options.reproductionCost,.01)),alphabet:options.alphabet||'ACGU'}))divided++}catch(error){if(!/energy budget/.test(error.message))throw error}
      }
    }
    return{cells:cells.length,transported,metabolised,grown,divided};
  },
  transport(membraneId,fromId,toId,key,requested,options={}){
    const membrane=this.store.get(membraneId),from=this.store.get(fromId),to=this.store.get(toId);
    if(!membrane||membrane.type!=="membrane"||!from||!to||!active(from)||!active(to))throw Error("Transport requires a membrane and two active entities");
    const parent=this.store.get(membrane.parent),inside=new Set(parent?[parent.id,...this.store.descendants(parent.id)]:[]);
    if(parent&&inside.has(from.id)===inside.has(to.id))throw Error("Transport endpoints must lie on opposite sides of the membrane");
    const permeability=clamp(finite(membrane.properties.permeability)),channels=membrane.properties.channels||{},channel=channels[key];
    if(channel===false||channel?.enabled===false) return 0;
    const selectivity=membrane.properties.selectivity;
    if(Array.isArray(selectivity)&&!selectivity.includes(key))return 0;
    const conductance=clamp(finite(typeof channel==="number"?channel:channel?.conductance,1));
    const available=this.energy.quantity(from,key),capacity=Math.max(0,finite(requested));
    const volumeFrom=Math.max(.001,finite(from.properties.volume,1)),volumeTo=Math.max(.001,finite(to.properties.volume,1));
    const gradient=available/volumeFrom-this.energy.quantity(to,key)/volumeTo;
    if(options.passive!==false&&gradient<=0)return 0;
    const flux=Math.min(available,capacity,capacity*permeability*conductance,options.passive===false?capacity:Math.max(0,gradient)*permeability*conductance);
    if(flux<=0)return 0;
    this.owner.transferMaterial(from.id,to.id,key,flux,from.quantityUnits?.[key]||options.unit||"quantity");
    this._record("membrane-transport",{entity:membrane.id,parents:[from.id],children:[to.id],resource:key,amount:flux,passive:options.passive!==false});
    return flux;
  },
  metabolize(id,options={}){
    const cell=this.store.get(id);if(!cell||!active(cell))throw Error("Metabolism requires a living cell");
    const substrate=options.substrate||"substrate",waste=options.waste||"waste",amount=Math.max(0,finite(options.amount,1)),efficiency=clamp(finite(options.efficiency,.7));
    if((cell.quantityUnits?.[substrate]||"quantity")!=="energy")throw Error("Metabolic substrate must use energy units");
    const available=this.energy.quantity(cell,substrate),consumed=Math.min(amount,available),yieldEnergy=consumed*efficiency;
    if(consumed<=0)return{consumed:0,energy:0};
    const result=this.store.transact([{op:"convert-quantity",id,key:substrate,amount:consumed,efficiency},{op:"material",id,key:waste,delta:consumed,unit:options.wasteUnit||"mass"}],{energy:this.energy,fields:this.energy.fields});
    if(!result.ok)throw result.error;
    this._record("metabolism",{entity:id,substrate,waste,consumed,energy:yieldEnergy,efficiency});
    return{consumed,energy:yieldEnergy,waste:consumed};
  }
};
