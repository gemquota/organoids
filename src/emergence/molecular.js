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
    const index=this.runtime.spatial.rebuild(entities),degree=new Map(entities.map(e=>[e.id,0])),roots=new Map(entities.map(e=>[e.id,e.id]));
    const findRoot=id=>{let root=id;while(roots.has(root)&&roots.get(root)!==root)root=roots.get(root);return root};
    const join=(a,b)=>{const ra=findRoot(a),rb=findRoot(b);if(ra!==rb)roots.set(ra,rb)};
    for(const link of this.store.activeLinks)if(link.type==='bond'){if(degree.has(link.a))degree.set(link.a,degree.get(link.a)+Math.max(1,finite(link.properties?.order,1)));if(degree.has(link.b))degree.set(link.b,degree.get(link.b)+Math.max(1,finite(link.properties?.order,1)));if(roots.has(link.a)&&roots.has(link.b))join(link.a,link.b)}
    let formed=0;
    for(const a of entities) {
      const pa=a.properties,isAtom=a.type==='atom',profile=isAtom?(profiles.get(Math.floor(finite(pa.atomicNumber,0)))||{valence:0,electronegativity:0,radius:2}):null;
      const capacity=isAtom?profile.valence:Math.max(1,finite(pa.valence,2));
      if((degree.get(a.id)||0)>=capacity)continue;
      const candidates=index.query(pa.x,pa.y,radius,[]);
      if(!isAtom)candidates.sort((left,right)=>Math.hypot(finite(left.properties.x)-finite(pa.x),finite(left.properties.y)-finite(pa.y))-Math.hypot(finite(right.properties.x)-finite(pa.x),finite(right.properties.y)-finite(pa.y)));
      for(const b of candidates) {
        if((isAtom&&b.id<=a.id)||b.id===a.id||!entities.includes(b)||a.type!==b.type)continue;
        const pb=b.properties,bProfile=isAtom?(profiles.get(Math.floor(finite(pb.atomicNumber,0)))||{valence:0,electronegativity:0,radius:2}):null;
        const bCapacity=isAtom?bProfile.valence:Math.max(1,finite(pb.valence,2));
        if((degree.get(b.id)||0)>=bCapacity||this.store.neighbours(a.id,'bond').includes(b.id))continue;
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
        degree.set(a.id,(degree.get(a.id)||0)+order);degree.set(b.id,(degree.get(b.id)||0)+order);if(!isAtom)join(a.id,b.id);
        if(isAtom)this.runtime.constraints.add({a:a.id,b:b.id,rest:optimal,stiffness:.62});
        this._record('bonding',{parents:[a.id,b.id],relation:'bond',properties:{kind,order,distance,electronegativityDelta,affinity}});
        formed++;
        if(!isAtom)break;
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
  translateRNA(rnaId,options={}) {
    const rna=this.store.get(rnaId);
    if(!rna||rna.type!=='polymer'||rna.parent)throw Error('Translation requires a free RNA polymer');
    if(this.store.outgoing(rna.id,'translates-to').length)return null;
    const sequence=Array.isArray(rna.properties.sequence)?rna.properties.sequence.join(''):String(rna.properties.sequence||'');
    if(sequence.length<6)return null;
    const aminoAcids=[],codons=[];
    for(let i=0;i+2<sequence.length;i+=3){const codon=sequence.slice(i,i+3),aa=CODONS[codon];if(!aa)continue;if(aa==='*')break;codons.push(codon);aminoAcids.push(aa)}
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
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent);
    const radius=Math.max(.01,finite(options.radius,20)),used=new Set();
    const available=number=>atoms.filter(e=>!e.parent&&!used.has(e.id)&&e.properties.atomicNumber===number);
    const nearest=(pool,x,y,count)=>pool.slice().sort((a,b)=>Math.hypot(finite(a.properties.x)-x,finite(a.properties.y)-y)-Math.hypot(finite(b.properties.x)-x,finite(b.properties.y)-y)).slice(0,count);
    let formed=0;
    for(const anchor of available(6)) {
      if(anchor.parent||used.has(anchor.id))continue;
      const ax=finite(anchor.properties.x),ay=finite(anchor.properties.y);
      const carbon=nearest(available(6).filter(e=>e.id!==anchor.id),ax,ay,1);
      if(!carbon.length||Math.hypot(finite(carbon[0].properties.x)-ax,finite(carbon[0].properties.y)-ay)>radius)continue;
      const nitrogen=nearest(available(7),ax,ay,1);
      const oxygen=nearest(available(8),ax,ay,2);
      if(!nitrogen.length||oxygen.length<2)continue;
      const core=[anchor,...carbon,...nitrogen,...oxygen];
      const cx=core.reduce((sum,e)=>sum+finite(e.properties.x),0)/core.length;
      const cy=core.reduce((sum,e)=>sum+finite(e.properties.y),0)/core.length;
      const hydrogen=nearest(available(1),cx,cy,5);
      if(hydrogen.length<5)continue;
      const members=[...core,...hydrogen],x=members.reduce((sum,e)=>sum+finite(e.properties.x),0)/members.length,y=members.reduce((sum,e)=>sum+finite(e.properties.y),0)/members.length;
      if(members.some(e=>Math.hypot(finite(e.properties.x)-x,finite(e.properties.y)-y)>radius))continue;
      const mass=members.reduce((sum,e)=>sum+Math.max(0,finite(e.properties.mass)),0);
      const actions=[{op:'create',type:'organic-molecule',properties:{x,y,mass,formula:'C2H5NO2',moleculeName:'Glycine',functionalGroup:'amino-acid',atomCount:members.length,catalogueId:'organic-molecules',name:'Organic molecule',categoryId:'chemistry',catalogueColor:'#f0a66e'},energy:0,as:'molecule'},...members.map(e=>({op:'compose',parent:{ref:'molecule'},child:e.id}))];
      for(const e of members)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'molecule'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
      if(!result.ok)continue;
      for(const e of members)used.add(e.id);
      this._record('organic-molecule-formation',{parents:members.map(e=>e.id),children:[result.refs.molecule],formula:'C2H5NO2',moleculeName:'Glycine'});formed++;
    }
    return formed;
  },
  assembleNucleobaseMonomers(options={}) {
    const recipes=[
      {kind:'A',name:'Adenine analogue',formula:'C5H5N5',counts:{6:5,1:5,7:5,8:0}},
      {kind:'U',name:'Uracil analogue',formula:'C4H4N2O2',counts:{6:4,1:4,7:2,8:2}},
      {kind:'C',name:'Cytosine analogue',formula:'C4H5N3O',counts:{6:4,1:5,7:3,8:1}},
      {kind:'G',name:'Guanine analogue',formula:'C5H5N5O',counts:{6:5,1:5,7:5,8:1}}
    ];
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent);
    const radius=Math.max(.01,finite(options.radius,20)),used=new Set();
    const available=number=>atoms.filter(e=>!e.parent&&!used.has(e.id)&&e.properties.atomicNumber===number);
    const nearest=(pool,x,y,count)=>count?pool.slice().sort((a,b)=>Math.hypot(finite(a.properties.x)-x,finite(a.properties.y)-y)-Math.hypot(finite(b.properties.x)-x,finite(b.properties.y)-y)).slice(0,count):[];
    let formed=0;
    for(const recipe of recipes) {
      for(const anchor of available(6)) {
        if(anchor.parent||used.has(anchor.id))continue;
        const ax=finite(anchor.properties.x),ay=finite(anchor.properties.y),counts=recipe.counts;
        const members=[anchor,...nearest(available(6).filter(e=>e.id!==anchor.id),ax,ay,counts[6]-1),...nearest(available(1),ax,ay,counts[1]),...nearest(available(7),ax,ay,counts[7]),...nearest(available(8),ax,ay,counts[8])];
        if(members.length!==Object.values(counts).reduce((sum,n)=>sum+n,0))continue;
        const x=members.reduce((sum,e)=>sum+finite(e.properties.x),0)/members.length,y=members.reduce((sum,e)=>sum+finite(e.properties.y),0)/members.length;
        if(members.some(e=>Math.hypot(finite(e.properties.x)-x,finite(e.properties.y)-y)>radius))continue;
        const mass=members.reduce((sum,e)=>sum+Math.max(0,finite(e.properties.mass)),0);
        const actions=[{op:'create',type:'monomer',properties:{x,y,mass,monomerKind:recipe.kind,valence:2,bondAffinity:.8,baseName:recipe.name,formula:recipe.formula,polymerRole:'nucleobase-analogue',phosphateGroups:0,sugarBackbone:false,catalogueId:'nucleobases',name:'Nucleobase analogue',categoryId:'chemistry',catalogueColor:'#f0a66e'},energy:0,as:'monomer'},...members.map(e=>({op:'compose',parent:{ref:'monomer'},child:e.id}))];
        for(const e of members)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'monomer'},amount:e.energy});
        const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
        if(!result.ok)continue;
        for(const e of members)used.add(e.id);
        this._record('nucleobase-analogue-formation',{parents:members.map(e=>e.id),children:[result.refs.monomer],kind:recipe.kind,formula:recipe.formula});formed++;
      }
    }
    return formed;
  },
  assembleAutocatalyticNetworks(options={}) {
    const proteins=[...this.store.entities.values()].filter(e=>e.type==='protein'&&e.state==='active'&&!e.parent);
    const radius=Math.max(.01,finite(options.radius,24)),minimum=clamp(finite(options.minimumCatalyticEfficiency,.2)),index=this.runtime.spatial.rebuild(proteins),used=new Set();
    let formed=0;
    for(const protein of proteins) {
      if(protein.parent||used.has(protein.id)||finite(protein.properties.catalyticEfficiency)<minimum)continue;
      const partner=index.query(protein.properties.x,protein.properties.y,radius,[]).filter(e=>e.id!==protein.id&&!e.parent&&!used.has(e.id)&&finite(e.properties.catalyticEfficiency)>=minimum).sort((a,b)=>Math.hypot(finite(a.properties.x)-finite(protein.properties.x),finite(a.properties.y)-finite(protein.properties.y))-Math.hypot(finite(b.properties.x)-finite(protein.properties.x),finite(b.properties.y)-finite(protein.properties.y)))[0];
      if(!partner)continue;
      const network=this.buildAutocatalyticNetwork({members:[protein.id,partner.id],cycleGain:1+Math.min(.5,(finite(protein.properties.catalyticEfficiency)+finite(partner.properties.catalyticEfficiency))*.25)});
      used.add(protein.id);used.add(partner.id);formed++;
      this._record('catalytic-pairing',{parents:[protein.id,partner.id],children:[network.id],cycleGain:network.properties.cycleGain});
    }
    return formed;
  },
  assembleAmphiphiles(options={}) {
    const atoms=[...this.store.entities.values()].filter(e=>e.type==='atom'&&e.state==='active'&&!e.parent);
    const radius=Math.max(.01,finite(options.radius,20)),used=new Set();
    const available=number=>atoms.filter(e=>!e.parent&&!used.has(e.id)&&e.properties.atomicNumber===number);
    const nearest=(pool,x,y,count)=>pool.slice().sort((a,b)=>Math.hypot(finite(a.properties.x)-x,finite(a.properties.y)-y)-Math.hypot(finite(b.properties.x)-x,finite(b.properties.y)-y)).slice(0,count);
    let formed=0;
    for(const anchor of available(6)) {
      if(anchor.parent||used.has(anchor.id))continue;
      const ax=finite(anchor.properties.x),ay=finite(anchor.properties.y);
      const carbon=[anchor,...nearest(available(6).filter(e=>e.id!==anchor.id),ax,ay,7)];
      const oxygen=nearest(available(8),ax,ay,2);
      if(carbon.length<8||oxygen.length<2)continue;
      const core=[...carbon,...oxygen],cx=core.reduce((sum,e)=>sum+finite(e.properties.x),0)/core.length,cy=core.reduce((sum,e)=>sum+finite(e.properties.y),0)/core.length;
      const hydrogen=nearest(available(1),cx,cy,16);
      if(hydrogen.length<16)continue;
      const members=[...core,...hydrogen],x=members.reduce((sum,e)=>sum+finite(e.properties.x),0)/members.length,y=members.reduce((sum,e)=>sum+finite(e.properties.y),0)/members.length;
      if(members.some(e=>Math.hypot(finite(e.properties.x)-x,finite(e.properties.y)-y)>radius))continue;
      const mass=members.reduce((sum,e)=>sum+Math.max(0,finite(e.properties.mass)),0);
      const actions=[{op:'create',type:'lipid',properties:{x,y,mass,formula:'C8H16O2',moleculeName:'Octanoic acid',amphiphileKind:'fatty-acid',headPolarity:.9,tailHydrophobicity:.95,hydrophobicTailLength:7,catalogueId:'lipids',name:'Fatty-acid amphiphile',categoryId:'selforg',catalogueColor:'#e58b9d'},energy:0,as:'lipid'},...members.map(e=>({op:'compose',parent:{ref:'lipid'},child:e.id}))];
      for(const e of members)if(e.energy>0)actions.push({op:'transfer',from:e.id,to:{ref:'lipid'},amount:e.energy});
      const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
      if(!result.ok)continue;
      for(const e of members)used.add(e.id);
      this._record('lipid-synthesis',{parents:members.map(e=>e.id),children:[result.refs.lipid],formula:'C8H16O2',amphiphileKind:'fatty-acid'});formed++;
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
    // Specific low-complexity products compete for free atoms before the
    // general bond pass can lock those atoms into arbitrary aggregates.
    // Larger organic products claim their atoms before simpler water
    // association, so water formation cannot starve more complex pathways.
    const lipids=this.assembleAmphiphiles({radius:finite(options.amphiphileRadius,finite(options.radius,20))});
    const organic=this.assembleOrganicMolecules({radius:finite(options.organicRadius,finite(options.radius,20))});
    const monomers=this.assembleNucleobaseMonomers({radius:finite(options.monomerRadius,finite(options.radius,20))});
    const water=this.assembleWater({radius:finite(options.waterRadius,finite(options.radius,18))});
    const monomerBonds=this.formChemicalBonds({types:['monomer'],radius:finite(options.bondRadius,13),rate:finite(options.bondRate,.22),dt:finite(options.dt,1),energyCost:finite(options.bondEnergyCost,.0001),activationEnergy:finite(options.activationEnergy,.002)});
    const polymers=this.polymerize({monomerTypes:['monomer'],minLength:3,energyCost:finite(options.polymerEnergyCost,.002)});
    const bonds=this.formChemicalBonds({types:['atom'],radius:finite(options.bondRadius,13),rate:finite(options.bondRate,.22),dt:finite(options.dt,1),energyCost:finite(options.bondEnergyCost,.0001),activationEnergy:finite(options.activationEnergy,.002)});
    const molecules=this.formMolecules({types:['atom'],minSize:2});
    const proteins=this.translateAllRNA(options),networks=this.assembleAutocatalyticNetworks(options),complexes=this.assembleMacromolecularComplexes(options);
    return{elements,bonds,monomerBonds,molecules,water,organic,lipids,monomers,polymers,proteins:proteins.length,networks,complexes};
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
