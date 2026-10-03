# Bermi One — 90-second ad · voice-over

The voice in the finished ad was produced with **Kokoro-82M** (Apache-2.0), using the warm US English voice `af_heart`. It's a neural voice, not a person. To use a human voice instead, record these lines on the same timecodes and swap `out/vo.wav`. Run `audio.py` again and the music ducks under the new read automatically.

| # | In | Out | Line |
|---|----|-----|------|
| 1 | 0:00.7 | 0:04.9 | Every night, your business tells a story. Most owners never get to hear it. |
| 2 | 0:06.4 | 0:11.0 | Bottles counted on paper. Cash in a drawer. Numbers you just have to trust. |
| 3 | 0:12.4 | 0:13.6 | Meet Bermi One. |
| 4 | 0:15.2 | 0:17.6 | Your staff sign in with their own PIN. |
| 5 | 0:18.4 | 0:23.4 | Every bottle, every category, live. And Bermi warns you before anything runs out. |
| 6 | 0:25.2 | 0:27.4 | At closing time, they count the shelves. |
| 7 | 0:28.4 | 0:33.7 | Bermi does the maths. What sold, what it earned, and exactly what cash should be in the drawer. |
| 8 | 0:36.2 | 0:39.3 | Cash, mobile money, expenses, even staff debts. |
| 9 | 0:40.0 | 0:41.7 | Everything is accounted for. |
| 10 | 0:43.0 | 0:45.2 | Then it's on your phone, wherever you are. |
| 11 | 0:46.4 | 0:48.0 | One tap. Verified. |
| 12 | 0:49.0 | 0:50.8 | Tomorrow starts already counted. |
| 13 | 0:52.6 | 0:54.3 | Your cash book writes itself. |
| 14 | 0:55.4 | 0:57.1 | Reports are ready for WhatsApp. |
| 15 | 0:58.2 | 1:00.6 | And when you have a question, just ask Bermi. |
| 16 | 1:02.2 | 1:05.3 | One branch, or ten. English, or Kiswahili. |
| 17 | 1:06.2 | 1:09.7 | Pay monthly, quarterly or yearly, straight from mobile money. |
| 18 | 1:11.2 | 1:12.2 | Bermi One. |
| 19 | 1:13.6 | 1:16.2 | Every bottle. Every shilling. Every night. |
| 20 | 1:18.4 | 1:20.5 | Run your business as one system. |
| 21 | 1:23.0 | 1:24.8 | Try it free for fourteen days. |

## Regenerate
```sh
pip install kokoro-onnx soundfile
# model files: github.com/thewh1teagle/kokoro-onnx/releases (kokoro-v1.0.onnx, voices-v1.0.bin)
python3 vo.py kokoro-v1.0.onnx voices-v1.0.bin .     # writes vo.wav + vo-timing.js
```
Change a line in `vo.py`, run the command again, and re-render: the picture is cut to `vo-timing.js`, so it follows the new timings.

**Note:** "Kiswahili" is spoken from hand-written phonemes (kee-swa-HEE-lee), because the automatic guess gets it wrong.
