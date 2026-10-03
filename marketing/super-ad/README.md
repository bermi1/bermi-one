# Bermi One — the 90-second ad

4K vertical (2160×3840), 30 fps, 90 seconds, with a produced voice-over. The app fills the whole frame, as if the phone screen were the film. The phone body only appears at the start and at the end.

| File | What it is |
|------|-----------|
| `vo.py` | Makes the voice-over (Kokoro-82M, `af_heart`). Writes `vo.wav` and `vo-timing.js`. |
| `vo-timing.js` | When each line starts and ends. The picture is cut to these times. |
| `index.html`, `timeline.js` | The film. The screens and helpers are shared with `../phone-film`; the ad starts at "THE AD". |
| `audio.py` | The score, the interface sounds, music ducking under the voice, and the final mix. |
| `VO-SCRIPT.md` | The voice lines with their timecodes. |

## Render
```sh
python3 vo.py kokoro-v1.0.onnx voices-v1.0.bin . && mv vo.wav out/
node ../intro-video/render.mjs --page index.html --w 1080 --h 1920 --scale 2 --events events.json --out silent-4k.mp4
python3 audio.py events.json 90 track.wav out/vo.wav
$FFMPEG -i silent-4k.mp4 -i track.wav -c:v copy -c:a aac -b:a 256k -shortest bermi-one-ad-4k.mp4
```
Open `index.html?play` to watch it live, or `index.html?t=46.6` to see a single frame.
