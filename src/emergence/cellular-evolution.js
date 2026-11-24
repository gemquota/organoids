import {finite,copy,active} from './shared.js';

export const methods={
  formProkaryoticCell(protocellId,options={}) {
    const proto=this.store.get(protocellId);
    if(!proto||proto.type!=='protocell'||proto.state!=='active'||proto.parent||!proto.properties.genome)throw Error('A free genome-bearing protocell is required');
    const membrane=this.store.descendants(proto.id).map(id=>this.store.get(id)).find(e=>e?.type==='membrane');
    if(!membrane)throw Error('Prokaryotic transition requires a membrane');
    const properties={...copy(proto.properties),catalogueId:'prokaryotic-cells',name:'Prokaryotic cell',categoryId:'life',catalogueColor:'#8ec6a6',symbioticCompatibility:finite(options.symbioticCompatibility,.5),metabolicSpecialization:finite(options.metabolicSpecialization,.5),divisionCount:0};
    const actions=[{op:'create',type:'prokaryotic-cell',properties,energy:0,as:'cell'},{op:'compose',parent:{ref:'cell'},child:proto.id}];
    if(proto.energy>0)actions.push({op:'transfer',from:proto.id,to:{ref:'cell'},amount:proto.energy});
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
    const cell=this.store.get(result.refs.cell);this._record('prokaryotic-cell-formation',{parents:[proto.id],children:[cell.id],metabolicEvents:finite(proto.properties.metabolicEvents)});return cell;
  },
  formEukaryoticCell(hostId,symbiontId,options={}) {
    const host=this.store.get(hostId),symbiont=this.store.get(symbiontId);
    if(!host||!symbiont||host.id===symbiont.id||host.type!=='prokaryotic-cell'||symbiont.type!=='prokaryotic-cell'||!active(host)||!active(symbiont)||host.parent||symbiont.parent)throw Error('Endosymbiosis requires two free prokaryotic cells');
    const distance=Math.hypot(finite(host.properties.x)-finite(symbiont.properties.x),finite(host.properties.y)-finite(symbiont.properties.y));
    if(distance>Math.max(1,finite(options.radius,24)))throw Error('Potential symbiont is outside the integration radius');
    const hostGenome=copy(host.properties.genome),symbiontGenome=copy(symbiont.properties.genome),transferLength=Math.max(1,Math.min(Math.floor(finite(options.geneTransferLength,4)),symbiontGenome.sequence.length));
    const genome={...hostGenome,sequence:hostGenome.sequence+symbiontGenome.sequence.slice(0,transferLength),generation:finite(hostGenome.generation),symbiontSequence:symbiontGenome.sequence};
    const properties={...copy(host.properties),genome,x:(finite(host.properties.x)+finite(symbiont.properties.x))*.5,y:(finite(host.properties.y)+finite(symbiont.properties.y))*.5,organelleCount:1,metabolismEfficiency:Math.min(1,finite(host.properties.metabolismEfficiency,.72)+.08),catalogueId:'eukaryotic-cells',name:'Eukaryotic cell',categoryId:'life',catalogueColor:'#8ec6a6',symbiontLineage:symbiontGenome.lineageId||symbiont.id};
    this.store.defineRelation?.('endosymbiosis',{direction:'directed'});
    const actions=[{op:'create',type:'eukaryotic-cell',properties,energy:0,as:'cell'},{op:'compose',parent:{ref:'cell'},child:host.id},{op:'compose',parent:{ref:'cell'},child:symbiont.id},{op:'link',from:host.id,to:symbiont.id,type:'endosymbiosis',properties:{geneTransfer:transferLength,integrated:true}}];
    if(host.energy>0)actions.push({op:'transfer',from:host.id,to:{ref:'cell'},amount:host.energy});
    if(symbiont.energy>0)actions.push({op:'transfer',from:symbiont.id,to:{ref:'cell'},amount:symbiont.energy});
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
    const cell=this.store.get(result.refs.cell);this._record('endosymbiosis',{parents:[host.id,symbiont.id],children:[cell.id],geneTransfer:transferLength,distance});this._record('eukaryotic-cell-formation',{parents:[host.id,symbiont.id],children:[cell.id]});return cell;
  },
  advanceEvolutionaryTransitions(options={}) {
    const minimumEvents=Math.max(1,Math.floor(finite(options.minimumMetabolicEvents,3))),minimumEnergy=Math.max(0,finite(options.minimumEnergy,.25));
    const protocells=[...this.store.entities.values()].filter(e=>e.type==='protocell'&&active(e)&&!e.parent);
    let prokaryotes=0,eukaryotes=0;
    for(const proto of protocells)if(finite(proto.properties.metabolicEvents)>=minimumEvents&&proto.energy>=minimumEnergy){this.formProkaryoticCell(proto.id,options);prokaryotes++}
    if(options.endosymbiosis!==false) {
      const cells=[...this.store.entities.values()].filter(e=>e.type==='prokaryotic-cell'&&active(e)&&!e.parent),radius=Math.max(1,finite(options.symbiosisRadius,24)),rate=Math.max(0,Math.min(1,finite(options.symbiosisRate,.002))),index=this.runtime.spatial.rebuild(cells),seen=new Set();
      for(const host of cells)for(const symbiont of index.query(host.properties.x,host.properties.y,radius,[]))if(symbiont.id>host.id&&!seen.has(symbiont.id)&&Math.hypot(host.properties.x-symbiont.properties.x,host.properties.y-symbiont.properties.y)<=radius){seen.add(symbiont.id);const compatibility=finite(host.properties.symbioticCompatibility,.5)*finite(symbiont.properties.metabolicSpecialization,.5);if(this.rng.next()<rate*compatibility){this.formEukaryoticCell(host.id,symbiont.id,{radius});eukaryotes++}}
    }
    return{prokaryotes,eukaryotes};
  }
};
