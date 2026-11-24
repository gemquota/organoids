import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync(new URL('../accretion.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
test('simulation exposes a compact searchable selector for all guide entities',()=>{assert.match(html,/id="entityToggle"/);assert.match(html,/id="entityPanel"/);assert.match(html,/id="entitySearch"/);assert.match(html,/id="entityArtwork"/);assert.match(html,/BUILD PATHWAY/);assert.match(html,/SEED ALL 49/);assert.match(script,/CATALOGUE_ENTITIES/);assert.match(script,/buildCataloguePathway/);assert.match(script,/catalogueColor/);});
test('simulation inline module parses',()=>{const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout)});
