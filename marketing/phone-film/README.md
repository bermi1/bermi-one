# Bermi One — phone film

A vertical film, 1080×1920 at 30 fps, about 3 minutes, made for WhatsApp Status, Reels and TikTok. It loops seamlessly.

It shows thirteen real features in thirteen short chapters, each on the app's own phone layout:
1. Staff PIN sign-in
2. Stock
3. Deliveries
4. Counting the close
5. Money and deductions
6. Submit and verify on the owner's phone
7. Rollover
8. The cash book
9. Reports with PDF and WhatsApp
10. Bermi AI
11. Several businesses
12. Kiswahili and dark mode
13. Mobile-money plans

| File | What it is |
|------|-----------|
| `index.html` | The stage: the phone device, the app's screens, and the film's own graphics. |
| `timeline.js` | The whole film. `renderAt(t)` sets each frame; `EVENTS` lists every sound cue. |
| `audio.py` | The score and interface sounds, all synthesised: felt piano, strings, sub, light percussion. |
| `VO-SCRIPT.md` | The voiceover with timecodes; the music makes room for it. |

## Render
Uses the shared renderer in `../intro-video/render.mjs` (see that README for setup).
```sh
node ../intro-video/render.mjs --page index.html --w 1080 --h 1920 --events events.json --out silent.mp4
python3 audio.py events.json 178.2 track.wav
$FFMPEG -i silent.mp4 -i track.wav -c:v copy -c:a aac -b:a 256k -shortest bermi-one-phone-film.mp4
```
Open `index.html?play` to watch it live, or `index.html?t=60` to see a single frame.
