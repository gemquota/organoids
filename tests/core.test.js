const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('accretion.html','utf8');
function core(){
  const start=html.indexOf('const G=(()=>{');
  const end=html.indexOf('})();',start)+5;
  assert.ok(start>=0&&end>start,'GolfCore block must exist');
  const sandbox={};
  vm.runInNewContext(html.slice(start,end)+'\nglobalThis.G=G;',sandbox);
  return sandbox.G;
}

test('entities carry identity, type and extensible payload',()=>{
  const G=core(),e=G.entity('a','particle',{mass:2,extra:{tag:1}});
  assert.equal(e.id,'a');
  assert.equal(e.type,'particle');
  assert.equal(e.state.mass,2);
  assert.equal(e.state.extra.tag,1);
});

test('relations preserve generic endpoints and relation kinds',()=>{
  const G=core();
  G.relate('a','contains','b');
  assert.equal(JSON.stringify(G.relations),'[["a","contains","b"]]');
});

test('declarative rules stage effects and commit them',()=>{
  const G=core(),e=G.entity('a','particle',{x:4});
  G.when('particle',x=>x.type==='particle');
  G.then('advance',x=>({e:x,patch:{x:x.state.x+3}}));
  G.rule(0,'particle','advance');
  G.run([e]);
  assert.equal(e.state.x,7);
});

test('rule phases execute in ascending order',()=>{
  const G=core(),e=G.entity('a','particle',{v:0});
  G.when('yes',()=>true);
  G.then('add1',x=>({e:x,patch:{v:x.state.v+1}}));
  G.then('add10',x=>({e:x,patch:{v:x.state.v+10}}));
  G.rule(10,'yes','add10');
  G.rule(0,'yes','add1');
  G.run([e]);
  assert.equal(e.state.v,11);
});

test('invalid transactions make no partial changes',()=>{
  const G=core(),a=G.entity('a','p',{x:1}),b=G.entity('b','p',{x:2});
  assert.equal(G.commit([a],[{e:a,patch:{x:9}},{e:b,patch:{x:8}}]),false);
  assert.equal(a.state.x,1);
  assert.equal(b.state.x,2);
});

test('duplicate writes to one entity in a transaction are rejected',()=>{
  const G=core(),a=G.entity('a','p',{x:1});
  assert.equal(G.commit([a],[{e:a,patch:{x:2}},{e:a,patch:{y:3}}]),false);
  assert.deepEqual({...a.state},{x:1});
});

test('removal is committed with the transaction',()=>{
  const G=core(),a=G.entity('a','p',{x:1}),b=G.entity('b','p',{x:2}),items=[a,b];
  assert.equal(G.commit(items,[{e:a,patch:{x:3}},{e:b,remove:true}]),true);
  assert.equal(a.state.x,3);
  assert.deepEqual(items.map(x=>x.id),['a']);
});
