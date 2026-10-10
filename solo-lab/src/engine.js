// KS training rules v0.1. Deliberately simplified, independent of rendering.
export const PACK = 'ks-basic-0.2';
export const TEMPLATES = [
  {id:'intercessors',side:0,name:'Intercessor Squad',role:'BATTLELINE',points:80,models:5,wounds:2,move:6,range:24,attacks:2,hit:3,strength:4,toughness:4,save:3,ap:1,damage:1,leadership:6,oc:2,weapon:'Bolt rifle',melee:{name:'Close combat weapon',attacks:3,hit:3,strength:4,ap:0,damage:1}},
  {id:'heavy-intercessors',side:0,name:'Heavy Intercessor Squad',role:'BATTLELINE',points:100,models:5,wounds:3,move:5,range:30,attacks:2,hit:3,strength:5,toughness:6,save:3,ap:1,damage:2,leadership:6,oc:2,weapon:'Heavy bolt rifle',melee:{name:'Close combat weapon',attacks:3,hit:3,strength:4,ap:0,damage:1}},
  {id:'hellblasters',side:0,name:'Hellblaster Squad',role:'INFANTRY',points:110,models:5,wounds:2,move:6,range:24,attacks:2,hit:3,strength:7,toughness:4,save:3,ap:2,damage:1,leadership:6,oc:1,weapon:'Plasma incinerator',melee:{name:'Close combat weapon',attacks:3,hit:3,strength:4,ap:0,damage:1}},
  {id:'boyz',side:1,name:'Boyz',role:'BATTLELINE',points:85,models:10,wounds:1,move:6,range:12,attacks:1,hit:5,strength:4,toughness:5,save:5,ap:0,damage:1,leadership:7,oc:2,weapon:'Slugga',melee:{name:'Choppa',attacks:3,hit:3,strength:5,ap:1,damage:1}},
  {id:'nobz',side:1,name:'Nobz',role:'INFANTRY',points:115,models:5,wounds:3,move:6,range:12,attacks:1,hit:5,strength:4,toughness:5,save:4,ap:0,damage:1,leadership:7,oc:1,weapon:'Slugga',melee:{name:'Big choppa',attacks:4,hit:3,strength:7,ap:1,damage:2}},
  {id:'shoota-boyz',side:1,name:'Boyz · shootas',role:'BATTLELINE',points:85,models:10,wounds:1,move:6,range:18,attacks:2,hit:5,strength:4,toughness:5,save:5,ap:0,damage:1,leadership:7,oc:2,weapon:'Shoota',melee:{name:'Close combat weapon',attacks:2,hit:3,strength:4,ap:0,damage:1}},
];
export const TERRAIN = [{x:-7,z:-3,w:3,h:6},{x:7,z:3,w:3,h:6},{x:0,z:-9,w:7,h:2},{x:0,z:9,w:7,h:2}];
export const OBJECTIVES = [{x:-9,z:7},{x:0,z:0},{x:9,z:-7}];
export const clone = x => structuredClone(x);
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function fresh(seed=40100, roster=[['intercessors','heavy-intercessors','hellblasters'],['boyz','nobz','shoota-boyz']]) {
  const state={pack:PACK,seed:seed>>>0,rng:seed>>>0,round:1,side:0,score:[0,0],controls:['manual','bot'],units:[],events:[],winner:null};
  roster.forEach((army,side)=>army.forEach((id,i)=>{
    const t=TEMPLATES.find(t=>t.id===id&&t.side===side); if(!t)throw Error('Unit does not belong to this army.');
    state.units.push({...clone(t),id:`${side}-${i}`,template:id,side,x:side?12:-12,z:(i-(army.length-1)/2)*4.4,hp:Array(t.models).fill(t.wounds),moved:false,shot:false});
  }));
  record(state,'Space Marines vs Orks. Battle round 1.'); return state;
}
export function record(s,text,details=null){s.events.push({index:s.events.length,round:s.round,side:s.side,text,details});}
export function die(s) {
  // Xorshift32 with rejection sampling: reproducible, unbiased faces for lab use.
  let n; do {let x=s.rng||0x9e3779b9;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;n=s.rng;}while(n>4294967292);
  return n%6+1;
}
export function alive(u){return u.hp.filter(h=>h>0).length;}
export function active(s,u){return !!u&&alive(u)>0&&u.side===s.side&&s.winner===null;}
export function blockedPoint(p,pad=0.7){return TERRAIN.some(t=>Math.abs(p.x-t.x)<t.w/2+pad&&Math.abs(p.z-t.z)<t.h/2+pad);}
function pathClear(a,b,pad){const steps=Math.ceil(distance(a,b)*5);for(let i=0;i<=steps;i++){const f=steps?i/steps:0;if(blockedPoint({x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f},pad))return false;}return true;}
export function moveReason(s,u,p){
  if(!active(s,u))return 'Select an active unit.';
  if(u.moved)return 'This unit has already moved.';
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return 'Invalid position.';
  if(Math.abs(p.x)>19||Math.abs(p.z)>12)return 'Outside the battlefield.';
  if(distance(u,p)>u.move+1e-6)return `Move limit: ${u.move} inches.`;
  if(!pathClear(u,p,0.7))return 'The formation cannot cross solid terrain.';
  if(s.units.some(v=>v.id!==u.id&&alive(v)&&distance(v,p)<2.2))return 'Too close to another formation.';
  return null;
}
export function move(s,id,p){const u=s.units.find(u=>u.id===id),reason=moveReason(s,u,p);if(reason)throw Error(reason);const d=distance(u,p);u.x=p.x;u.z=p.z;u.moved=true;record(s,`${u.name} moved ${d.toFixed(1)}″.`,{command:'move',id,p});}
export function attackReason(s,u,v,mode='shoot'){
  if(!['shoot','melee'].includes(mode))return 'Unknown attack type.';
  if(!active(s,u))return 'Select an active unit.';
  if(u.shot)return 'This unit has already attacked.';
  if(!v||!alive(v)||v.side===u.side)return 'Choose a living enemy unit.';
  if(distance(u,v)>(mode==='melee'?3:u.range))return mode==='melee'?'Melee reach: 3 inches.':'Target is out of range.';
  if(!pathClear(u,v,0))return 'Solid terrain blocks this attack.';
  return null;
}
export function woundTarget(s,t){return s>=t*2?2:s>t?3:s===t?4:s*2<=t?6:5;}
export function attack(s,id,targetId,mode='shoot'){
  const u=s.units.find(u=>u.id===id),v=s.units.find(u=>u.id===targetId),reason=attackReason(s,u,v,mode);if(reason)throw Error(reason);
  const weapon=mode==='melee'?u.melee:{name:u.weapon,attacks:u.attacks,hit:u.hit,strength:u.strength,ap:u.ap,damage:u.damage};
  const count=alive(u)*weapon.attacks, hitTarget=weapon.hit,wound=woundTarget(weapon.strength,v.toughness),save=Math.min(7,v.save+weapon.ap);
  const hits=Array.from({length:count},()=>die(s)), wounds=hits.filter(d=>d>=hitTarget).map(()=>die(s)),saves=wounds.filter(d=>d>=wound).map(()=>die(s));
  const failed=saves.filter(d=>d<save).length,before=alive(v);
  // Training allocation: fixed front-to-back, no damage spill between models.
  for(let i=0;i<failed;i++){const model=v.hp.findIndex(h=>h>0);if(model<0)break;v.hp[model]=Math.max(0,v.hp[model]-weapon.damage);}
  u.shot=true;
  const result={attacker:u.name,defender:v.name,weapon:weapon.name,mode,hits,wounds,saves,hitTarget,woundTarget:wound,saveTarget:save,failed,damage:failed*weapon.damage,kills:before-alive(v)};
  record(s,`${u.name} → ${v.name}: ${failed} failed saves, ${result.kills} models slain.`,{command:'attack',id,targetId,...result});checkWinner(s);return result;
}
export function controlObjective(s,o){const counts=[0,0];s.units.filter(alive).forEach(u=>{if(distance(u,o)<=3.5)counts[u.side]+=alive(u)*u.oc;});return counts[0]===counts[1]?null:counts[0]>counts[1]?0:1;}
function checkWinner(s){const live=[0,1].map(side=>s.units.some(u=>u.side===side&&alive(u)));if(!live[0]||!live[1])s.winner=live[0]?'Space Marines':live[1]?'Orks':'Draw';}
export function endTurn(s){
  if(s.winner!==null)throw Error('The battle has ended.');
  if(s.side===1){OBJECTIVES.forEach(o=>{const owner=controlObjective(s,o);if(owner!==null)s.score[owner]+=1;});record(s,`Battle round ${s.round}: Space Marines ${s.score[0]} VP · Orks ${s.score[1]} VP.`);if(s.round===5){s.winner=s.score[0]===s.score[1]?'Draw':s.score[0]>s.score[1]?'Space Marines':'Orks';return;}s.round++;}
  s.side=1-s.side;s.units.filter(u=>u.side===s.side).forEach(u=>{u.moved=false;u.shot=false;});record(s,`${s.side?'Orks':'Space Marines'} turn.`);
}
export function botCommand(s){
  if(s.winner!==null)return null;
  const units=s.units.filter(u=>active(s,u));
  for(const u of units){
    const engaged=s.units.filter(v=>!attackReason(s,u,v,'melee')).sort((a,b)=>distance(u,a)-distance(u,b));
    if(engaged.length)return {type:'attack',id:u.id,targetId:engaged[0].id,mode:'melee',why:`Fight the closest enemy with ${u.melee.name.toLowerCase()}.`};
    const targets=s.units.filter(v=>!attackReason(s,u,v)).sort((a,b)=>distance(u,a)-distance(u,b));
    if(targets.length)return {type:'attack',id:u.id,targetId:targets[0].id,mode:'shoot',why:'Attack the closest visible enemy.'};
    if(!u.moved){
      const goal=[...OBJECTIVES].sort((a,b)=>distance(u,a)-distance(u,b)).find(o=>distance(u,o)>1.5&&controlObjective(s,o)!==u.side)||s.units.find(v=>v.side!==u.side&&alive(v));
      if(goal){let best=null,score=Infinity;for(let a=0;a<32;a++){const angle=a*Math.PI/16;for(const radius of [u.move,u.move/2,1]){const p={x:u.x+Math.cos(angle)*radius,z:u.z+Math.sin(angle)*radius};if(!moveReason(s,u,p)&&distance(p,goal)<score&&distance(p,goal)<distance(u,goal)-0.1){best=p;score=distance(p,goal);}}}if(best)return {type:'move',id:u.id,p:best,why:'Advance toward an objective or enemy along a legal straight path.'};}
    }
  }
  return {type:'end',why:'No useful move or shot remains.'};
}
export function execute(s,c){if(c.type==='move'){move(s,c.id,c.p);return null;}if(c.type==='attack')return attack(s,c.id,c.targetId,c.mode);if(c.type==='end'){endTurn(s);return null;}throw Error('Unknown command');}
export function runBattle(initial,seed){const s=clone(initial);s.rng=seed>>>0;s.seed=seed>>>0;let steps=0;while(s.winner===null&&steps++<500)execute(s,botCommand(s));if(s.winner===null)throw Error('Bot step limit exceeded');return s;}
export function validateSnapshot(value){
  if(value?.pack!==PACK||!Array.isArray(value.units)||value.units.length<2||value.units.length>12||![0,1].includes(value.side)||!Number.isInteger(value.round)||value.round<1||value.round>5||!Number.isInteger(value.rng)||value.rng<0||value.rng>4294967295||!Number.isInteger(value.seed)||value.seed<0||value.seed>4294967295||!Array.isArray(value.events)||value.events.length>2000)throw Error('Invalid training snapshot.');
  if(!Array.isArray(value.controls)||value.controls.length!==2||value.controls.some(c=>!['manual','assisted','bot'].includes(c)))throw Error('Invalid control settings.');
  if(!Array.isArray(value.score)||value.score.length!==2||value.score.some(n=>!Number.isInteger(n)||n<0))throw Error('Invalid score.');
  const ids=new Set();
  for(const u of value.units){const t=TEMPLATES.find(t=>t.id===u.template&&t.side===u.side);if(!t||ids.has(u.id)||typeof u.id!=='string'||!/^([01])-[0-5]$/.test(u.id)||Number(u.id[0])!==u.side||typeof u.moved!=='boolean'||typeof u.shot!=='boolean'||![0,1].includes(u.side)||!Number.isFinite(u.x)||!Number.isFinite(u.z)||Math.abs(u.x)>19||Math.abs(u.z)>12||!Array.isArray(u.hp)||u.hp.length!==t.models||u.hp.some(h=>!Number.isInteger(h)||h<0||h>t.wounds))throw Error('Invalid unit data.');ids.add(u.id);for(const key of ['name','role','models','wounds','move','range','attacks','hit','strength','toughness','save','ap','damage','points','weapon','oc','leadership'])if(u[key]!==t[key])throw Error('Unsupported profile change.');if(JSON.stringify(u.melee)!==JSON.stringify(t.melee))throw Error('Unsupported melee weapon.');}
  if(![null,'Space Marines','Orks','Draw'].includes(value.winner)||value.units.filter(u=>u.side===0).length===0||value.units.filter(u=>u.side===1).length===0)throw Error('Invalid armies.');return clone(value);
}
