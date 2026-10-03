# Bermi One — introduction film

A 75-second, 16:9, 30 fps product film that loops seamlessly. It is built as code, so every frame can be re-rendered exactly. The product shown is Bermi One itself, using the real Kilimanjaro Bar example data.

| File | What it is |
|------|-----------|
| `index.html` | The stage and its styles: a stand-in for the desktop app plus the film's own elements. |
| `timeline.js` | The whole film. `renderAt(t)` positions every element at time `t`, and `EVENTS` lists every sound cue. |
| `render.mjs` | Steps Playwright through each frame and pipes the frames into ffmpeg/x264. |
| `audio.py` | Synthesises the music and interface sounds from `EVENTS`, with no licensed samples. |
| `VO-SCRIPT.md` | The voiceover with timecodes, for a human voice to be recorded and dropped in. |

## Preview in a browser
Open `index.html?play` to watch it in real time, or `index.html?t=23.5` to see a single frame.

## Render
```sh
npm i playwright-core            # or point PLAYWRIGHT_CORE at an existing install
pip install numpy imageio-ffmpeg
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")

node render.mjs --events events.json                    # sound cues
python3 audio.py events.json track.wav                  # soundtrack
node render.mjs --out silent.mp4                        # 1920×1080
node render.mjs --out silent-4k.mp4 --scale 2           # 3840×2160
$FFMPEG -i silent.mp4 -i track.wav -c:v copy -c:a aac -b:a 256k -shortest bermi-one-intro-1080p.mp4
```

The last frame matches the first: a single point of light at the left edge. Set the video to loop and the cut can't be seen.
