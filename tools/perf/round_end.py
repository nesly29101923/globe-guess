# Longest frame around the end of a round (result screen opening) and when an Atlas region opens (web build).
import time, sys
from playwright.sync_api import sync_playwright
SETUP = "() => { const g = window.__game; g.getState().update(s => ({...s, level: 12, xp: 30, coins: 900, totalRounds: 30, login: {...s.login, lastDay: g.getState().today()}, ftue: {...s.ftue, homeSeen: true, firstRoundDone: true, secondRoundDone: true}})); g.getState().setSession({ firstSession: false }); }"
GAPS = """() => { window.__gaps=[]; let last=performance.now(); window.__stop=false; const loop=()=>{const n=performance.now(); window.__gaps.push([n-last, (window.__round||{}).phase]); last=n; if(!window.__stop) requestAnimationFrame(loop)}; requestAnimationFrame(loop); }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2).new_page()
    pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(2.5)
    pg.evaluate(SETUP)
    if 'atlas' in sys.argv:
        pg.goto('http://127.0.0.1:8099/atlas', wait_until='networkidle'); time.sleep(2.5)
        for rid in ['flags', 'africa']:
            pg.evaluate(GAPS); time.sleep(0.3); pg.evaluate("() => { window.__gaps = [] }")
            pg.evaluate("(id) => document.querySelector('[data-testid=\"atlas-' + id + '\"]').click()", rid); time.sleep(1.5)
            g = pg.evaluate("() => { window.__stop = true; return window.__gaps.map(x => x[0]) }")
            print(f'atlas region {rid}: longest frame {max(g):.0f} ms, next {sorted(g)[-2]:.0f} ms')
            pg.evaluate("() => document.querySelector('[data-testid=\"sheet-close\"]').click()"); time.sleep(0.8)
    else:
        pg.goto('http://127.0.0.1:8099/play?mode=journey&level=world_famous-4&nonce=5', wait_until='networkidle'); time.sleep(1)
        pg.evaluate("""() => { window.__auto=setInterval(()=>{const r=window.__round; if(!r) return; if(r.phase==='ask'){const b=document.querySelector('[data-testid=answer-'+r.answer+']'); b&&b.click();} else if(r.phase==='reveal'){const s=document.querySelector('[data-testid=skip-area]'); s&&s.click();}},500) }""")
        for _ in range(80):
            time.sleep(0.5); r = pg.evaluate("() => [window.__round.idx, window.__round.phase]")
            if r[0] >= 9 and r[1] in ('ask',): break
        pg.evaluate(GAPS)
        for _ in range(40):
            time.sleep(0.25)
            if pg.evaluate("() => window.__round.phase") == 'done': break
        time.sleep(2.5)
        g = pg.evaluate("() => { window.__stop = true; return window.__gaps }")
        d = [x[0] for x in g if x[1] == 'done']
        print(f'result screen: longest frame {max(d):.0f} ms, next {sorted(d)[-2]:.0f} ms, third {sorted(d)[-3]:.0f} ms, frames {len(d)}')
    b.close()
