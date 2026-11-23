# longest frame gap and main-thread script time while a screen opens (web build)
import time, sys, os
from playwright.sync_api import sync_playwright
target = sys.argv[1] if len(sys.argv) > 1 else 'home-shop'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2).new_page()
    pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(2.5)
    pg.evaluate("() => { const g = window.__game; g.getState().update(s => ({...s, level: 8, coins: 500, totalRounds: 12, login: {...s.login, lastDay: g.getState().today()}, ftue: {...s.ftue, homeSeen: true, firstRoundDone: true, secondRoundDone: true}})); g.getState().setSession({ firstSession: false }); }")
    pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(4)
    cdp = pg.context.new_cdp_session(pg); cdp.send('Performance.enable')
    res = []
    for i in range(4):
        m0 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        pg.evaluate("""() => { window.__gaps=[]; let last=performance.now(); window.__stop=false; const loop=()=>{const n=performance.now(); window.__gaps.push(n-last); last=n; if(!window.__stop) requestAnimationFrame(loop)}; requestAnimationFrame(loop); }""")
        time.sleep(0.3)
        pg.click(f'[data-testid="{target}"]'); time.sleep(1.2)
        gaps = pg.evaluate("() => { window.__stop=true; return window.__gaps }")
        m1 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
        res.append((max(gaps), 1000*(m1['ScriptDuration']-m0['ScriptDuration']), 1000*(m1['LayoutDuration']-m0['LayoutDuration']+m1['RecalcStyleDuration']-m0['RecalcStyleDuration'])))
        pg.go_back(); time.sleep(1.2)
    for r in res: print(f'longest frame {r[0]:.0f} ms   script {r[1]:.0f} ms   layout+style {r[2]:.0f} ms')
    b.close()
