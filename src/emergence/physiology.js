import {clamp,finite,active} from './shared.js';

export const methods={
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
    const result=this.store.transact([{op:"material",id,key:substrate,delta:-consumed,unit:"energy"},{op:"material",id,key:waste,delta:consumed,unit:options.wasteUnit||"mass"}],{energy:this.energy,fields:this.energy.fields});
    if(!result.ok)throw result.error;
    this.energy.source(cell,yieldEnergy);
    this._record("metabolism",{entity:id,substrate,waste,consumed,energy:yieldEnergy,efficiency});
    return{consumed,energy:yieldEnergy,waste:consumed};
  }
};
