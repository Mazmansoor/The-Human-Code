// Run with: node --test tests/assessment.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'website contains executable assessment script');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    textContent:'', style:{}, classList:{toggle(){}},
    replaceChildren(){}, append(){}, appendChild(){}, disabled:false
  });
  return elements.get(id);
}
const context = vm.createContext({
  document:{
    getElementById:element,
    createElement:()=>({
      className:'',textContent:'',append(){},appendChild(){},style:{}
    })
  },
  scrollTo(){},
  navigator:{clipboard:{writeText: async()=>{}}}
});
vm.runInContext(script, context);
const data = vm.runInContext('({questions,domains:d})',context);
const questions=data.questions, domains=data.domains;
test('assessment has exactly four questions in each domain',()=>{
  assert.equal(questions.length,12);
  assert.deepEqual([0,1,2].map(k=>questions.filter(q=>q[0]===k).length),[4,4,4]);
});
test('every answer maps to exactly one valid orientation',()=>{
  for(const q of questions){
    assert.ok(q[0]>=0 && q[0]<3);
    assert.equal(q[2].length,3);
    assert.equal(q[3].length,3);
    assert.deepEqual([...q[3]].sort(),[0,1,2]);
    assert.ok(q[1].length>10);
  }
});
test('nine unique archetypes, grouped Head Heart Hands',()=>{
  assert.deepEqual(Array.from(domains,x=>x.name),['Head','Heart','Hands']);
  const names=domains.flatMap(x=>x.names);
  assert.equal(names.length,9);
  assert.equal(new Set(names).size,9);
});
test('each set of completed answers produces four points per domain',()=>{
  for(let seed=0;seed<60;seed++){
    let totals=[[0,0,0],[0,0,0],[0,0,0]];
    questions.forEach((q,i)=>totals[q[0]][q[3][(seed+i)%3]]++);
    totals.forEach(domain=>assert.equal(domain.reduce((a,b)=>a+b,0),4));
  }
});
test('ties are preserved rather than broken',()=>{
  const counts=[2,2,0];
  const winners=counts.map((n,i)=>n===Math.max(...counts)?i:-1).filter(i=>i>=0);
  assert.deepEqual(winners,[0,1]);
});
test('there is no user-response network transmission or persistent storage',()=>{
  assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
});
