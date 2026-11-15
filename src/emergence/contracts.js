import {freeze,copy} from './shared.js';
export class ContractRegistry {
  constructor(){this.schemas=new Map()}
  define(type,schema){if(!type||!schema||typeof schema!=="object")throw Error("A named schema is required");this.schemas.set(type,freeze(copy(schema)));return this}
  validate(type,properties={}){const schema=this.schemas.get(type);if(!schema)return{ok:true,errors:[]};const errors=[];for(const [key,spec] of Object.entries(schema)){const value=properties[key];if(value===undefined){if(spec.required)errors.push(key+" is required");continue}if(spec.type){const actual=Array.isArray(value)?"array":value===null?"null":typeof value;if(actual!==spec.type)errors.push(key+" must be "+spec.type)}if(typeof value==="number"&&!Number.isFinite(value))errors.push(key+" must be finite");if(typeof value==="number"&&Number.isFinite(spec.min)&&value<spec.min)errors.push(key+" is below minimum");if(typeof value==="number"&&Number.isFinite(spec.max)&&value>spec.max)errors.push(key+" exceeds maximum");if(spec.enum&&!spec.enum.includes(value))errors.push(key+" is not an allowed value")}return{ok:errors.length===0,errors}}
  defaults(type,properties={}){const schema=this.schemas.get(type)||{},out={};for(const [key,spec]of Object.entries(schema))if(spec.default!==undefined)out[key]=copy(spec.default);return Object.assign(out,copy(properties))}
  assert(type,properties){const result=this.validate(type,properties);if(!result.ok)throw Error("Invalid "+type+": "+result.errors.join(", "));return true}
}

export class ModuleContractRegistry {
  constructor(){this.modules=new Map()}
  register(name,contract){if(!name||typeof contract?.prepare!=="function")throw Error("A module needs a name and prepare function");if(this.modules.has(name))throw Error("Duplicate module "+name);this.modules.set(name,{phase:0,requires:[],reads:[],writes:[],...contract,name,order:this.modules.size});return this}
  validate(runtime){const errors=[],owners=new Map();for(const m of this.modules.values()){for(const service of m.requires)if(!runtime[service])errors.push(m.name+" requires runtime."+service);for(const key of m.writes){if(owners.has(key))errors.push("Conflicting state ownership for "+key+": "+owners.get(key).name+" and "+m.name);else owners.set(key,m)}}return{ok:!errors.length,errors}}
  ordered(){return[...this.modules.values()].sort((a,b)=>a.phase-b.phase||a.order-b.order)}
}
