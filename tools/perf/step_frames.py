# Step the game's clock by hand and take pictures in the middle of camera moves.
# usage: step.py prefix url op...   ops: run:<ms>  shot:<name>  answer  skip  js:<code>  until:<phase>
import sys, time, os
from playwright.sync_api import sync_playwright
out, url, ops = sys.argv[1], sys.argv[2], sys.argv[3:]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    H = int(os.environ.get('H', 844)); DPR = float(os.environ.get('DPR', 2))
    pg = b.new_context(viewport={'width': 390, 'height': H}, device_scale_factor=DPR, color_scheme=os.environ.get('SCHEME', 'light')).new_page()
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text[:300]) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERR: ' + str(e)[:400]))
    if os.environ.get('DBG'): pg.add_init_script("globalThis.__mapDebug=" + os.environ['DBG'])
    pg.clock.install()
    pg.goto('http://127.0.0.1:8099/', wait_until='networkidle'); time.sleep(2.5)
    pg.evaluate("() => { const g = window.__game; g.getState().update(s => ({...s, level: 6, ftue: {...s.ftue, homeSeen: true, firstRoundDone: true, secondRoundDone: true}})); g.getState().setSession({ firstSession: false }); }")
    if os.environ.get('SETUP'): pg.evaluate(os.environ['SETUP'])
    if os.environ.get('EARLY'):
        pg.clock.pause_at(pg.evaluate('Date.now()') + 50)
        pg.goto('http://127.0.0.1:8099' + url, wait_until='commit'); time.sleep(1.5)
    else:
        pg.goto('http://127.0.0.1:8099' + url, wait_until='networkidle'); time.sleep(0.4)
        pg.clock.pause_at(pg.evaluate('Date.now()') + 50)
    phase = lambda: pg.evaluate("() => (window.__round||{}).phase")
    for op in ops:
        if op.startswith('run:'): pg.clock.run_for(int(op[4:]))
        elif op.startswith('shot:'): time.sleep(0.25); pg.screenshot(path=f'{out}-{op[5:]}.png'); print('shot', op[5:], phase())
        elif op == 'answer': pg.evaluate("() => { const r = window.__round; const b = document.querySelector('[data-testid=answer-'+r.answer+']'); b && b.click(); }")
        elif op == 'skip': pg.evaluate("() => { const s = document.querySelector('[data-testid=skip-area]'); s && s.click(); }")
        elif op.startswith('js:'): print(pg.evaluate(op[3:]))
        elif op.startswith('until:'):
            for _ in range(200):
                if phase() == op[6:]: break
                pg.clock.run_for(50)
            print('reached', phase())
    for l in logs[:10]: print(l)
    b.close()
