import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveWorldScale,scaleDistance,scaleVelocity} from '../src/emergence/scaling.js';
import {constrainCamera} from '../src/emergence/camera.js';
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

test('camera zoom stays between world-fit and native 1x scale',()=>{
 const camera=constrainCamera({scale:4,minScale:.1,maxScale:1,worldWidth:1000,worldHeight:600,viewWidth:400,viewHeight:300});
 assert.equal(camera.scale,1);
 const fit=constrainCamera({scale:.01,minScale:.4,maxScale:1,worldWidth:1000,worldHeight:600,viewWidth:400,viewHeight:300});
 assert.equal(fit.scale,.4);
 assert.equal(fit.x,0);
 assert.equal(fit.y,30);
});
test('camera panning cannot expose space beyond world edges',()=>{
 const camera=constrainCamera({x:500,y:-500,scale:1,minScale:.4,maxScale:1,worldWidth:1000,worldHeight:600,viewWidth:400,viewHeight:300});
 assert.deepEqual(camera,{x:-600,y:-300,scale:1});
 const centered=constrainCamera({x:-500,y:500,scale:.4,minScale:.4,maxScale:1,worldWidth:1000,worldHeight:600,viewWidth:400,viewHeight:300});
 assert.equal(centered.x,0);
 assert.equal(centered.y,30);
});
