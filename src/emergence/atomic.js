import {finite,active} from './shared.js';

const ELEMENTS={1:['H','Hydrogen'],2:['He','Helium'],3:['Li','Lithium'],4:['Be','Beryllium'],5:['B','Boron'],6:['C','Carbon'],7:['N','Nitrogen'],8:['O','Oxygen'],9:['F','Fluorine'],10:['Ne','Neon']};

export const methods={
  formHadrons(options={}) {
    const quarks=[...this.store.entities.values()].filter(e=>e.type==='quark'&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,12)),groups=new Map();
    for(const q of quarks){const key=q.properties.baryonGroup??'default';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q)}
    let formed=0;
    for(const members of groups.values()) {
      const used=new Set(),colors=['red','green','blue'];
      while(true) {
        const triple=colors.map(color=>members.find(q=>!used.has(q.id)&&q.properties.colorCharge===color));
        if(triple.some(q=>!q))break;
        const x=triple.reduce((s,e)=>s+finite(e.properties.x),0)/3,y=triple.reduce((s,e)=>s+finite(e.properties.y),0)/3;
        if(Math.max(...triple.map(e=>Math.hypot(e.properties.x-x,e.properties.y-y)))>radius)break;
        const up=triple.filter(q=>q.properties.flavor==='up').length,down=triple.filter(q=>q.properties.flavor==='down').length;
        if(!((up===2&&down===1)||(up===1&&down===2))){for(const q of triple)used.add(q.id);continue}
        const type=up===2?'proton':'neutron',charge=up*2/3-down/3,mass=triple.reduce((s,e)=>s+finite(e.properties.mass,1),0);
        const gluons=[...this.store.entities.values()].filter(e=>e.type==='gluon'&&active(e)&&!e.parent&&(e.properties.baryonGroup===undefined||e.properties.baryonGroup===triple[0].properties.baryonGroup)&&Math.hypot(e.properties.x-x,e.properties.y-y)<=radius).slice(0,2);
        const actions=[{op:'create',type,properties:{x,y,mass,charge,quarkCount:3,colorNeutral:true,catalogueId:'protons-neutrons',name:type==='proton'?'Proton':'Neutron',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'hadron'},...triple.map(q=>({op:'compose',parent:{ref:'hadron'},child:q.id}))];
        for(const q of triple)if(q.energy>0)actions.push({op:'transfer',from:q.id,to:{ref:'hadron'},amount:q.energy});
        for(const gluon of gluons)actions.push({op:'link',from:{ref:'hadron'},to:gluon.id,type:'exchanges',properties:{interaction:'strong',mediator:true}});
        const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
        for(const q of triple)used.add(q.id);
        for(const q of triple)this.runtime.constraints.add({a:result.refs.hadron,b:q.id,rest:Math.hypot(q.properties.x-x,q.properties.y-y),stiffness:.8});
        this._record('hadron-formation',{parents:triple.map(q=>q.id),children:[result.refs.hadron],kind:type,charge,gluons:gluons.map(g=>g.id)});
        formed++;
      }
    }
    return formed;
  },

  formNuclei(options={}) {
    const nucleons=[...this.store.entities.values()].filter(e=>(e.type==='proton'||e.type==='neutron')&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,18)),index=this.runtime.spatial.rebuild(nucleons),adj=new Map(nucleons.map(e=>[e.id,[]]));
    for(const a of nucleons)for(const b of index.query(a.properties.x,a.properties.y,radius,[]))if(b.id>a.id&&Math.hypot(a.properties.x-b.properties.x,a.properties.y-b.properties.y)<=radius){adj.get(a.id).push(b.id);adj.get(b.id).push(a.id)}
    const seen=new Set();let formed=0;
    for(const nucleon of nucleons){if(seen.has(nucleon.id))continue;const group=[],stack=[nucleon.id];seen.add(nucleon.id);while(stack.length){const id=stack.pop();group.push(this.store.get(id));for(const next of adj.get(id)||[])if(!seen.has(next)){seen.add(next);stack.push(next)}}
      if(group.length<2||!group.some(e=>e.type==='proton'))continue;
      const protons=group.filter(e=>e.type==='proton').length,neutrons=group.length-protons,x=group.reduce((s,e)=>s+e.properties.x,0)/group.length,y=group.reduce((s,e)=>s+e.properties.y,0)/group.length,mass=group.reduce((s,e)=>s+finite(e.properties.mass,1),0);
      const actions=[{op:'create',type:'atomic-nucleus',properties:{x,y,mass,protonCount:protons,neutronCount:neutrons,atomicNumber:protons,massNumber:group.length,charge:protons,catalogueId:'atomic-nuclei',name:'Atomic nucleus',categoryId:'particles',catalogueColor:'#a5b5ce'},energy:0,as:'nucleus'},...group.map(e=>({op:'compose',parent:{ref:'nucleus'},child:e.id}))];
      for(const e of group)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'nucleus'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      for(const e of group)this.runtime.constraints.add({a:result.refs.nucleus,b:e.id,rest:Math.hypot(e.properties.x-x,e.properties.y-y),stiffness:.9});
      this._record('nuclear-binding',{parents:group.map(e=>e.id),children:[result.refs.nucleus],protonCount:protons,neutronCount:neutrons});formed++;
    }
    return formed;
  },

  formIsotopes() {
    const nuclei=[...this.store.entities.values()].filter(e=>e.type==='atomic-nucleus'&&active(e)&&!e.parent);let formed=0;
    for(const nucleus of nuclei){const properties={x:finite(nucleus.properties.x),y:finite(nucleus.properties.y),atomicNumber:nucleus.properties.atomicNumber,neutronCount:nucleus.properties.neutronCount,massNumber:nucleus.properties.massNumber,charge:nucleus.properties.charge,catalogueId:'isotopes',name:'Isotope',categoryId:'atoms',catalogueColor:'#d6c18b'};
      const actions=[{op:'create',type:'isotope',properties,energy:0,as:'isotope'},{op:'compose',parent:{ref:'isotope'},child:nucleus.id}];if(nucleus.energy>0)actions.push({op:'transfer',from:nucleus.id,to:{ref:'isotope'},amount:nucleus.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this._record('isotope-formation',{parents:[nucleus.id],children:[result.refs.isotope],massNumber:properties.massNumber});formed++;
    }
    return formed;
  },

  formAtoms(options={}) {
    const isotopes=[...this.store.entities.values()].filter(e=>e.type==='isotope'&&active(e)&&!e.parent),electrons=[...this.store.entities.values()].filter(e=>e.type==='lepton'&&e.properties.leptonKind==='electron'&&active(e)&&!e.parent),radius=Math.max(.01,finite(options.radius,24));let formed=0;
    for(const isotope of isotopes){const count=Math.max(1,Math.floor(finite(isotope.properties.atomicNumber,1))),near=electrons.filter(e=>!e.parent&&Math.hypot(e.properties.x-isotope.properties.x,e.properties.y-isotope.properties.y)<=radius).sort((a,b)=>Math.hypot(a.properties.x-isotope.properties.x,a.properties.y-isotope.properties.y)-Math.hypot(b.properties.x-isotope.properties.x,b.properties.y-isotope.properties.y)).slice(0,count);
      if(near.length<count)continue;
      const nucleus=this.store.descendants(isotope.id).map(id=>this.store.get(id)).find(e=>e?.type==='atomic-nucleus');if(!nucleus)continue;
      const element=ELEMENTS[isotope.properties.atomicNumber]||['X','Unknown'],x=finite(isotope.properties.x),y=finite(isotope.properties.y),mass=finite(isotope.properties.mass,finite(nucleus.properties.mass,1))+near.length*.0005;
      const properties={x,y,mass,atomicNumber:isotope.properties.atomicNumber,protonCount:isotope.properties.atomicNumber,neutronCount:isotope.properties.neutronCount,massNumber:isotope.properties.massNumber,electronCount:near.length,charge:isotope.properties.atomicNumber-near.length,elementSymbol:element[0],elementName:element[1],catalogueId:'atoms',name:element[1]+' atom',categoryId:'atoms',catalogueColor:'#d6c18b'};
      const actions=[{op:'create',type:'atom',properties,energy:0,as:'atom'},{op:'compose',parent:{ref:'atom'},child:isotope.id},...near.map(e=>({op:'compose',parent:{ref:'atom'},child:e.id}))];
      for(const e of [isotope,...near])if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'atom'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this._record('atom-formation',{parents:[isotope.id,...near.map(e=>e.id)],children:[result.refs.atom],element:element[1],atomicNumber:properties.atomicNumber});formed++;
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
    const hadrons=this.formHadrons(options),nuclei=this.formNuclei(options),isotopes=this.formIsotopes(),atoms=this.formAtoms(options),elements=this.formElements();
    return{hadrons,nuclei,isotopes,atoms,elements};
  }
};
