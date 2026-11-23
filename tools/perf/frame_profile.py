# CPU profile of the main thread during an auto-played round: where the script time goes.
import time, sys, os, json, collections
from playwright.sync_api import sync_playwright
url = '/play?mode=journey&level=world_famous-4&nonce=2'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2).new_page()
    pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(2.5)
    pg.evaluate("() => { const g = window.__game; g.getState().update(s => ({...s, level: 6, ftue: {...s.ftue, homeSeen: true, firstRoundDone: true, secondRoundDone: true}})); }")
    pg.goto('http://127.0.0.1:8099' + url, wait_until='networkidle'); time.sleep(1.5)
    cdp = pg.context.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500}); cdp.send('Profiler.start')
    pg.evaluate("""() => { window.__n=0; const loop=()=>{window.__n++; requestAnimationFrame(loop)}; requestAnimationFrame(loop);
      window.__auto=setInterval(()=>{const r=window.__round; if(!r) return; if(r.phase==='ask'){const b=document.querySelector('[data-testid=answer-'+r.answer+']'); b&&b.click();} else if(r.phase==='reveal'){const s=document.querySelector('[data-testid=skip-area]'); s&&s.click();}},700) }""")
    time.sleep(20)
    prof = cdp.send('Profiler.stop')['profile']; n = pg.evaluate("() => window.__n"); print('paints', pg.evaluate("() => (window.__paintLog||[]).length + ' paints, ' + (window.__paintLog||[]).reduce((a,x)=>a+x.ms,0) + ' ms, max ' + Math.max(0,...(window.__paintLog||[]).map(x=>x.ms))"))
    nodes = {x['id']: x for x in prof['nodes']}
    dt = prof['timeDeltas']; self_t = collections.Counter()
    for nid, d in zip(prof['samples'], dt): self_t[nid] += d
    parent = {}
    for x in prof['nodes']:
        for c in x.get('children', []): parent[c] = x['id']
    def label(x):
        cf = x['callFrame']; u = cf['url']; f = cf['functionName'] or '(anon)'
        if 'wasm' in u or f.startswith('wasm-function') or u.startswith('wasm://'): return 'canvaskit (wasm)'
        return f
    agg = collections.Counter(); wasm_by_caller = collections.Counter()
    for nid, t in self_t.items():
        x = nodes[nid]; l = label(x); agg[l] += t
        if l == 'canvaskit (wasm)':
            # nearest JS caller
            q = nid
            while q in parent and label(nodes[q]) == 'canvaskit (wasm)': q = parent[q]
            c = nodes[q]['callFrame']['functionName'] or '(anon)'
            # go up one more for context
            wasm_by_caller[c] += t
    tot = sum(t for l, t in agg.items() if l not in ('(idle)', '(program)'))
    print(f'frames {n}; busy script {tot/1000:.0f} ms = {tot/1000/n:.1f} ms/frame; idle {agg["(idle)"]/1000:.0f} ms; program {agg["(program)"]/1000:.0f} ms')
    for l, t in agg.most_common(14): print(f'  {t/1000:7.0f} ms  {l}')
    print('canvaskit time by JS caller:')
    for l, t in wasm_by_caller.most_common(10): print(f'  {t/1000:7.0f} ms  {l}')
    b.close()
