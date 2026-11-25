import {finite,active} from './shared.js';

const ELEMENTS={1:['H','Hydrogen'],2:['He','Helium'],3:['Li','Lithium'],4:['Be','Beryllium'],5:['B','Boron'],6:['C','Carbon'],7:['N','Nitrogen'],8:['O','Oxygen'],9:['F','Fluorine'],10:['Ne','Neon'],11:['Na','Sodium'],12:['Mg','Magnesium'],13:['Al','Aluminium'],14:['Si','Silicon'],15:['P','Phosphorus'],16:['S','Sulfur'],17:['Cl','Chlorine'],18:['Ar','Argon']};

export const methods={
  formHadrons(options={}) {
    const quarks=[...this.store.entities.values()].filter(e=>e.type==='quark'&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,12)),index=this.runtime.spatial.rebuild(quarks),used=new Set();
    let formed=0;
    for(const anchor of quarks) {
      if(used.has(anchor.id)||anchor.parent)continue;
      const nearby=index.query(anchor.properties.x,anchor.properties.y,radius,[])
        .filter(q=>q.type==='quark'&&active(q)&&!q.parent&&!used.has(q.id)&&q.id!==anchor.id);
      let best=null,bestScore=Infinity;
      for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++) {
        const triple=[anchor,nearby[i],nearby[j]],colors=new Set(triple.map(q=>q.properties.colorCharge));
        if(colors.size!==3||!['red','green','blue'].every(color=>colors.has(color)))continue;
        const up=triple.filter(q=>q.properties.flavor==='up').length,down=triple.filter(q=>q.properties.flavor==='down').length;
        if(!((up===2&&down===1)||(up===1&&down===2)))continue;
        const distances=[0,1,2].flatMap(a=>[a+1,a+2].filter(b=>b<3).map(b=>Math.hypot(triple[a].properties.x-triple[b].properties.x,triple[a].properties.y-triple[b].properties.y)));
        if(Math.max(...distances)>radius)continue;
        const score=distances.reduce((sum,d)=>sum+d*d,0);
        if(score<bestScore){best=triple;bestScore=score}
      }
      if(!best)continue;
      const triple=best,up=triple.filter(q=>q.properties.flavor==='up').length,down=3-up;
      const x=triple.reduce((s,e)=>s+finite(e.properties.x),0)/3,y=triple.reduce((s,e)=>s+finite(e.properties.y),0)/3;
      const type=up===2?'proton':'neutron',charge=up*2/3-down/3,mass=triple.reduce((s,e)=>s+finite(e.properties.mass,1),0);
      const gluons=[...this.store.entities.values()].filter(e=>e.type==='gluon'&&active(e)&&!e.parent&&Math.hypot(e.properties.x-x,e.properties.y-y)<=radius).slice(0,2);
      const actions=[{op:'create',type,properties:{x,y,mass,charge,quarkCount:3,colorNeutral:true,catalogueId:'protons-neutrons',name:type==='proton'?'Proton':'Neutron',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'hadron'},...triple.map(q=>({op:'compose',parent:{ref:'hadron'},child:q.id}))];
      for(const q of triple)if(q.energy>0)actions.push({op:'transfer',from:q.id,to:{ref:'hadron'},amount:q.energy});
      for(const gluon of gluons)actions.push({op:'link',from:{ref:'hadron'},to:gluon.id,type:'exchanges',properties:{interaction:'strong',mediator:true}});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      for(const q of triple)used.add(q.id);
      for(const q of triple)this.runtime.constraints.add({a:result.refs.hadron,b:q.id,rest:Math.hypot(q.properties.x-x,q.properties.y-y),stiffness:.8});
      this._record('hadron-formation',{parents:triple.map(q=>q.id),children:[result.refs.hadron],kind:type,charge,gluons:gluons.map(g=>g.id)});
      formed++;
    }
    return formed;
  },
  formNuclei(options={}) {
    const nucleons=[...this.store.entities.values()].filter(e=>(e.type==='proton'||e.type==='neutron')&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,18));
    const maxNucleons=Math.max(1,Math.floor(finite(options.maxNucleons,4))),maxProtons=Math.max(1,Math.min(maxNucleons,Math.floor(finite(options.maxProtons,2)))),maxNeutrons=Math.max(0,maxNucleons-maxProtons),smallNucleusFraction=Math.max(0,Math.min(1,finite(options.smallNucleusFraction,0)));
    const remaining=new Map(nucleons.map(e=>[e.id,e])),index=this.runtime.spatial.rebuild(nucleons);let formed=0;
    const nearest=(type,anchor,count)=>count>0?index.query(anchor.properties.x,anchor.properties.y,radius,[])
      .filter(e=>e.id!==anchor.id&&e.type===type&&remaining.has(e.id))
      .sort((a,b)=>Math.hypot(finite(a.properties.x)-finite(anchor.properties.x),finite(a.properties.y)-finite(anchor.properties.y))-Math.hypot(finite(b.properties.x)-finite(anchor.properties.x),finite(b.properties.y)-finite(anchor.properties.y))).slice(0,count):[];
    while(true) {
      const seed=nucleons.find(e=>remaining.has(e.id)&&e.type==='proton');if(!seed)break;
      const group=[seed];remaining.delete(seed.id);
      const hydrogenSeed=this.rng.next()<smallNucleusFraction;
      const add=(type,count)=>{for(const e of nearest(type,seed,count)){group.push(e);remaining.delete(e.id)}};
      // Build small, proton-bearing seed nuclei. Large connected clouds are
      // partitioned instead of being mistaken for one giant element.
      if(!hydrogenSeed){
        add('neutron',maxNeutrons);
        add('proton',maxProtons-1);
        if(group.length<maxNucleons)add('neutron',maxNucleons-group.length);
      }
      const protons=group.filter(e=>e.type==='proton').length,neutrons=group.length-protons;
      const mass=group.reduce((sum,e)=>sum+finite(e.properties.mass,1),0),x=group.reduce((sum,e)=>sum+finite(e.properties.x)*finite(e.properties.mass,1),0)/Math.max(.001,mass),y=group.reduce((sum,e)=>sum+finite(e.properties.y)*finite(e.properties.mass,1),0)/Math.max(.001,mass);
      const actions=[{op:'create',type:'atomic-nucleus',properties:{x,y,mass,protonCount:protons,neutronCount:neutrons,atomicNumber:protons,massNumber:group.length,charge:protons,catalogueId:'atomic-nuclei',name:'Atomic nucleus',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'nucleus'},...group.map(e=>({op:'compose',parent:{ref:'nucleus'},child:e.id}))];
      for(const e of group)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'nucleus'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      for(const e of group)this.runtime.constraints.add({a:result.refs.nucleus,b:e.id,rest:Math.hypot(e.properties.x-x,e.properties.y-y),stiffness:.9});
      this._record('nuclear-binding',{parents:group.map(e=>e.id),children:[result.refs.nucleus],protonCount:protons,neutronCount:neutrons});formed++;
    }
    return formed;
  },

  accreteNucleons(options={}) {
    const radius=Math.max(.01,finite(options.accretionRadius,finite(options.radius,18)*.65)),maxAtomicNumber=Math.max(1,Math.floor(finite(options.maxAtomicNumber,Infinity))),maxMassNumber=Math.max(1,Math.floor(finite(options.maxMassNumber,Infinity)));
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent);
    const free=[...this.store.entities.values()].filter(e=>(e.type==='proton'||e.type==='neutron')&&active(e)&&!e.parent),index=this.runtime.spatial.rebuild(free);
    let accreted=0;
    for(const isotope of isotopes) {
      const nucleus=this.store.outgoing(isotope.id,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');
      if(!nucleus)continue;
      const candidate=index.query(isotope.properties.x,isotope.properties.y,radius,[])
        .filter(e=>!e.parent&&(e.type!=='proton'||finite(nucleus.properties.protonCount)+1<=maxAtomicNumber)&&finite(nucleus.properties.massNumber,finite(nucleus.properties.protonCount)+finite(nucleus.properties.neutronCount))+1<=maxMassNumber)
        .sort((a,b)=>Math.hypot(a.properties.x-isotope.properties.x,a.properties.y-isotope.properties.y)-Math.hypot(b.properties.x-isotope.properties.x,b.properties.y-isotope.properties.y))[0];
      if(!candidate)continue;
      const protonCount=finite(nucleus.properties.protonCount)+(candidate.type==='proton'?1:0);
      const neutronCount=finite(nucleus.properties.neutronCount)+(candidate.type==='neutron'?1:0);
      const mass=finite(nucleus.properties.mass)+finite(candidate.properties.mass,1);
      const x=(finite(nucleus.properties.x)*finite(nucleus.properties.mass)+finite(candidate.properties.x)*finite(candidate.properties.mass,1))/Math.max(.001,mass);
      const y=(finite(nucleus.properties.y)*finite(nucleus.properties.mass)+finite(candidate.properties.y)*finite(candidate.properties.mass,1))/Math.max(.001,mass);
      const charge=protonCount;
      const actions=[{op:'compose',parent:nucleus.id,child:candidate.id},
        ...Object.entries({protonCount,neutronCount,atomicNumber:protonCount,massNumber:protonCount+neutronCount,mass,charge,x,y}).map(([key,value])=>({op:'set',id:nucleus.id,key,value})),
        ...Object.entries({protonCount,neutronCount,atomicNumber:protonCount,massNumber:protonCount+neutronCount,mass,charge,x,y}).map(([key,value])=>({op:'set',id:isotope.id,key,value}))];
      if(candidate.energy>0)actions.push({op:'transfer',from:candidate.id,to:nucleus.id,amount:candidate.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
      if(!result.ok)throw result.error;
      this.runtime.constraints.add({a:nucleus.id,b:candidate.id,rest:Math.hypot(candidate.properties.x-x,candidate.properties.y-y),stiffness:.9});
      this._record('nuclear-accretion',{parents:[isotope.id,candidate.id],children:[nucleus.id],protonCount,neutronCount});
      free.splice(free.indexOf(candidate),1);accreted++;
    }
    return accreted;
  },

  fuseIsotopes(options={}) {
    const radius=Math.max(.01,finite(options.fusionRadius,finite(options.radius,18)*.55));
    const maxSpeed=Math.max(0,finite(options.maxFusionSpeed,1.5));
    const maxAtomicNumber=Number.isFinite(options.maxAtomicNumber)?Math.max(1,Math.floor(options.maxAtomicNumber)):Infinity;
    const minFusionAtomicNumber=Number.isFinite(options.minFusionAtomicNumber)?Math.max(1,Math.floor(options.minFusionAtomicNumber)):1;
    const fusionProbability=Math.max(0,Math.min(1,finite(options.fusionProbability,1)));
    const atomizationDelay=Math.max(0,finite(options.atomizationDelay,Infinity));
    const channels=Array.isArray(options.fusionChannels)?options.fusionChannels.map(channel=>({reactants:[...channel.reactants].sort((a,b)=>a-b),maxPerTick:Math.max(1,Math.floor(finite(channel.maxPerTick,Infinity))),maxProducts:Math.max(1,Math.floor(finite(channel.maxProducts,Infinity)))})):null;
    const channelCounts=new Map(),channelTotals=this._fusionChannelTotals||(this._fusionChannelTotals=new Map());
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent).sort((a,b)=>finite(a.properties.protonCount)-finite(b.properties.protonCount)||finite(a.properties.massNumber)-finite(b.properties.massNumber)||a.id-b.id);
    const nucleusByIsotope=new Map(isotopes.map(isotope=>[isotope.id,this.store.outgoing(isotope.id,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus')]).filter(([,nucleus])=>!!nucleus));
    const nucleusOf=isotope=>nucleusByIsotope.get(isotope.id),isotopeIndex=this.runtime.spatial.rebuild(isotopes),isotopeOrder=new Map(isotopes.map((e,i)=>[e.id,i])),isotopesByZ=new Map();
    for(const isotope of isotopes){const z=finite(nucleusOf(isotope)?.properties.protonCount);if(!isotopesByZ.has(z))isotopesByZ.set(z,[]);isotopesByZ.get(z).push(isotope)}
    const used=new Set();let fused=0;
    const perform=(a,nucleusA,b,nucleusB,d,channelIndex=-1)=>{
      const protonCount=finite(nucleusA.properties.protonCount)+finite(nucleusB.properties.protonCount),neutronCount=finite(nucleusA.properties.neutronCount)+finite(nucleusB.properties.neutronCount);
      if(protonCount<1||protonCount>maxAtomicNumber||this.rng.next()>fusionProbability)return false;
      const mass=finite(a.properties.mass)+finite(b.properties.mass),x=(finite(a.properties.x)*finite(a.properties.mass)+finite(b.properties.x)*finite(b.properties.mass))/Math.max(.001,mass),y=(finite(a.properties.y)*finite(a.properties.mass)+finite(b.properties.y)*finite(b.properties.mass))/Math.max(.001,mass);
      const isotopeProperties={x,y,mass,protonCount,neutronCount,atomicNumber:protonCount,massNumber:protonCount+neutronCount,charge:protonCount,formedAt:this.runtime.scheduler.time,catalogueId:'isotopes',name:'Isotope',categoryId:'atoms',catalogueColor:'#d6c18b'};
      const actions=[{op:'create',type:'atomic-nucleus',properties:{...isotopeProperties,name:'Fused atomic nucleus',catalogueId:'atomic-nuclei',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'nucleus'},{op:'unlink',from:a.id,to:nucleusA.id,type:'contains'},{op:'unlink',from:b.id,to:nucleusB.id,type:'contains'},{op:'remove',id:a.id},{op:'remove',id:b.id},{op:'compose',parent:{ref:'nucleus'},child:nucleusA.id},{op:'compose',parent:{ref:'nucleus'},child:nucleusB.id},{op:'create',type:'isotope',properties:isotopeProperties,energy:0,as:'isotope'},{op:'compose',parent:{ref:'isotope'},child:{ref:'nucleus'}}];
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this.runtime.constraints.add({a:result.refs.nucleus,b:nucleusA.id,rest:Math.max(1,d/2),stiffness:.7});this.runtime.constraints.add({a:result.refs.nucleus,b:nucleusB.id,rest:Math.max(1,d/2),stiffness:.7});
      const reactants=channels?.[channelIndex]?.reactants||[finite(nucleusA.properties.protonCount),finite(nucleusB.properties.protonCount)];
      this._record('nuclear-fusion',{parents:[a.id,b.id],children:[result.refs.isotope],protonCount,neutronCount,massNumber:protonCount+neutronCount,channel:reactants});
      if(channels){channelCounts.set(channelIndex,(channelCounts.get(channelIndex)||0)+1);channelTotals.set(channelIndex,(channelTotals.get(channelIndex)||0)+1)}
      used.add(a.id);used.add(b.id);fused++;return true;
    };
    const young=isotope=>this.runtime.scheduler.time-finite(isotope.properties.formedAt,this.runtime.scheduler.time)<atomizationDelay;
    if(channels){
      // Process reaction channels globally, not by isotope iteration order.
      // Otherwise an early low-Z reactant can consume every shared intermediate
      // before a later channel gets a chance to build its own products.
      for(let channelIndex=0;channelIndex<channels.length;channelIndex++){
        const channel=channels[channelIndex];let made=0;
        while(made<channel.maxPerTick&&(channelTotals.get(channelIndex)||0)<channel.maxProducts){
          let best=null,bestDistance=Infinity;
          const [za,zb]=channel.reactants,left=isotopesByZ.get(za)||[],rightIds=new Set((isotopesByZ.get(zb)||[]).map(e=>e.id));
          for(const a of left){
            if(used.has(a.id)||!young(a))continue;const na=nucleusOf(a);if(!na)continue;
            for(const b of isotopeIndex.query(a.properties.x,a.properties.y,radius,[])){
              if(b.id===a.id||used.has(b.id)||!young(b)||za===zb&&isotopeOrder.get(b.id)<=isotopeOrder.get(a.id))continue;
              const nb=nucleusOf(b);if(!nb||finite(nb.properties.protonCount)!==zb||!rightIds.has(b.id))continue;
              if(za<minFusionAtomicNumber&&zb<minFusionAtomicNumber||za+zb>maxAtomicNumber)continue;
              const d=Math.hypot(finite(b.properties.x)-finite(a.properties.x),finite(b.properties.y)-finite(a.properties.y)),speed=Math.hypot(finite(b.properties.vx)-finite(a.properties.vx),finite(b.properties.vy)-finite(a.properties.vy));
              if(speed<=maxSpeed&&d<bestDistance){best={a,na,b,nb};bestDistance=d}
            }
          }
          if(!best)break;
          if(perform(best.a,best.na,best.b,best.nb,bestDistance,channelIndex))made++;
          else {used.add(best.a.id);used.add(best.b.id)}
        }
      }
      return fused;
    }
    // Generic unconstrained fusion retains the deterministic lowest-Z product
    // preference used by the interactive chemistry sandbox.
    for(let i=0;i<isotopes.length;i++){
      const a=isotopes[i];if(used.has(a.id)||!young(a))continue;const na=nucleusOf(a);if(!na)continue;
      let best=null,bestDistance=Infinity,bestZ=Infinity;
      for(const b of isotopeIndex.query(a.properties.x,a.properties.y,radius,[])){
        if(isotopeOrder.get(b.id)<=i||used.has(b.id)||!young(b))continue;const nb=nucleusOf(b);if(!nb)continue;
        const za=finite(na.properties.protonCount),zb=finite(nb.properties.protonCount),z=za+zb;if(za<minFusionAtomicNumber&&zb<minFusionAtomicNumber||z>maxAtomicNumber)continue;
        const d=Math.hypot(finite(b.properties.x)-finite(a.properties.x),finite(b.properties.y)-finite(a.properties.y)),speed=Math.hypot(finite(b.properties.vx)-finite(a.properties.vx),finite(b.properties.vy)-finite(a.properties.vy));
        if(speed<=maxSpeed&&(z<bestZ||z===bestZ&&d<bestDistance)){best={b,nb};bestDistance=d;bestZ=z}
      }
      if(best)perform(a,na,best.b,best.nb,bestDistance);
    }
    return fused;
  },

  formIsotopes() {
    const nuclei=[...this.store.entities.values()].filter(e=>e.type==='atomic-nucleus'&&active(e)&&!e.parent);let formed=0;
    for(const nucleus of nuclei){const properties={x:finite(nucleus.properties.x),y:finite(nucleus.properties.y),mass:finite(nucleus.properties.mass),protonCount:nucleus.properties.protonCount,atomicNumber:nucleus.properties.atomicNumber,neutronCount:nucleus.properties.neutronCount,massNumber:nucleus.properties.massNumber,charge:nucleus.properties.charge,formedAt:this.runtime.scheduler.time,catalogueId:'isotopes',name:'Isotope',categoryId:'atoms',catalogueColor:'#d6c18b'};
      const actions=[{op:'create',type:'isotope',properties,energy:0,as:'isotope'},{op:'compose',parent:{ref:'isotope'},child:nucleus.id}];if(nucleus.energy>0)actions.push({op:'transfer',from:nucleus.id,to:{ref:'isotope'},amount:nucleus.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this._record('isotope-formation',{parents:[nucleus.id],children:[result.refs.isotope],massNumber:properties.massNumber});formed++;
    }
    return formed;
  },

  formAtoms(options={}) {
    const radius=Math.max(.01,finite(options.radius,24));
    const electrons=()=>[...this.store.entities.values()].filter(e=>e.type==='lepton'&&e.properties.leptonKind==='electron'&&active(e)&&!e.parent);
    let formed=0;
    // Existing positive ions continue capturing electrons instead of becoming
    // permanently frozen at their first, incomplete electron shell.
    for(const atom of [...this.store.entities.values()].filter(e=>e.type==='atom'&&active(e)&&!e.parent&&finite(e.properties.charge)>0)) {
      const need=Math.max(0,Math.floor(finite(atom.properties.charge)));
      if(!need)continue;
      const near=electrons().filter(e=>Math.hypot(e.properties.x-atom.properties.x,e.properties.y-atom.properties.y)<=radius)
        .sort((a,b)=>Math.hypot(a.properties.x-atom.properties.x,a.properties.y-atom.properties.y)-Math.hypot(b.properties.x-atom.properties.x,b.properties.y-atom.properties.y)).slice(0,need);
      if(!near.length)continue;
      const count=finite(atom.properties.electronCount)+near.length,charge=finite(atom.properties.atomicNumber)-count;
      const actions=[...near.map(e=>({op:'compose',parent:atom.id,child:e.id})),{op:'set',id:atom.id,key:'electronCount',value:count},{op:'set',id:atom.id,key:'charge',value:charge},{op:'set',id:atom.id,key:'mass',value:finite(atom.properties.mass)+near.reduce((sum,e)=>sum+finite(e.properties.mass),0)},{op:'set',id:atom.id,key:'name',value:atom.properties.elementName+(charge>0?' ion':' atom')}];
      for(const e of near)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:atom.id,amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
    }
    const atomizationDelay=Math.max(0,finite(options.atomizationDelay,0));
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent&&this.runtime.scheduler.time-finite(e.properties.formedAt,this.runtime.scheduler.time)>=atomizationDelay);
    for(const isotope of isotopes) {
      const atomicNumber=Math.max(1,Math.floor(finite(isotope.properties.atomicNumber,1)));
      const near=electrons().filter(e=>Math.hypot(e.properties.x-isotope.properties.x,e.properties.y-isotope.properties.y)<=radius)
        .sort((a,b)=>Math.hypot(a.properties.x-isotope.properties.x,a.properties.y-isotope.properties.y)-Math.hypot(b.properties.x-isotope.properties.x,b.properties.y-isotope.properties.y)).slice(0,atomicNumber);
      // Ionisation is allowed: a nucleus can become a positive ion with one
      // captured electron, then neutralise incrementally as electrons arrive.
      if(!near.length)continue;
      const nucleus=this.store.descendants(isotope.id).map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');if(!nucleus)continue;
      const element=ELEMENTS[atomicNumber]||['X','Unknown'],x=finite(isotope.properties.x),y=finite(isotope.properties.y),mass=finite(isotope.properties.mass,finite(nucleus.properties.mass,1))+near.reduce((sum,e)=>sum+finite(e.properties.mass),0);
      const valenceElectrons=({1:1,2:2,3:1,4:2,5:3,6:4,7:5,8:6,9:7,10:8,11:1,12:2,13:3,14:4,15:5,16:6,17:7,18:8})[atomicNumber]??0,maxCovalentBonds=({1:1,2:0,3:1,4:2,5:3,6:4,7:3,8:2,9:1,10:0,11:1,12:2,13:3,14:4,15:5,16:2,17:1,18:0})[atomicNumber]??0,electronegativity=({1:2.2,2:0,3:.98,4:1.57,5:2.04,6:2.55,7:3.04,8:3.44,9:3.98,10:0,11:.93,12:1.31,13:1.61,14:1.90,15:2.19,16:2.58,17:3.16,18:0})[atomicNumber]??0;
      const properties={x,y,mass,atomicNumber,protonCount:atomicNumber,neutronCount:isotope.properties.neutronCount,massNumber:isotope.properties.massNumber,electronCount:near.length,charge:atomicNumber-near.length,valenceElectrons,valence:maxCovalentBonds,maxCovalentBonds,electronegativity,elementSymbol:element[0],elementName:element[1],catalogueId:'atoms',name:element[1]+(near.length<atomicNumber?' ion':' atom'),categoryId:'atoms',catalogueColor:'#d6c18b'};
      const actions=[{op:'create',type:'atom',properties,energy:0,as:'atom'},{op:'compose',parent:{ref:'atom'},child:isotope.id},...near.map(e=>({op:'compose',parent:{ref:'atom'},child:e.id}))];
      for(const e of [isotope,...near])if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'atom'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this._record('atom-formation',{parents:[isotope.id,...near.map(e=>e.id)],children:[result.refs.atom],element:element[1],atomicNumber,charge:properties.charge});formed++;
    }
    return formed;
  },

  formElements() {
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&active(e)),groups=new Map();
    for(const atom of atoms){const key=atom.properties.atomicNumber;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(atom)}
    this.store.defineRelation?.('classifies',{direction:'directed'});
    let formed=0;
    for(const[number,members]of groups){const info=ELEMENTS[number]||['X','Unknown'];let element=[...this.store.entities.values()].find(e=>e.type==='element'&&e.properties.atomicNumber===number);
      if(!element){const x=members.reduce((s,e)=>s+e.properties.x,0)/members.length,y=members.reduce((s,e)=>s+e.properties.y,0)/members.length,properties={x,y,atomicNumber:number,symbol:info[0],elementName:info[1],atomCount:0,catalogueId:'elements',name:info[1],categoryId:'atoms',catalogueColor:'#d6c18b'};
        const result=this.store.transact([{op:'create',type:'element',properties,energy:0,as:'element'}]);if(!result.ok)throw result.error;element=this.store.get(result.refs.element);
        this._record('element-formation',{parents:members.map(e=>e.id),children:[element.id],atomicNumber:number,symbol:info[0]});formed++;
      }
      const linked=new Set(this.store.neighbours(element.id,'classifies'));
      for(const atom of members)if(!linked.has(atom.id))this.store.link(element.id,atom.id,'classifies',{atomicNumber:number,symbol:info[0]});
      this.store.transact([{op:'set',id:element.id,key:'atomCount',value:this.store.neighbours(element.id,'classifies').length}]);
    }
    return formed;
  },

  diagnoseAtomicFusion(options={}) {
    const radius=Math.max(.01,finite(options.fusionRadius,18)),maxSpeed=Math.max(0,finite(options.maxFusionSpeed,1.5)),maxAtomicNumber=Math.max(1,Math.floor(finite(options.maxAtomicNumber,18))),minFusionAtomicNumber=Math.max(1,Math.floor(finite(options.minFusionAtomicNumber,1))),atomizationDelay=Math.max(0,finite(options.atomizationDelay,Infinity)),channels=Array.isArray(options.fusionChannels)?options.fusionChannels.map(channel=>({reactants:[...channel.reactants].sort((a,b)=>a-b),maxPerTick:Math.max(1,Math.floor(finite(channel.maxPerTick,Infinity))),maxProducts:Math.max(1,Math.floor(finite(channel.maxProducts,Infinity)))})):null;
    const channelIndex=(a,b)=>channels?channels.findIndex(channel=>channel.reactants[0]===Math.min(a,b)&&channel.reactants[1]===Math.max(a,b)):-1;
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent),nuclei=isotopes.map(e=>({isotope:e,nucleus:this.store.outgoing(e.id,'contains').map(id=>this.store.get(id)).find(n=>n?.type==='atomic-nucleus')})).filter(x=>x.nucleus);
    let nearestDistance=Infinity,withinRadius=0,withinSpeed=0,eligible=0,nearestPair=null,maturedIsotopes=0;
    const channelPairs={};
    for(const item of nuclei)if(this.runtime.scheduler.time-finite(item.isotope.properties.formedAt,this.runtime.scheduler.time)>=atomizationDelay)maturedIsotopes++;
    for(let i=0;i<nuclei.length;i++)for(let j=i+1;j<nuclei.length;j++){
      const a=nuclei[i].isotope,b=nuclei[j].isotope,na=nuclei[i].nucleus,nb=nuclei[j].nucleus,za=finite(na.properties.protonCount),zb=finite(nb.properties.protonCount),ageA=this.runtime.scheduler.time-finite(a.properties.formedAt,this.runtime.scheduler.time),ageB=this.runtime.scheduler.time-finite(b.properties.formedAt,this.runtime.scheduler.time),channel=channelIndex(za,zb),distance=Math.hypot(finite(a.properties.x)-finite(b.properties.x),finite(a.properties.y)-finite(b.properties.y)),speed=Math.hypot(finite(a.properties.vx)-finite(b.properties.vx),finite(a.properties.vy)-finite(b.properties.vy));
      if(distance<nearestDistance){nearestDistance=distance;nearestPair={a:a.id,b:b.id,distance,speed,atomicNumbers:[finite(na.properties.protonCount),finite(nb.properties.protonCount)]}}
      if(distance<=radius){withinRadius++;if(speed<=maxSpeed){withinSpeed++;const z=za+zb,allowedChannel=!channels||channel>=0,young=ageA<atomizationDelay&&ageB<atomizationDelay;if(z<=maxAtomicNumber&&!(za<minFusionAtomicNumber&&zb<minFusionAtomicNumber)&&allowedChannel&&young){eligible++;const key=channels?channels[channel].reactants.join('+'):'generic';channelPairs[key]=(channelPairs[key]||0)+1}}}
    }
    const isotopeElements={};for(const {nucleus} of nuclei){const z=finite(nucleus.properties.protonCount);isotopeElements[z]=(isotopeElements[z]||0)+1}
    const freeNucleons=[...this.store.entities.values()].filter(e=>active(e)&&!e.parent&&(e.type==='proton'||e.type==='neutron'));
    const channelProducts=channels?Object.fromEntries(channels.map((channel,index)=>[channel.reactants.join('+'),this._fusionChannelTotals?.get(index)||0])):{},channelCapacity=channels?Object.fromEntries(channels.map((channel,index)=>{const produced=this._fusionChannelTotals?.get(index)||0;return[channel.reactants.join('+'),{produced,maxProducts:channel.maxProducts,remaining:Math.max(0,channel.maxProducts-produced)}]})):{};
    return{isotopesByAtomicNumber:isotopeElements,isotopeCount:isotopes.length,nucleusCount:nuclei.length,maturedIsotopes,channelPairs,channelCount:channels?.length||0,channelProducts,channelCapacity,nearestPair,nearestDistance:Number.isFinite(nearestDistance)?nearestDistance:null,searchRadius:radius,maxRelativeSpeed:maxSpeed,minFusionAtomicNumber,atomizationDelay,pairsWithinRadius:withinRadius,pairsWithinSpeed:withinSpeed,eligibleFusionPairs:eligible,freeProtons:freeNucleons.filter(e=>e.type==='proton').length,freeNeutrons:freeNucleons.filter(e=>e.type==='neutron').length,maxAtomicNumber};
  },
  diagnoseAtomization(options={}) {
    const radius=Math.max(.01,finite(options.radius,24)),delay=Math.max(0,finite(options.atomizationDelay,0)),now=this.runtime.scheduler.time;
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent);
    const electrons=[...this.store.entities.values()].filter(e=>e.type==='lepton'&&e.properties.leptonKind==='electron'&&active(e)&&!e.parent);
    const readyByElement={},waitingByElement={};let mature=0,ready=0,nearestElectronDistance=Infinity;
    for(const isotope of isotopes){const age=now-finite(isotope.properties.formedAt,now);if(age<delay)continue;mature++;
      const z=Math.floor(finite(isotope.properties.atomicNumber,1)),symbol=ELEMENTS[z]?.[0]||String(z);
      let nearest=Infinity;for(const electron of electrons)nearest=Math.min(nearest,Math.hypot(finite(electron.properties.x)-finite(isotope.properties.x),finite(electron.properties.y)-finite(isotope.properties.y)));
      nearestElectronDistance=Math.min(nearestElectronDistance,nearest);
      if(nearest<=radius){ready++;readyByElement[symbol]=(readyByElement[symbol]||0)+1}else waitingByElement[symbol]=(waitingByElement[symbol]||0)+1;
    }
    return{radius,atomizationDelay:delay,matureIsotopes:mature,atomizableIsotopes:ready,waitingForElectrons:mature-ready,readyByElement,waitingByElement,freeElectrons:electrons.length,nearestElectronDistance:Number.isFinite(nearestElectronDistance)?nearestElectronDistance:null};
  },
  assembleAtomicMatter(options={}) {
    const hadrons=this.formHadrons({...options,radius:finite(options.hadronRadius,finite(options.radius,12))}),nuclei=this.formNuclei({...options,radius:finite(options.nuclearRadius,finite(options.radius,18)),maxNucleons:finite(options.maxNucleons,4),maxProtons:finite(options.maxProtons,2),smallNucleusFraction:finite(options.smallNucleusFraction,0)}),isotopes=this.formIsotopes(),accretions=this.accreteNucleons({...options,radius:finite(options.nuclearRadius,finite(options.radius,18)),maxAtomicNumber:finite(options.maxAccretionAtomicNumber,2),maxMassNumber:finite(options.maxAccretionMassNumber,4)}),atoms=this.formAtoms({...options,radius:finite(options.atomRadius,finite(options.radius,24))}),fusions=this.fuseIsotopes(options),elements=this.formElements();
    return{hadrons,nuclei,isotopes,accretions,fusions,atoms,elements};
  }
};
