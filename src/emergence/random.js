export class SeededRandom {
  constructor(seed=1){this.state=(Number(seed)>>>0)||1}
  next(){let t=this.state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
  integer(max){return Math.floor(this.next()*max)}
  snapshot(){return this.state>>>0}
  restore(state){this.state=Number(state)>>>0;return this}
}
