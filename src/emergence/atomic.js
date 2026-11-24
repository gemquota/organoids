import {finite,active} from './shared.js';

const ELEMENTS={1:['H','Hydrogen'],2:['He','Helium'],3:['Li','Lithium'],4:['Be','Beryllium'],5:['B','Boron'],6:['C','Carbon'],7:['N','Nitrogen'],8:['O','Oxygen'],9:['F','Fluorine'],10:['Ne','Neon']};

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
    const nucleons=[...this.store.entities.values()].filter(e=>(e.type==='proton'||e.type==='neutron')&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,18)),index=this.runtime.spatial.rebuild(nucleons),adj=new Map(nucleons.map(e=>[e.id,[]]));
    for(const a of nucleons)for(const b of index.query(a.properties.x,a.properties.y,radius,[]))if(b.id>a.id&&Math.hypot(a.properties.x-b.properties.x,a.properties.y-b.properties.y)<=radius){adj.get(a.id).push(b.id);adj.get(b.id).push(a.id)}
    const seen=new Set();let formed=0;
    for(const nucleon of nucleons){if(seen.has(nucleon.id))continue;const group=[],stack=[nucleon.id];seen.add(nucleon.id);while(stack.length){const id=stack.pop();group.push(this.store.get(id));for(const next of adj.get(id)||[])if(!seen.has(next)){seen.add(next);stack.push(next)}}
      if(!group.some(e=>e.type==='proton'))continue;
      const protons=group.filter(e=>e.type==='proton').length,neutrons=group.length-protons,x=group.reduce((s,e)=>s+e.properties.x,0)/group.length,y=group.reduce((s,e)=>s+e.properties.y,0)/group.length,mass=group.reduce((s,e)=>s+finite(e.properties.mass,1),0);
      const actions=[{op:'create',type:'atomic-nucleus',properties:{x,y,mass,protonCount:protons,neutronCount:neutrons,atomicNumber:protons,massNumber:group.length,charge:protons,catalogueId:'atomic-nuclei',name:'Atomic nucleus',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'nucleus'},...group.map(e=>({op:'compose',parent:{ref:'nucleus'},child:e.id}))];
      for(const e of group)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'nucleus'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      for(const e of group)this.runtime.constraints.add({a:result.refs.nucleus,b:e.id,rest:Math.hypot(e.properties.x-x,e.properties.y-y),stiffness:.9});
      this._record('nuclear-binding',{parents:group.map(e=>e.id),children:[result.refs.nucleus],protonCount:protons,neutronCount:neutrons});formed++;
    }
    return formed;
  },

  accreteNucleons(options={}) {
    const radius=Math.max(.01,finite(options.accretionRadius,finite(options.radius,18)*.65));
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent);
    const free=[...this.store.entities.values()].filter(e=>(e.type==='proton'||e.type==='neutron')&&active(e)&&!e.parent);
    let accreted=0;
    for(const isotope of isotopes) {
      const nucleus=this.store.outgoing(isotope.id,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');
      if(!nucleus)continue;
      const candidate=free.filter(e=>!e.parent&&Math.hypot(e.properties.x-isotope.properties.x,e.properties.y-isotope.properties.y)<=radius)
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
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent);
    const used=new Set();let fused=0;
    for(let i=0;i<isotopes.length;i++) {
      const a=isotopes[i];if(used.has(a.id))continue;
      const nucleusA=this.store.outgoing(a.id,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');
      if(!nucleusA)continue;
      let best=null,bestDistance=Infinity,bestNucleus=null;
      for(let j=i+1;j<isotopes.length;j++) {
        const b=isotopes[j];if(used.has(b.id))continue;
        const nucleusB=this.store.outgoing(b.id,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');
        if(!nucleusB)continue;
        if(finite(nucleusA.properties.protonCount,1)<minFusionAtomicNumber&&finite(nucleusB.properties.protonCount,1)<minFusionAtomicNumber)continue;
        const dx=finite(b.properties.x)-finite(a.properties.x),dy=finite(b.properties.y)-finite(a.properties.y),d=Math.hypot(dx,dy);
        const relativeSpeed=Math.hypot(finite(b.properties.vx)-finite(a.properties.vx),finite(b.properties.vy)-finite(a.properties.vy));
        if(d>radius||relativeSpeed>maxSpeed||d>=bestDistance)continue;
        best=b;bestNucleus=nucleusB;bestDistance=d;
      }
      if(!best)continue;
      const nucleusB=bestNucleus,protonCount=finite(nucleusA.properties.protonCount)+finite(nucleusB.properties.protonCount);
      const neutronCount=finite(nucleusA.properties.neutronCount)+finite(nucleusB.properties.neutronCount);
      if(protonCount<1||protonCount>maxAtomicNumber)continue;
      const mass=finite(a.properties.mass)+finite(best.properties.mass);
      const x=(finite(a.properties.x)*finite(a.properties.mass)+finite(best.properties.x)*finite(best.properties.mass))/Math.max(.001,mass);
      const y=(finite(a.properties.y)*finite(a.properties.mass)+finite(best.properties.y)*finite(best.properties.mass))/Math.max(.001,mass);
      const isotopeProperties={x,y,mass,protonCount,neutronCount,atomicNumber:protonCount,massNumber:protonCount+neutronCount,charge:protonCount,formedAt:this.runtime.scheduler.time,catalogueId:'isotopes',name:'Isotope',categoryId:'atoms',catalogueColor:'#d6c18b'};
      const actions=[
        {op:'create',type:'atomic-nucleus',properties:{...isotopeProperties,name:'Fused atomic nucleus',catalogueId:'atomic-nuclei',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'nucleus'},
        {op:'unlink',from:a.id,to:nucleusA.id,type:'contains'},
        {op:'unlink',from:best.id,to:nucleusB.id,type:'contains'},
        {op:'remove',id:a.id},{op:'remove',id:best.id},
        {op:'compose',parent:{ref:'nucleus'},child:nucleusA.id},
        {op:'compose',parent:{ref:'nucleus'},child:nucleusB.id},
        {op:'create',type:'isotope',properties:isotopeProperties,energy:0,as:'isotope'},
        {op:'compose',parent:{ref:'isotope'},child:{ref:'nucleus'}}
      ];
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
      if(!result.ok)throw result.error;
      this.runtime.constraints.add({a:result.refs.nucleus,b:nucleusA.id,rest:Math.max(1,bestDistance/2),stiffness:.7});
      this.runtime.constraints.add({a:result.refs.nucleus,b:nucleusB.id,rest:Math.max(1,bestDistance/2),stiffness:.7});
      this._record('nuclear-fusion',{parents:[a.id,best.id],children:[result.refs.isotope],protonCount,neutronCount,massNumber:protonCount+neutronCount});
      used.add(a.id);used.add(best.id);fused++;
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
      const valenceElectrons=({1:1,2:2,3:1,4:2,5:3,6:4,7:5,8:6,9:7,10:8})[atomicNumber]??0,maxCovalentBonds=({1:1,2:0,3:1,4:2,5:3,6:4,7:3,8:2,9:1,10:0})[atomicNumber]??0,electronegativity=({1:2.2,2:0,3:.98,4:1.57,5:2.04,6:2.55,7:3.04,8:3.44,9:3.98,10:0})[atomicNumber]??0;
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

  assembleAtomicMatter(options={}) {
    const hadrons=this.formHadrons({...options,radius:finite(options.hadronRadius,finite(options.radius,12))}),nuclei=this.formNuclei({...options,radius:finite(options.nuclearRadius,finite(options.radius,18))}),isotopes=this.formIsotopes(),accretions=this.accreteNucleons({...options,radius:finite(options.nuclearRadius,finite(options.radius,18))}),fusions=this.fuseIsotopes(options),atoms=this.formAtoms({...options,radius:finite(options.atomRadius,finite(options.radius,24))}),elements=this.formElements();
    return{hadrons,nuclei,isotopes,accretions,fusions,atoms,elements};
  }
};
