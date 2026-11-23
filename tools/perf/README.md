# Performance checks (web preview)

These run the web build in headless Chrome. That Chrome draws with software (no GPU), so its **frames per second say
nothing about a phone**: they measure how fast a CPU can fill pixels. What carries over to a phone is the main
thread's work per frame, which is what `frame_profile.py` reports.

    npx expo export -p web
    python3 tools/perf/serve.py dist &          # serves dist/ on :8099 with an SPA fallback
    python3 tools/perf/frame_profile.py         # auto-plays a round for 20 s and profiles it
    python3 tools/perf/step_frames.py out "/play?mode=quick&quick=world_map&tier=mixed&nonce=1" \
        until:ask answer until:fly run:150 shot:f1 run:150 shot:f2    # stills from the middle of a camera move

`frame_profile.py` prints the Skia time ("canvaskit (wasm)") and how much of it was painting map images
(`paints ... ms`, which happens on the JS thread on a phone, never on the drawing thread). The rest, divided by the
number of frames, is the drawing work per frame.

| Build | Skia work per frame while drawing |
|---|---|
| outlines every frame (before round 9) | 14.2 ms |
| images (round 9) | 1.4 ms |

Needs Python with Playwright and Google Chrome at `/usr/bin/google-chrome`.
The real check is the FPS counter on a phone (Settings > FPS counter).
