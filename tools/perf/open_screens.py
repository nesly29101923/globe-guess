# First-open cost of every screen and sheet (web build): longest frame and script time in the second after the tap.
import time, sys, os
from playwright.sync_api import sync_playwright
SETUP = "() => { const g = window.__game; g.getState().update(s => ({...s, level: 12, xp: 30, coins: 900, totalRounds: 30, streak: {...s.streak, count: 4, lastDay: g.getState().today()}, login: {...s.login, lastDay: g.getState().today()}, ftue: {...s.ftue, homeSeen: true, firstRoundDone: true, secondRoundDone: true}})); g.getState().setSession({ firstSession: false }); }"
cases = sys.argv[1:] or ['home-shop', 'home-journey', 'home-today', 'home-modes', 'home-level', 'home-settings', 'url:/atlas', 'url:/quick', 'url:/settings']
def measure(pg, cdp, act):
    m0 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
    pg.evaluate("""() => { window.__gaps=[]; let last=performance.now(); window.__stop=false; const loop=()=>{const n=performance.now(); window.__gaps.push(n-last); last=n; if(!window.__stop) requestAnimationFrame(loop)}; requestAnimationFrame(loop); }""")
    time.sleep(0.4)
    base = max(pg.evaluate("() => window.__gaps.slice(2)") or [0])
    pg.evaluate("() => { window.__gaps = [] }")
    act(); time.sleep(1.3)
    gaps = pg.evaluate("() => { window.__stop=true; return window.__gaps }")
    m1 = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
    return base, max(gaps), sorted(gaps)[-2] if len(gaps) > 1 else 0, 1000*(m1['ScriptDuration']-m0['ScriptDuration'])
with sync_playwright() as p:
    for c in cases:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
        pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2).new_page()
        pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(2.5)
        pg.evaluate(SETUP)
        pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(4)
        cdp = pg.context.new_cdp_session(pg); cdp.send('Performance.enable')
        if c.startswith('url:'):
            act = lambda: pg.evaluate("(u) => { window.history.pushState({}, '', u); window.dispatchEvent(new PopStateEvent('popstate')); }", c[4:])
        else:
            act = lambda: pg.evaluate("(id) => document.querySelector('[data-testid=\"' + id + '\"]').click()", c)
        try:
            base, mx, second, script = measure(pg, cdp, act)
            print(f'{c:16} idle {base:4.0f} ms | longest frame {mx:4.0f} ms, next {second:4.0f} ms | script {script:4.0f} ms')
        except Exception as e:
            print(c, 'failed', str(e)[:100])
        b.close()
