import {clamp,finite,copy,idOf} from './shared.js';
const COMPLEMENT=Object.freeze({A:'U',U:'A',C:'G',G:'C'});
const CODONS=Object.freeze({
  UUU:'F',UUC:'F',UUA:'L',UUG:'L',UCU:'S',UCC:'S',UCA:'S',UCG:'S',UAU:'Y',UAC:'Y',UAA:'*',UAG:'*',UGU:'C',UGC:'C',UGA:'*',UGG:'W',
  CUU:'L',CUC:'L',CUA:'L',CUG:'L',CCU:'P',CCC:'P',CCA:'P',CCG:'P',CAU:'H',CAC:'H',CAA:'Q',CAG:'Q',CGU:'R',CGC:'R',CGA:'R',CGG:'R',
  AUU:'I',AUC:'I',AUA:'I',AUG:'M',ACU:'T',ACC:'T',ACA:'T',ACG:'T',AAU:'N',AAC:'N',AAA:'K',AAG:'K',AGU:'S',AGC:'S',AGA:'R',AGG:'R',
  GUU:'V',GUC:'V',GUA:'V',GUG:'V',GCU:'A',GCC:'A',GCA:'A',GCG:'A',GAU:'D',GAC:'D',GAA:'E',GAG:'E',GGU:'G',GGC:'G',GGA:'G',GGG:'G'
});
const HYDROPHOBIC=new Set(['A','V','I','L','M','F','W','Y']);
export const methods = {
  formChemicalBonds(options={}) {
    const types=new Set(options.types||['monomer']),radius=Math.max(.001,finite(options.radius,13));
    const rate=Math.max(0,finite(options.rate,.22)),dt=Math.max(0,finite(options.dt,1));
    const energyCost=Math.max(0,finite(options.energyCost,.0001)),activation=Math.max(0,finite(options.activationEnergy,.002));
    const profiles=new Map([[1,{valence:1,electronegativity:2.2,radius:2.1}],[2,{valence:0,electronegativity:0,radius:1.5}],[3,{valence:1,electronegativity:.98,radius:3.2}],[4,{valence:2,electronegativity:1.57,radius:2.5}],[5,{valence:3,electronegativity:2.04,radius:2.1}],[6,{valence:4,electronegativity:2.55,radius:1.9}],[7,{valence:3,electronegativity:3.04,radius:1.8}],[8,{valence:2,electronegativity:3.44,radius:1.7}],[9,{valence:1,electronegativity:3.98,radius:1.6}],[10,{valence:0,electronegativity:0,radius:1.5}]]);
    const entities=[...this.store.entities.values()].filter(e=>e.state==='active'&&!e.parent&&types.has(e.type));
    const atoms=entities.filter(e=>e.type==='atom'),monomers=entities.filter(e=>e.type==='monomer');
    const index=this.runtime.spatial.rebuild(entities),degree=new Map(entities.map(e=>[e.id,0]));
    for(const link of this.store.activeLinks)if(link.type==='bond'){if(degree.has(link.a))degree.set(link.a,degree.get(link.a)+Math.max(1,finite(link.properties?.order,1)));if(degree.has(link.b))degree.set(link.b,degree.get(link.b)+Math.max(1,finite(link.properties?.order,1)))}
    let formed=0;
    for(const a of entities) {
      const pa=a.properties,isAtom=a.type==='atom',profile=isAtom?(profiles.get(Math.floor(finite(pa.atomicNumber,0)))||{valence:0,electronegativity:0,radius:2}):null;
      const capacity=isAtom?profile.valence:Math.max(1,finite(pa.valence,2));
      if((degree.get(a.id)||0)>=capacity)continue;
      for(const b of index.query(pa.x,pa.y,radius,[])) {
        if(b.id<=a.id||!entities.includes(b)||a.type!==b.type)continue;
        const pb=b.properties,bProfile=isAtom?(profiles.get(Math.floor(finite(pb.atomicNumber,0)))||{valence:0,electronegativity:0,radius:2}):null;
        const bCapacity=isAtom?bProfile.valence:Math.max(1,finite(pb.valence,2));
        if((degree.get(b.id)||0)>=bCapacity||this.store.neighbours(a.id,'bond').includes(b.id)||(!isAtom&&(degree.get(a.id)||0)>0&&(degree.get(b.id)||0)>0))continue;
        if(isAtom&&(capacity===0||bCapacity===0))continue;
        if(!isAtom&&options.complementary!==false&&COMPLEMENT[pa.monomerKind]!==pb.monomerKind)continue;
        const dx=finite(pb.x)-finite(pa.x),dy=finite(pb.y)-finite(pa.y),distance=Math.hypot(dx,dy);
        if(distance>radius)continue;
        const za=Math.floor(finite(pa.atomicNumber)),zb=Math.floor(finite(pb.atomicNumber));
        const order=isAtom?((za===7&&zb===7)?3:((za===8&&zb===8)||(za===6&&zb===8)||(za===8&&zb===6)||(za===6&&zb===6)?2:1)):1;
        if((degree.get(a.id)||0)+order>capacity||(degree.get(b.id)||0)+order>bCapacity)continue;
        const affinity=isAtom?clamp(1-Math.abs(profile.electronegativity-bProfile.electronegativity)/5,.15,1):clamp(finite(pa.bondAffinity,1)*finite(pb.bondAffinity,1));
        const thermal=(Math.max(0,a.energy)/Math.max(.001,finite(pa.heatCapacity,1))+Math.max(0,b.energy)/Math.max(.001,finite(pb.heatCapacity,1)))*.5;
        const optimal=isAtom?profile.radius+bProfile.radius:radius*.55;
        const geometry=isAtom?Math.exp(-Math.pow((distance-optimal)/Math.max(2,optimal),2)):.7;
        const probability=1-Math.exp(-rate*affinity*geometry*Math.exp(-activation/Math.max(.02,thermal+.05))*dt);
        if(this.rng.next()>probability||a.energy<energyCost)continue;
        const electronegativityDelta=isAtom?Math.abs(profile.electronegativity-bProfile.electronegativity):0;
        const kind=isAtom?(electronegativityDelta>1.7?'ionic':electronegativityDelta>.8?'polar-covalent':'covalent'):'complementary';
        const result=this.store.transact([{op:'link',from:a.id,to:b.id,type:'bond',properties:{kind,order,distance,equilibriumDistance:optimal,electronegativityDelta,affinity,energy:energyCost}}],{energy:this.energy,fields:this.energy.fields});
        if(!result.ok)continue;
        if(energyCost>0&&a.energy>=energyCost)this.store.transact([{op:'dissipate',id:a.id,amount:energyCost}],{energy:this.energy,fields:this.energy.fields});
        degree.set(a.id,(degree.get(a.id)||0)+order);degree.set(b.id,(degree.get(b.id)||0)+order);
        if(isAtom)this.runtime.constraints.add({a:a.id,b:b.id,rest:optimal,stiffness:.62});
        this._record('bonding',{parents:[a.id,b.id],relation:'bond',properties:{kind,order,distance,electronegativityDelta,affinity}});
        formed++;
      }
    }
    return formed;
  },
  formMolecules(options={}) {
    const types=options.types||['particle'],min=Math.max(2,options.minSize||2),groups=this._bondComponents(types).filter(g=>g.length>=min);
    const names={'H2':'Hydrogen','O2':'Oxygen','N2':'Nitrogen','H2O':'Water','CO2':'Carbon dioxide','CH4':'Methane','NH3':'Ammonia','HCl':'Hydrogen chloride','NO':'Nitric oxide','C2H5NO2':'Glycine'};
    let formed=0;
    for(const ids of groups) {
      const members=ids.map(id=>this.store.get(id)).filter(Boolean);
      if(members.length<min)continue;
      const counts=new Map();
      for(const e of members){const symbol=e.properties.elementSymbol||({1:'H',2:'He',3:'Li',4:'Be',5:'B',6:'C',7:'N',8:'O',9:'F',10:'Ne'})[e.properties.atomicNumber]||'X';counts.set(symbol,(counts.get(symbol)||0)+1)}
      const order=[...counts.keys()].sort((x,y)=>(x==='C'?-2:x==='H'?-1:0)-(y==='C'?-2:y==='H'?-1:0)||x.localeCompare(y));
      const formula=order.map(symbol=>symbol+(counts.get(symbol)>1?counts.get(symbol):'')).join('');
      const mass=members.reduce((sum,e)=>sum+Math.max(0,finite(e.properties.mass,1)),0)||members.length;
      const x=members.reduce((sum,e)=>sum+finite(e.properties.x)*Math.max(0,finite(e.properties.mass,1)),0)/mass;
      const y=members.reduce((sum,e)=>sum+finite(e.properties.y)*Math.max(0,finite(e.properties.mass,1)),0)/mass;
      const bonds=this.store.activeLinks.filter(link=>link.type==='bond'&&ids.includes(link.a)&&ids.includes(link.b)).reduce((sum,link)=>sum+Math.max(1,finite(link.properties?.order,1)),0);
      const name=names[formula]||'Molecule';
      const productType=options.productType||'molecule';
      const properties={x,y,mass,formula,moleculeName:name,memberCount:ids.length,atomCount:members.length,bondCount:bonds,structure:members.map(e=>({element:e.properties.elementSymbol||e.properties.atomicNumber,atomicNumber:e.properties.atomicNumber,x:finite(e.properties.x)-x,y:finite(e.properties.y)-y})),geometry:members.length===2?'diatomic':'polyatomic',formedAt:this.runtime.scheduler.time,catalogueId:formula==='H2O'?'water':'molecular-structures',name,categoryId:'chemistry',catalogueColor:'#f0a66e'};
      const energy=members.reduce((sum,e)=>sum+Math.max(0,e.energy),0);
      const actions=[{op:'create',type:productType,properties,energy:0,as:'product'},...ids.map(id=>({op:'compose',parent:{ref:'product'},child:id}))];
      for(const e of members)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'product'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
      if(result.ok){formed++;this._record('molecular-formation',{parents:ids,children:[result.refs.product],formula,name,bondCount:bonds,geometry:properties.geometry,reaction:'association',energy})}
    }
    return formed;
  },
  polymerize(options={}){const types=options.monomerTypes||["monomer"],min=Math.max(2,options.minLength||3),groups=this._bondComponents(types).filter(g=>g.length>=min);let formed=0;for(const ids of groups){const monomers=ids.map(id=>this.store.get(id)).filter(Boolean),sequence=monomers.map(e=>e.properties.monomerKind||e.type),mass=monomers.reduce((s,e)=>s+finite(e.properties.mass,1),0),x=monomers.reduce((s,e)=>s+finite(e.properties.x),0)/monomers.length,y=monomers.reduce((s,e)=>s+finite(e.properties.y),0)/monomers.length;const energyCost=Math.max(0,finite(options.energyCost));if(energyCost>monomers[0].energy)continue;const actions=[{op:"create",type:"polymer",properties:{sequence,mass,x,y,length:ids.length,catalogueId:sequence.every(x=>['A','U','C','G'].includes(x))?'rna':'macromolecules',name:'Polymer',categoryId:'chemistry',catalogueColor:'#f0a66e'},as:"polymer"},...ids.map(id=>({op:"compose",parent:{ref:"polymer"},child:id}))];if(energyCost)actions.push({op:"dissipate",id:ids[0],amount:energyCost});for(const e of monomers){const available=Math.max(0,e.energy-(e.id===ids[0]?energyCost:0));if(available)actions.push({op:"transfer",from:e.id,to:{ref:"polymer"},amount:available})}const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(result.ok){formed++;this._record("polymerisation",{parents:ids,children:[result.refs.polymer],sequence,energyCost})}}return formed},
  assembleNucleobaseAnalogues(options={}) {
    const bases=[
      {kind:'A',formula:{6:2,1:2,7:2,8:1}},
      {kind:'U',formula:{6:2,1:2,7:1,8:2}},
      {kind:'C',formula:{6:2,1:3,7:2,8:1}},
      {kind:'G',formula:{6:2,1:2,7:2,8:2}}
    ],radius=Math.max(.1,finite(options.precursorRadius,80)),energyCost=Math.max(0,finite(options.precursorEnergyCost,.002));
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent),index=this.runtime.spatial.rebuild(atoms),used=new Set();let formed=0;
    for(const anchor of atoms.filter(e=>e.properties.atomicNumber===6)) {
      if(used.has(anchor.id)||anchor.parent)continue;
      const nearby=index.query(finite(anchor.properties.x),finite(anchor.properties.y),radius,[]).filter(e=>e.type==='atom'&&!e.parent&&!used.has(e.id)&&e.state==='active');
      const feasible=bases.filter(base=>Object.entries(base.formula).every(([z,n])=>nearby.filter(e=>e.properties.atomicNumber===Number(z)).length>=n));
      if(!feasible.length)continue;
      feasible.sort((a,b)=>(this._baseCounts?.[a.kind]||0)-(this._baseCounts?.[b.kind]||0));
      const least=feasible.filter(base=>(this._baseCounts?.[base.kind]||0)===(this._baseCounts?.[feasible[0].kind]||0));
      const chosen=least[this.rng.integer(least.length)];
      this._baseCounts??={};this._baseCounts[chosen.kind]=(this._baseCounts[chosen.kind]||0)+1;
      const members=[];
      for(const[z,n]of Object.entries(chosen.formula))members.push(...nearby.filter(e=>e.properties.atomicNumber===Number(z)&&!members.includes(e)).sort((a,b)=>Math.hypot(a.properties.x-anchor.properties.x,a.properties.y-anchor.properties.y)-Math.hypot(b.properties.x-anchor.properties.x,b.properties.y-anchor.properties.y)).slice(0,n));
      if(members.length!==Object.values(chosen.formula).reduce((a,b)=>a+b,0)||members.some(e=>used.has(e.id)))continue;
      const energy=members.reduce((sum,e)=>sum+Math.max(0,e.energy),0);if(energy<energyCost)continue;
      const mass=members.reduce((sum,e)=>sum+finite(e.properties.mass,1),0),x=members.reduce((sum,e)=>sum+finite(e.properties.x),0)/members.length,y=members.reduce((sum,e)=>sum+finite(e.properties.y),0)/members.length;
      const properties={x,y,mass,formula:Object.entries(chosen.formula).map(([z,n])=>({1:'H',6:'C',7:'N',8:'O'}[z])+n).join(''),monomerKind:chosen.kind,monomerFamily:'nucleobase-analogue',phosphate:false,ribose:false,valence:2,bondAffinity:.8,heatCapacity:Math.max(.1,mass*.1),catalogueId:'nucleotide-analogues',name:chosen.kind+' base analogue',categoryId:'chemistry',catalogueColor:'#f0a66e'};
      const actions=[{op:'create',type:'monomer',properties,energy:0,as:'monomer'},...members.map(e=>({op:'compose',parent:{ref:'monomer'},child:e.id}))];
      if(energyCost)actions.push({op:'dissipate',id:anchor.id,amount:energyCost});
      for(const e of members){const amount=Math.max(0,e.energy-(e.id===anchor.id?energyCost:0));if(amount)actions.push({op:'transfer',from:e.id,to:{ref:'monomer'},amount})}
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)continue;
      for(const e of members)used.add(e.id);
      this._record('nucleobase-analogue-formation',{parents:members.map(e=>e.id),children:[result.refs.monomer],base:chosen.kind,formula:properties.formula});formed++;
    }
    return formed;
  },
  assembleAmphiphiles(options={}) {
    const formula={6:2,1:4,8:1},radius=Math.max(.1,finite(options.precursorRadius,80)),energyCost=Math.max(0,finite(options.precursorEnergyCost,.002)),atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent),index=this.runtime.spatial.rebuild(atoms),used=new Set();let formed=0;
    for(const anchor of atoms.filter(e=>e.properties.atomicNumber===6)) {
      if(used.has(anchor.id)||anchor.parent)continue;
      const nearby=index.query(finite(anchor.properties.x),finite(anchor.properties.y),radius,[]).filter(e=>e.type==='atom'&&!e.parent&&!used.has(e.id)&&e.state==='active');
      if(!Object.entries(formula).every(([z,n])=>nearby.filter(e=>e.properties.atomicNumber===Number(z)).length>=n))continue;
      const members=[];for(const[z,n]of Object.entries(formula))members.push(...nearby.filter(e=>e.properties.atomicNumber===Number(z)&&!members.includes(e)).sort((a,b)=>Math.hypot(a.properties.x-anchor.properties.x,a.properties.y-anchor.properties.y)-Math.hypot(b.properties.x-anchor.properties.x,b.properties.y-anchor.properties.y)).slice(0,n));
      if(members.length!==7||members.some(e=>used.has(e.id)))continue;
      const energy=members.reduce((sum,e)=>sum+Math.max(0,e.energy),0);if(energy<energyCost)continue;
      const mass=members.reduce((sum,e)=>sum+finite(e.properties.mass,1),0),x=members.reduce((sum,e)=>sum+finite(e.properties.x),0)/members.length,y=members.reduce((sum,e)=>sum+finite(e.properties.y),0)/members.length;
      const properties={x,y,mass,formula:'C2H4O',amphiphilic:true,headPolarity:1,tailHydrophobicity:.9,tailLength:2,source:'fatty-acid-analogue',catalogueId:'lipids',name:'Short-chain amphiphile',categoryId:'selforg',catalogueColor:'#e58b9d'};
      const actions=[{op:'create',type:'lipid',properties,energy:0,as:'lipid'},...members.map(e=>({op:'compose',parent:{ref:'lipid'},child:e.id}))];
      if(energyCost)actions.push({op:'dissipate',id:anchor.id,amount:energyCost});
      for(const e of members){const amount=Math.max(0,e.energy-(e.id===anchor.id?energyCost:0));if(amount)actions.push({op:'transfer',from:e.id,to:{ref:'lipid'},amount})}
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)continue;
      for(const e of members)used.add(e.id);
      this._record('amphiphile-formation',{parents:members.map(e=>e.id),children:[result.refs.lipid],formula:'C2H4O'});formed++;
    }
    return formed;
  },
  formMonomerBackboneBonds(options={}) {
    const monomers=[...this.store.entities.values()].filter(e=>e.type==='monomer'&&e.state==='active'&&!e.parent),radius=Math.max(.01,finite(options.radius,18)),index=this.runtime.spatial.rebuild(monomers),degree=new Map(monomers.map(e=>[e.id,0])),parent=new Map(monomers.map(e=>[e.id,e.id]));
    const root=id=>{let p=parent.get(id);while(p!==parent.get(p))p=parent.get(p);let n=id;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next}return p};
    for(const edge of this.store.activeLinks)if(edge.type==='bond'&&degree.has(edge.a)&&degree.has(edge.b)){degree.set(edge.a,degree.get(edge.a)+1);degree.set(edge.b,degree.get(edge.b)+1);const a=root(edge.a),b=root(edge.b);if(a!==b)parent.set(a,b)}
    const pairs=[];for(const a of monomers)for(const b of index.query(finite(a.properties.x),finite(a.properties.y),radius,[]))if(b.id>a.id&&Math.hypot(finite(a.properties.x)-finite(b.properties.x),finite(a.properties.y)-finite(b.properties.y))<=radius&&!this.store.neighbours(a.id,'bond').includes(b.id))pairs.push({a,b,distance:Math.hypot(finite(a.properties.x)-finite(b.properties.x),finite(a.properties.y)-finite(b.properties.y))});
    pairs.sort((a,b)=>a.distance-b.distance||a.a.id-b.a.id||a.b.id-b.b.id);let formed=0;
    for(const pair of pairs){const{a,b,distance}=pair;if(degree.get(a.id)>=2||degree.get(b.id)>=2)continue;const ra=root(a.id),rb=root(b.id);if(ra===rb)continue;
      const affinity=clamp(finite(a.properties.bondAffinity,1)*finite(b.properties.bondAffinity,1)),thermal=(Math.max(0,a.energy)+Math.max(0,b.energy))*.5,probability=1-Math.exp(-Math.max(0,finite(options.rate,.12))*affinity*.7*Math.exp(-Math.max(0,finite(options.activationEnergy,.002))/Math.max(.02,thermal+.05))*Math.max(0,finite(options.dt,1)));
      const cost=Math.max(0,finite(options.energyCost,.0001));if(this.rng.next()>probability||a.energy<cost)continue;
      const result=this.store.transact([{op:'link',from:a.id,to:b.id,type:'bond',properties:{kind:'polymer-backbone',order:1,distance,energy:cost}}],{energy:this.energy,fields:this.energy.fields});if(!result.ok)continue;
      if(cost)this.store.transact([{op:'dissipate',id:a.id,amount:cost}],{energy:this.energy,fields:this.energy.fields});degree.set(a.id,degree.get(a.id)+1);degree.set(b.id,degree.get(b.id)+1);parent.set(ra,rb);
      this._record('bonding',{parents:[a.id,b.id],relation:'bond',properties:{kind:'polymer-backbone',distance}});formed++;
    }
    return formed;
  },
  advanceCatalyticNetworks(options={}) {
    const proteins=[...this.store.entities.values()].filter(e=>e.type==='protein'&&e.state==='active'&&!e.parent&&finite(e.properties.catalyticEfficiency)>=finite(options.minimumEfficiency,.25)),radius=Math.max(1,finite(options.radius,48));let formed=0;
    for(const protein of proteins){const rna=this.store.get(protein.properties.sourceRNA);if(!rna||rna.type!=='polymer'||rna.state!=='active'||rna.parent)continue;
      if(Math.hypot(finite(rna.properties.x)-finite(protein.properties.x),finite(rna.properties.y)-finite(protein.properties.y))>radius)continue;
      this.buildAutocatalyticNetwork({members:[protein.id,rna.id],cycleGain:1+finite(protein.properties.catalyticEfficiency)});formed++;
    }
    return formed;
  },
  advancePrebioticChemistry(options={}) {
    const monomers=this.assembleNucleobaseAnalogues(options),lipids=this.assembleAmphiphiles(options);
    const water=this.assembleWater(options),organic=this.assembleOrganicMolecules(options);
    const chemistry=this.assembleMolecularMatter(options);
    const monomerBonds=this.formMonomerBackboneBonds({radius:finite(options.monomerBondRadius,18),rate:finite(options.monomerBondRate,.12),dt:finite(options.dt,1),energyCost:finite(options.monomerBondEnergy,.0001),activationEnergy:finite(options.activationEnergy,.002)});
    const polymers=this.polymerize({minLength:Math.max(3,Math.floor(finite(options.minimumPolymerLength,6))),energyCost:finite(options.polymerEnergyCost,.0002)});
    const proteins=this.translateAllRNA({energyCost:finite(options.translationEnergyCost,.0001)});
    const networks=this.advanceCatalyticNetworks(options);
    const micelles=this.selfAssembleMicelles({radius:finite(options.assemblyRadius,18),minLipids:3,maxLipids:5});
    const membranes=this.selfAssembleMembranes({radius:finite(options.assemblyRadius,18),minLipids:6,permeability:finite(options.membranePermeability,.15)});
    const vesicles=this.formVesiclesFromMembranes(),protocells=this.formProtocellsFromAssemblies({radius:finite(options.protocellRadius,32)});
    return{monomers,lipids,water,organic,bonds:monomerBonds,polymers,proteins:proteins.length,networks,micelles,membranes,vesicles,protocells,chemistry};
  },
  translateRNA(rnaId,options={}) {
    const rna=this.store.get(rnaId);
    if(!rna||rna.type!=='polymer'||rna.parent)throw Error('Translation requires a free RNA polymer');
    if(this.store.outgoing(rna.id,'translates-to').length)return null;
    const sequence=Array.isArray(rna.properties.sequence)?rna.properties.sequence.join(''):String(rna.properties.sequence||'');
    if(sequence.length<6)return null;
    const aminoAcids=[],codons=[];
    for(let i=0;i+2<sequence.length;i+=3){const codon=sequence.slice(i,i+3),aa=CODONS[codon];if(!aa)continue;if(aa==='*'){if(aminoAcids.length>=2)break;continue;}codons.push(codon);aminoAcids.push(aa)}
    if(aminoAcids.length<2)return null;
    const hydrophobic=aminoAcids.filter(a=>HYDROPHOBIC.has(a)).length/aminoAcids.length,diversity=new Set(aminoAcids).size/aminoAcids.length;
    const folded={class:hydrophobic>.4?'globular':'extended',hydrophobicCore:hydrophobic,polarSurface:1-hydrophobic,compactness:clamp(.25+hydrophobic*.6),diversity};
    const x=finite(rna.properties.x),y=finite(rna.properties.y),mass=aminoAcids.length*.11,energyCost=Math.min(rna.energy,Math.max(0,finite(options.energyCost,aminoAcids.length*.001)));
    const properties={x,y,mass,sequence:aminoAcids.join(''),aminoAcids,codons,length:aminoAcids.length,folded,catalyticEfficiency:clamp(hydrophobic*.45+diversity*.35),bindingSites:Math.max(1,Math.floor(diversity*aminoAcids.length/4)),sourceRNA:rna.id,catalogueId:'proteins',name:'Protein',categoryId:'chemistry',catalogueColor:'#f0a66e'};
    const actions=[{op:'create',type:'protein',properties,energy:0,as:'protein'}];
    if(energyCost)actions.push({op:'dissipate',id:rna.id,amount:energyCost});
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
    this.store.defineRelation?.('translates-to',{direction:'directed'});
    this.store.link(rna.id,result.refs.protein,'translates-to',{codons:codons.length,aminoAcids:aminoAcids.length});
    const protein=this.store.get(result.refs.protein);this._record('translation',{parents:[rna.id],children:[protein.id],sequence:protein.properties.sequence,folded});return protein;
  },
  translateAllRNA(options={}) {
    const rnas=[...this.store.entities.values()].filter(e=>e.type==='polymer'&&e.state==='active'&&!e.parent),proteins=[];
    for(const rna of rnas){const protein=this.translateRNA(rna.id,options);if(protein)proteins.push(protein)}
    return proteins;
  },
  assembleWater(options={}) {
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent),oxygen=atoms.filter(e=>e.properties.atomicNumber===8),hydrogen=atoms.filter(e=>e.properties.atomicNumber===1);
    const radius=Math.max(.01,finite(options.radius,18));let formed=0;
    for(const o of oxygen){if(o.parent)continue;const hs=hydrogen.filter(h=>!h.parent&&Math.hypot(h.properties.x-o.properties.x,h.properties.y-o.properties.y)<=radius).sort((a,b)=>Math.hypot(a.properties.x-o.properties.x,a.properties.y-o.properties.y)-Math.hypot(b.properties.x-o.properties.x,b.properties.y-o.properties.y)).slice(0,2);if(hs.length<2)continue;
      const x=(o.properties.x+hs[0].properties.x+hs[1].properties.x)/3,y=(o.properties.y+hs[0].properties.y+hs[1].properties.y)/3,mass=o.properties.mass+hs.reduce((s,e)=>s+e.properties.mass,0),actions=[{op:'create',type:'water',properties:{x,y,mass,formula:'H2O',bondAngle:104.5,polar:true,dipole:1.85,hydrogenBondSites:2,catalogueId:'water',name:'Water',categoryId:'chemistry',catalogueColor:'#f0a66e'},energy:0,as:'water'},{op:'compose',parent:{ref:'water'},child:o.id},...hs.map(h=>({op:'compose',parent:{ref:'water'},child:h.id}))];
      for(const e of [o,...hs])if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'water'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this._record('water-formation',{parents:[o.id,...hs.map(h=>h.id)],children:[result.refs.water],formula:'H2O'});formed++;
    }
    return formed;
  },
  assembleOrganicMolecules(options={}) {
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent),radius=Math.max(.01,finite(options.radius,20));let formed=0;
    const available=number=>atoms.filter(e=>!e.parent&&e.properties.atomicNumber===number);
    while(available(6).length>=2&&available(1).length>=5&&available(7).length>=1&&available(8).length>=2) {
      const carbon=available(6).slice(0,2),hydrogen=available(1).slice(0,5),nitrogen=available(7)[0],oxygen=available(8).slice(0,2),members=[...carbon,...hydrogen,nitrogen,...oxygen];
      const x=members.reduce((s,e)=>s+e.properties.x,0)/members.length,y=members.reduce((s,e)=>s+e.properties.y,0)/members.length;
      if(members.some(e=>Math.hypot(e.properties.x-x,e.properties.y-y)>radius))break;
      const actions=[{op:'create',type:'organic-molecule',properties:{x,y,mass:members.reduce((s,e)=>s+e.properties.mass,0),formula:'C2H5NO2',moleculeName:'Glycine',functionalGroup:'amino-acid',atomCount:members.length,catalogueId:'organic-molecules',name:'Organic molecule',categoryId:'chemistry',catalogueColor:'#f0a66e'},energy:0,as:'molecule'},...members.map(e=>({op:'compose',parent:{ref:'molecule'},child:e.id}))];
      for(const e of members)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'molecule'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;
      this._record('organic-molecule-formation',{parents:members.map(e=>e.id),children:[result.refs.molecule],formula:'C2H5NO2',moleculeName:'Glycine'});formed++;
    }
    return formed;
  },
  buildAutocatalyticNetwork(spec={}) {
    const members=(spec.members||[]).map(idOf);
    if(members.length<2||members.some(id=>!this.store.get(id)))throw Error('An autocatalytic network requires at least two existing members');
    const parts=members.map(id=>this.store.get(id)),properties={memberCount:members.length,cycleGain:finite(spec.cycleGain,1),reactionIds:spec.reactionIds||[],x:parts.reduce((s,e)=>s+finite(e.properties.x),0)/parts.length,y:parts.reduce((s,e)=>s+finite(e.properties.y),0)/parts.length,catalogueId:'autocatalytic-networks',name:'Autocatalytic network',categoryId:'selforg',catalogueColor:'#e58b9d'};
    const actions=[{op:'create',type:'autocatalytic-network',properties,energy:0,as:'network'},...members.map(id=>({op:'compose',parent:{ref:'network'},child:id})),...members.map((id,i)=>({op:'link',from:id,to:members[(i+1)%members.length],type:'catalyses',properties:{cycle:true}}))];
    const result=this.store.transact(actions);if(!result.ok)throw result.error;
    const root=this.store.get(result.refs.network);this._record('autocatalytic-network',{parents:members,children:[root.id],cycleGain:root.properties.cycleGain});return root;
  },
  registerAutocatalysis(rule) {
    if(!rule?.id||!rule.inputs?.length||!rule.outputs?.length||!rule.catalysts?.length)throw Error('Autocatalysis needs inputs, outputs and at least one catalyst');
    return this.runtime.rules.register({...copy(rule),autocatalytic:true});
  },
  assembleMolecularMatter(options={}) {
    const elements=this.formElements();
    const bonds=this.formChemicalBonds({types:['atom'],radius:finite(options.bondRadius,13),rate:finite(options.bondRate,.22),dt:finite(options.dt,1),energyCost:finite(options.bondEnergyCost,.0001),activationEnergy:finite(options.activationEnergy,.002)});
    const molecules=this.formMolecules({types:['atom'],minSize:2});
    const proteins=this.translateAllRNA(options),complexes=this.assembleMacromolecularComplexes(options);
    const formed=[...this.store.entities.values()].filter(e=>e.type==='molecule'&&e.state==='active'&&!e.parent);
    const water=formed.filter(e=>e.properties.formula==='H2O').length;
    const organic=formed.filter(e=>(e.properties.formula||'').includes('C')).length;
    return{elements,bonds,molecules,water,organic,proteins:proteins.length,complexes};
  },
  assembleMacromolecularComplexes(options={}) {
    const rnas=[...this.store.entities.values()].filter(e=>e.type==='polymer'&&e.state==='active'&&!e.parent),proteins=[...this.store.entities.values()].filter(e=>e.type==='protein'&&e.state==='active'&&!e.parent),radius=Math.max(.01,finite(options.radius,28));let formed=0;
    for(const rna of rnas){const protein=proteins.find(p=>!p.parent&&Math.hypot(p.properties.x-rna.properties.x,p.properties.y-rna.properties.y)<=radius);if(!protein)continue;
      const actions=[{op:'create',type:'macromolecule',properties:{x:(rna.properties.x+protein.properties.x)/2,y:(rna.properties.y+protein.properties.y)/2,mass:finite(rna.properties.mass)+finite(protein.properties.mass),componentCount:2,complexType:'ribonucleoprotein',catalogueId:'macromolecules',name:'Macromolecular complex',categoryId:'chemistry',catalogueColor:'#f0a66e'},energy:0,as:'complex'},{op:'compose',parent:{ref:'complex'},child:rna.id},{op:'compose',parent:{ref:'complex'},child:protein.id}];
      const result=this.store.transact(actions);if(!result.ok)throw result.error;
      this._record('macromolecular-complex-formation',{parents:[rna.id,protein.id],children:[result.refs.complex]});formed++;
    }
    return formed;
  }
};
