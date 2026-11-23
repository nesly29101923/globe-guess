import http.server, os, sys
root = sys.argv[1]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=root, **k)
    def log_message(s, *a): pass
    def send_head(s):
        p = s.translate_path(s.path.split('?')[0])
        if not os.path.exists(p): s.path = '/index.html'
        return super().send_head()
    def guess_type(s, p):
        return 'application/wasm' if p.endswith('.wasm') else super().guess_type(p)
http.server.ThreadingHTTPServer(('127.0.0.1', 8099), H).serve_forever()
