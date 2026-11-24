import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveWorldScale,scaleDistance,scaleVelocity} from '../src/emergence/scaling.js';
test('world scale follows the square root of the world-area ratio',()=>{
 assert.equal(deriveWorldScale(1000,500,100,50),10);
 assert.equal(deriveWorldScale(200,100,100,50),2);
 assert.equal(deriveWorldScale(100,50,100,50),1);
});
test('interaction distances and movement scale linearly',()=>{
 assert.equal(scaleDistance(16,10),160);
 assert.equal(scaleVelocity(.12,10),1.2);
});
test('scale is bounded and invalid dimensions are safe',()=>{
 assert.equal(deriveWorldScale(0,0,0,0),1);
 assert.equal(deriveWorldScale(1e9,1e9,1,1),100);
 assert.equal(scaleDistance(-5,10),0);
});
