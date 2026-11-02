// Run: node --test tests/journey.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'assessment script exists');

function harness(){
  const nodes=new Map(), writes=[];
  function node(id=''){
    if(!nodes.has(id)){
      const n={id,textContent:'',value:'',disabled:false,style:{},children:[],hidden:false,
        classList:{toggle(name,enabled){if(name==='hidden')n.hidden=enabled}},
        replaceChildren(...children){this.children=children},
        append(...children){this.children.push(...children)},
        appendChild(child){this.children.push(child)}};
      nodes.set(id,n);
    }
    return nodes.get(id);
  }
  let created=0;
  const ctx=vm.createContext({
    document:{getElementById:node,createElement:()=>node('created-'+(++created))},
    navigator:{clipboard:{writeText:async text=>{writes.push(text)}}},
    scrollTo(){}
  });
  vm.runInContext(script,ctx);
  return {node,ctx,writes};
}

test('full twelve-question journey renders a field guide and three report cards',()=>{
  const h=harness();
  h.node('start').onclick();
  assert.equal(h.node('quiz').hidden,false);
  for(let i=0;i<12;i++){
    assert.equal(h.node('counter').textContent,'Question '+(i+1)+' of 12');
    assert.equal(h.node('options').children.length,3);
    h.node('options').children[0].onclick();
  }
  assert.equal(h.node('report').hidden,false);
  assert.equal(h.node('resultCards').children.length,3);
  assert.equal(h.node('details').children.length,3);
  assert.equal(h.node('interpretation').children.length,3);
  assert.equal(h.node('fieldGuideContent').children.filter(x=>x.tagName==='p'||x.textContent).length>0,true);
  assert.match(h.node('headline').textContent,/ · /);
});

test('back navigation preserves answer and reset clears progress',()=>{
  const h=harness();
  h.node('start').onclick();
  h.node('options').children[1].onclick();
  assert.equal(h.node('counter').textContent,'Question 2 of 12');
  h.node('back').onclick();
  assert.equal(h.node('counter').textContent,'Question 1 of 12');
  assert.match(h.node('options').children[1].className,/selected/);
  h.node('cancel').onclick();
  assert.equal(h.node('home').hidden,false);
  h.node('start').onclick();
  assert.doesNotMatch(h.node('options').children[1].className,/selected/);
});

test('ties in each domain preserve multiple guides, not arbitrary winner',()=>{
  const h=harness();
  vm.runInContext('answers=questions.map((q,i)=>q[3].indexOf(i%4===0?0:i%4===1?1:i%4===2?0:1));report()',h.ctx);
  assert.match(h.node('headline').textContent,/\//);
  assert.ok(h.node('fieldGuideContent').children.some(x=>/tied/.test(x.textContent)));
});

test('private decision notes copy with real line breaks',async()=>{
  const h=harness();
  h.node('decisionNote').value='Choose a project';
  h.node('headNote').value='Compare evidence';
  h.node('heartNote').value='Consider people';
  h.node('handsNote').value='Run a pilot';
  await h.node('copyReflection').onclick();
  assert.equal(h.writes.length,1);
  assert.match(h.writes[0],/Decision Reflection\nDecision: Choose a project\nHead: Compare evidence\nHeart: Consider people\nHands: Run a pilot/);
});

test('assessment retains privacy-by-default without storage or network calls',()=>{
  assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test('portrait shows all twelve answer-level evidence items without pretending to observe behavior',()=>{
  const h=harness();
  h.node('start').onclick();
  for(let i=0;i<12;i++)h.node('options').children[0].onclick();
  const evidence=h.node('evidence').children;
  assert.equal(evidence.length,15); // three domain headings and twelve answers
  const statements=evidence.filter(x=>/You chose:/.test(x.textContent));
  assert.equal(statements.length,12);
  assert.ok(statements.every(x=>x.textContent.includes(' — You chose: ')));
  assert.match(html,/Challenge your portrait/);
  assert.match(html,/do not measure ability/);
});
