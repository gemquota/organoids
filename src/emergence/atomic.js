import {finite,active} from './shared.js';

const ELEMENTS={1:['H','Hydrogen'],2:['He','Helium'],3:['Li','Lithium'],4:['Be','Beryllium'],5:['B','Boron'],6:['C','Carbon'],7:['N','Nitrogen'],8:['O','Oxygen'],9:['F','Fluorine'],10:['Ne','Neon']};

export const methods={
  formHadrons(options={}) {
    const quarks=[...this.store.entities.values()].filter(e=>e.type==='quark'&&active(e)&&!e.parent),gluons=[...this.store.entities.values()].filter(e=>e.type==='gluon'&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,12)),index=this.runtime.spatial.rebuild(quarks),used=new Set();
    let protonCount=[...this.store.entities.values()].filter(e=>e.type==='proton'&&active(e)).length,neutronCount=[...this.store.entities.values()].filter(e=>e.type==='neutron'&&active(e)).length;
    const cellSize=radius,buckets=new Map(),key=(x,y)=>Math.floor(x/cellSize)+':'+Math.floor(y/cellSize);
    for(const gluon of gluons){const k=key(finite(gluon.properties.x),finite(gluon.properties.y));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(gluon)}
    const nearbyGluons=(x,y)=>{const out=[];const cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const g of buckets.get((cx+dx)+':'+(cy+dy))||[])if(Math.hypot(finite(g.properties.x)-x,finite(g.properties.y)-y)<=radius){out.push(g);if(out.length===2)return out}return out};
    const plans=[];
    for(const anchor of quarks){
      if(used.has(anchor.id)||anchor.parent)continue;
      const candidates=index.query(finite(anchor.properties.x),finite(anchor.properties.y),radius,[]).filter(q=>q.id!==anchor.id&&!used.has(q.id)&&!q.parent&&active(q));
      const pools={red:{up:null,down:null},green:{up:null,down:null},blue:{up:null,down:null}};
      for(const q of candidates){const color=q.properties.colorCharge,flavor=q.properties.flavor;if(!pools[color]||!(flavor in pools[color])||color===anchor.properties.colorCharge)continue;const d=Math.hypot(finite(q.properties.x)-finite(anchor.properties.x),finite(q.properties.y)-finite(anchor.properties.y));const bucket=pools[color][flavor];if(!bucket||d<bucket.d)pools[color][flavor]={q,d}}
      const colors=['red','green','blue'].filter(c=>c!==anchor.properties.colorCharge);if(colors.length!==2)continue;
      const preferred=protonCount<=neutronCount?'proton':'neutron',types=[preferred,preferred==='proton'?'neutron':'proton'];let best=null;
      for(const type of types){const requiredUp=type==='proton'?2:1,requiredDown=3-requiredUp,upLeft=requiredUp-(anchor.properties.flavor==='up'?1:0),downLeft=requiredDown-(anchor.properties.flavor==='down'?1:0);if(upLeft<0||downLeft<0||upLeft+downLeft!==2)continue;
        const assignments=upLeft===2?[["up","up"]]:downLeft===2?[["down","down"]]:[["up","down"],["down","up"]];
        for(const flavors of assignments){const first=pools[colors[0]][flavors[0]],second=pools[colors[1]][flavors[1]];if(!first||!second)continue;const triple=[anchor,first.q,second.q],distances=[first.d,second.d,Math.hypot(finite(first.q.properties.x)-finite(second.q.properties.x),finite(first.q.properties.y)-finite(second.q.properties.y))];if(Math.max(...distances)>radius)continue;const score=distances.reduce((sum,d)=>sum+d*d,0)+(type===preferred?0:radius*radius*.01);if(!best||score<best.score)best={triple,type,score}}
        if(best)break;
      }
      if(!best)continue;
      const triple=best.triple,up=triple.filter(q=>q.properties.flavor==='up').length,down=3-up,x=triple.reduce((sum,e)=>sum+finite(e.properties.x),0)/3,y=triple.reduce((sum,e)=>sum+finite(e.properties.y),0)/3,type=up===2?'proton':'neutron',charge=up*2/3-down/3,mass=triple.reduce((sum,e)=>sum+finite(e.properties.mass,1),0),ref='hadron'+plans.length,localGluons=nearbyGluons(x,y);
      plans.push({triple,type,x,y,charge,mass,ref,gluons:localGluons});for(const q of triple)used.add(q.id);if(type==='proton')protonCount++;else neutronCount++;
    }
    if(!plans.length)return 0;
    const actions=[];
    for(const plan of plans){actions.push({op:'create',type:plan.type,properties:{x:plan.x,y:plan.y,mass:plan.mass,charge:plan.charge,quarkCount:3,colorNeutral:true,catalogueId:'protons-neutrons',name:plan.type==='proton'?'Proton':'Neutron',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:plan.ref},...plan.triple.map(q=>({op:'compose',parent:{ref:plan.ref},child:q.id})));for(const q of plan.triple)if(q.energy>0)actions.push({op:'transfer',from:q.id,to:{ref:plan.ref},amount:q.energy});for(const gluon of plan.gluons)actions.push({op:'link',from:{ref:plan.ref},to:gluon.id,type:'exchanges',properties:{interaction:'strong',mediator:true}})}
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields,deferEdges:true});if(!result.ok)throw result.error;
    for(const plan of plans){const id=result.refs[plan.ref];for(const q of plan.triple)this.runtime.constraints.add({a:id,b:q.id,rest:Math.hypot(finite(q.properties.x)-plan.x,finite(q.properties.y)-plan.y),stiffness:.8});this._record('hadron-formation',{parents:plan.triple.map(q=>q.id),children:[id],kind:plan.type,charge:plan.charge,gluons:plan.gluons.map(g=>g.id)})}
    return plans.length;
  },
  formNuclei(options={}) {
    if(!options.partitionNuclei){
      const nucleons=[...this.store.entities.values()].filter(e=>(e.type==='proton'||e.type==='neutron')&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,18)),index=this.runtime.spatial.rebuild(nucleons),adj=new Map(nucleons.map(e=>[e.id,[]]));
      for(const a of nucleons)for(const b of index.query(a.properties.x,a.properties.y,radius,[]))if(b.id>a.id&&Math.hypot(a.properties.x-b.properties.x,a.properties.y-b.properties.y)<=radius){adj.get(a.id).push(b.id);adj.get(b.id).push(a.id)}
      const seen=new Set();let formed=0;
      for(const nucleon of nucleons){if(seen.has(nucleon.id))continue;const group=[],stack=[nucleon.id];seen.add(nucleon.id);while(stack.length){const id=stack.pop();group.push(this.store.get(id));for(const next of adj.get(id)||[])if(!seen.has(next)){seen.add(next);stack.push(next)}}
        if(group.length<2||!group.some(e=>e.type==='proton'))continue;
        const protons=group.filter(e=>e.type==='proton').length,neutrons=group.length-protons,x=group.reduce((sum,e)=>sum+e.properties.x,0)/group.length,y=group.reduce((sum,e)=>sum+e.properties.y,0)/group.length,mass=group.reduce((sum,e)=>sum+finite(e.properties.mass,1),0);
        const actions=[{op:'create',type:'atomic-nucleus',properties:{x,y,mass,protonCount:protons,neutronCount:neutrons,atomicNumber:protons,massNumber:group.length,charge:protons,catalogueId:'atomic-nuclei',name:'Atomic nucleus',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'nucleus'},...group.map(e=>({op:'compose',parent:{ref:'nucleus'},child:e.id}))];
        for(const e of group)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'nucleus'},amount:e.energy});
        const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields,deferEdges:true});if(!result.ok)throw result.error;
        for(const e of group)this.runtime.constraints.add({a:result.refs.nucleus,b:e.id,rest:Math.hypot(e.properties.x-x,e.properties.y-y),stiffness:.9});
        this._record('nuclear-binding',{parents:group.map(e=>e.id),children:[result.refs.nucleus],protonCount:protons,neutronCount:neutrons});formed++;
      }
      return formed;
    }
    const protons=[...this.store.entities.values()].filter(e=>e.type==='proton'&&active(e)&&!e.parent),
      neutrons=[...this.store.entities.values()].filter(e=>e.type==='neutron'&&active(e)&&!e.parent),
      radius=Math.max(.01,finite(options.radius,18)),index=this.runtime.spatial.rebuild([...protons,...neutrons]),
      used=new Set(),weights=options.elementWeights||[[1,.4],[6,.26],[7,.12],[8,.22]],plans=[];
    const chooseAtomicNumber=()=>{const total=weights.reduce((n,[,w])=>n+Math.max(0,finite(w)),0);let pick=this.rng.next()*total;for(const[z,w]of weights){pick-=Math.max(0,finite(w));if(pick<=0)return z}return weights.at(-1)?.[0]||1};
    for(const anchor of protons){
      if(used.has(anchor.id)||anchor.parent)continue;
      const nearby=index.query(finite(anchor.properties.x),finite(anchor.properties.y),radius,[])
        .filter(e=>!used.has(e.id)&&!e.parent&&active(e));
      const localProtons=nearby.filter(e=>e.type==='proton').sort((a,b)=>Math.hypot(a.properties.x-anchor.properties.x,a.properties.y-anchor.properties.y)-Math.hypot(b.properties.x-anchor.properties.x,b.properties.y-anchor.properties.y));
      const localNeutrons=nearby.filter(e=>e.type==='neutron').sort((a,b)=>Math.hypot(a.properties.x-anchor.properties.x,a.properties.y-anchor.properties.y)-Math.hypot(b.properties.x-anchor.properties.x,b.properties.y-anchor.properties.y));
      const preferred=chooseAtomicNumber(),candidates=[preferred,1,2,6,7,8].filter((z,i,list)=>list.indexOf(z)===i).sort((a,b)=>a===preferred?-1:b===preferred?1:0);
      let group=null;
      for(const target of candidates){if(localProtons.length<target||localNeutrons.length<target)continue;group=[...localProtons.slice(0,target),...localNeutrons.slice(0,target)];break}
      if(!group){if(!localNeutrons.length)continue;group=[anchor,localNeutrons[0]]}
      const protonsInGroup=group.filter(e=>e.type==='proton').length,neutronsInGroup=group.length-protonsInGroup;
      if(!protonsInGroup)continue;
      const x=group.reduce((sum,e)=>sum+finite(e.properties.x),0)/group.length,y=group.reduce((sum,e)=>sum+finite(e.properties.y),0)/group.length,mass=group.reduce((sum,e)=>sum+finite(e.properties.mass,1),0),ref='nucleus'+plans.length;
      const properties={x,y,mass,protonCount:protonsInGroup,neutronCount:neutronsInGroup,atomicNumber:protonsInGroup,massNumber:group.length,charge:protonsInGroup,catalogueId:'atomic-nuclei',name:'Atomic nucleus',categoryId:'particles',catalogueColor:'#a5b5ce'};
      plans.push({group,x,y,ref,properties});for(const e of group)used.add(e.id);
    }
    if(!plans.length)return 0;
    const actions=[];
    for(const plan of plans){actions.push({op:'create',type:'atomic-nucleus',properties:plan.properties,energy:0,as:plan.ref},...plan.group.map(e=>({op:'compose',parent:{ref:plan.ref},child:e.id})));for(const e of plan.group)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:plan.ref},amount:e.energy})}
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields,deferEdges:true});if(!result.ok)throw result.error;
    for(const plan of plans){const id=result.refs[plan.ref];for(const e of plan.group)this.runtime.constraints.add({a:id,b:e.id,rest:Math.hypot(e.properties.x-plan.x,e.properties.y-plan.y),stiffness:.9});this._record('nuclear-binding',{parents:plan.group.map(e=>e.id),children:[id],protonCount:plan.properties.protonCount,neutronCount:plan.properties.neutronCount,atomicNumber:plan.properties.atomicNumber})}
    return plans.length;
  },

  formIsotopes() {
    const nuclei=[...this.store.entities.values()].filter(e=>e.type==='atomic-nucleus'&&active(e)&&!e.parent),plans=[],actions=[];
    for(const nucleus of nuclei){const ref='isotope'+plans.length,properties={x:finite(nucleus.properties.x),y:finite(nucleus.properties.y),atomicNumber:nucleus.properties.atomicNumber,neutronCount:nucleus.properties.neutronCount,massNumber:nucleus.properties.massNumber,charge:nucleus.properties.charge,catalogueId:'isotopes',name:'Isotope',categoryId:'atoms',catalogueColor:'#d6c18b'};plans.push({nucleus,ref,properties});actions.push({op:'create',type:'isotope',properties,energy:0,as:ref},{op:'compose',parent:{ref},child:nucleus.id});if(nucleus.energy>0)actions.push({op:'transfer',from:nucleus.id,to:{ref},amount:nucleus.energy})}
    if(!plans.length)return 0;const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields,deferEdges:true});if(!result.ok)throw result.error;
    for(const plan of plans)this._record('isotope-formation',{parents:[plan.nucleus.id],children:[result.refs[plan.ref]],massNumber:plan.properties.massNumber});return plans.length;
  },

  formAtoms(options={}) {
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent),electrons=[...this.store.entities.values()].filter(e=>e.type==='lepton'&&e.properties.leptonKind==='electron'&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,24)),used=new Set(),plans=[],actions=[];
    for(const isotope of isotopes){const count=Math.max(1,Math.floor(finite(isotope.properties.atomicNumber,1))),near=electrons.filter(e=>!e.parent&&!used.has(e.id)&&Math.hypot(e.properties.x-isotope.properties.x,e.properties.y-isotope.properties.y)<=radius).sort((a,b)=>Math.hypot(a.properties.x-isotope.properties.x,a.properties.y-isotope.properties.y)-Math.hypot(b.properties.x-isotope.properties.x,b.properties.y-isotope.properties.y)).slice(0,count);
      if(near.length<count)continue;const nucleus=this.store.descendants(isotope.id).map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');if(!nucleus)continue;
      const element=ELEMENTS[isotope.properties.atomicNumber]||['X','Unknown'],x=finite(isotope.properties.x),y=finite(isotope.properties.y),mass=finite(isotope.properties.mass,finite(nucleus.properties.mass,1))+near.length*.0005,atomicNumber=isotope.properties.atomicNumber,valenceElectrons=({1:1,2:2,3:1,4:2,5:3,6:4,7:5,8:6,9:7,10:8})[atomicNumber]??0,maxCovalentBonds=({1:1,2:0,3:1,4:2,5:3,6:4,7:3,8:2,9:1,10:0})[atomicNumber]??0,electronegativity=({1:2.2,2:0,3:.98,4:1.57,5:2.04,6:2.55,7:3.04,8:3.44,9:3.98,10:0})[atomicNumber]??0,ref='atom'+plans.length;
      const properties={x,y,mass,atomicNumber,protonCount:atomicNumber,neutronCount:isotope.properties.neutronCount,massNumber:isotope.properties.massNumber,electronCount:near.length,charge:atomicNumber-near.length,valenceElectrons,valence:maxCovalentBonds,maxCovalentBonds,electronegativity,elementSymbol:element[0],elementName:element[1],catalogueId:'atoms',name:element[1]+' atom',categoryId:'atoms',catalogueColor:'#d6c18b'};
      plans.push({isotope,near,ref,properties});actions.push({op:'create',type:'atom',properties,energy:0,as:ref},{op:'compose',parent:{ref},child:isotope.id},...near.map(e=>({op:'compose',parent:{ref},child:e.id})));for(const e of [isotope,...near])if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref},amount:e.energy});for(const e of near)used.add(e.id);
    }
    if(!plans.length)return 0;const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields,deferEdges:true});if(!result.ok)throw result.error;
    for(const plan of plans)this._record('atom-formation',{parents:[plan.isotope.id,...plan.near.map(e=>e.id)],children:[result.refs[plan.ref]],element:plan.properties.elementName,atomicNumber:plan.properties.atomicNumber});return plans.length;
  },

  formElements() {
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&active(e)),groups=new Map();for(const atom of atoms){const key=atom.properties.atomicNumber;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(atom)}
    this.store.defineRelation?.('classifies',{direction:'directed'});let formed=0;const actions=[],plans=[];
    for(const[number,members]of groups){const info=ELEMENTS[number]||['X','Unknown'];let element=[...this.store.entities.values()].find(e=>e.type==='element'&&e.properties.atomicNumber===number),target,ref=null;
      if(!element){const x=members.reduce((sum,e)=>sum+e.properties.x,0)/members.length,y=members.reduce((sum,e)=>sum+e.properties.y,0)/members.length,properties={x,y,atomicNumber:number,symbol:info[0],elementName:info[1],atomCount:0,catalogueId:'elements',name:info[1],categoryId:'atoms',catalogueColor:'#d6c18b'};ref='element'+number;target={ref};actions.push({op:'create',type:'element',properties,energy:0,as:ref});formed++;plans.push({members,number,info,ref,created:true})}else{target=element.id;plans.push({members,number,info,element,created:false})}
      const linked=new Set(element?this.store.neighbours(element.id,'classifies'):[]);for(const atom of members)if(!linked.has(atom.id))actions.push({op:'link',from:target,to:atom.id,type:'classifies',properties:{atomicNumber:number,symbol:info[0]}});actions.push({op:'set',id:target,key:'atomCount',value:members.length});
    }
    const result=actions.length?this.store.transact(actions,{energy:this.energy,fields:this.energy.fields,deferEdges:true}):null;if(result&&!result.ok)throw result.error;
    for(const plan of plans)if(plan.created)this._record('element-formation',{parents:plan.members.map(e=>e.id),children:[result.refs[plan.ref]],atomicNumber:plan.number,symbol:plan.info[0]});
    return formed;
  },

  assembleAtomicMatter(options={}) {
    const hadrons=this.formHadrons(options),nuclei=this.formNuclei(options),isotopes=this.formIsotopes(),atoms=this.formAtoms(options),elements=this.formElements();
    return{hadrons,nuclei,isotopes,atoms,elements};
  }
};
