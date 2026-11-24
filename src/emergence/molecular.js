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
    const types=new Set(options.types||['monomer']),radius=Math.max(.001,finite(options.radius,10));
    const rate=Math.max(0,finite(options.rate,.2)),dt=Math.max(0,finite(options.dt,1));
    const energyCost=Math.max(0,finite(options.energyCost,.001)),complementary=options.complementary!==false;
    const entities=[...this.store.entities.values()].filter(e=>e.state==='active'&&!e.parent&&types.has(e.type));
    const index=this.runtime.spatial.rebuild(entities),degree=new Map(entities.map(e=>[e.id,this.store.neighbours(e.id,'bond').length]));
    let formed=0;
    for(const a of entities) {
      if((degree.get(a.id)||0)>=Math.max(1,finite(a.properties.valence,2)))continue;
      const pa=a.properties;
      for(const b of index.query(pa.x,pa.y,radius,[])) {
        if(b.id<=a.id||!entities.includes(b)||(degree.get(b.id)||0)>=Math.max(1,finite(b.properties.valence,2)))continue;
        if(complementary&&COMPLEMENT[pa.monomerKind]!==b.properties.monomerKind)continue;
        const dx=b.properties.x-pa.x,dy=b.properties.y-pa.y,d=Math.hypot(dx,dy);
        if(d>radius||this.store.neighbours(a.id,'bond').includes(b.id)||((degree.get(a.id)||0)>0&&(degree.get(b.id)||0)>0))continue;
        const affinity=clamp(finite(pa.bondAffinity,1)*finite(b.properties.bondAffinity,1));
        const temperature=(a.energy/Math.max(.001,finite(pa.heatCapacity,1))+b.energy/Math.max(.001,finite(b.properties.heatCapacity,1)))*.5;
        const activation=Math.max(0,finite(options.activationEnergy,.01));
        const probability=1-Math.exp(-rate*affinity*Math.exp(-activation/Math.max(.02,temperature))*dt);
        if(this.rng.next()>probability||a.energy<energyCost)continue;
        const actions=[{op:'link',from:a.id,to:b.id,type:'bond',properties:{kind:complementary?'complementary':'covalent',distance:d,affinity}}];
        if(energyCost)actions.push({op:'dissipate',id:a.id,amount:energyCost});
        const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
        if(!result.ok)continue;
        degree.set(a.id,(degree.get(a.id)||0)+1);degree.set(b.id,(degree.get(b.id)||0)+1);
        this._record('bonding',{parents:[a.id,b.id],relation:'bond',properties:{kind:complementary?'complementary':'covalent',distance:d,affinity}});
        formed++;
      }
    }
    return formed;
  },
  formMolecules(options={}){const types=options.types||["particle"],min=Math.max(2,options.minSize||2),groups=this._bondComponents(types).filter(g=>g.length>=min);let formed=0;for(const ids of groups){const members=ids.map(id=>this.store.get(id)).filter(Boolean),mass=members.reduce((s,e)=>s+Math.max(0,finite(e.properties.mass,1)),0)||members.length,energy=members.reduce((s,e)=>s+Math.max(0,e.energy),0),x=members.reduce((s,e)=>s+finite(e.properties.x)*Math.max(0,finite(e.properties.mass,1)),0)/mass,y=members.reduce((s,e)=>s+finite(e.properties.y)*Math.max(0,finite(e.properties.mass,1)),0)/mass;const actions=[{op:"create",type:options.productType||"molecule",properties:{x,y,mass,memberCount:ids.length,formedAt:this.runtime.scheduler.time},energy:0,as:"product"}];for(const id of ids)actions.push({op:"compose",parent:{ref:"product"},child:id});if(energy>0)for(const e of members)if(e.energy>0)actions.push({op:"transfer",from:e.id,to:{ref:"product"},amount:e.energy});const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(result.ok){formed++;this._record("molecular-formation",{parents:ids,children:[result.refs.product],mass,energy})}}return formed},
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
  assembleMolecularMatter(options={}) {
    const elements=this.formElements(),water=this.assembleWater(options),organic=this.assembleOrganicMolecules(options),proteins=this.translateAllRNA(options),complexes=this.assembleMacromolecularComplexes(options);
    return{elements,water,organic,proteins:proteins.length,complexes};
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
