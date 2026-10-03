"""
Voice-over for the Bermi One ad.

    python3 vo.py <kokoro-v1.0.onnx> <voices-v1.0.bin> <out-dir>

Kokoro-82M (Apache-2.0) speaks each line with the warm US voice `af_heart`.
Every line is rendered on its own, trimmed, lightly processed (high-pass,
a little presence, gentle compression), then placed at its slot. A line that
runs long pushes the next one rather than overlapping it.

Writes:
  vo.wav         48 kHz mono voice stem, 90 s
  vo-timing.js   window.VO = [{id, start, dur, text}] — the picture is cut to this
"""
import json
import sys
import wave

import numpy as np
from kokoro_onnx import Kokoro

MODEL, VOICES, OUT = sys.argv[1:4]
SR = 48000
DUR = 90.0
VOICE = 'af_heart'

# (slot start, text, speed). Pauses are part of the read: the gaps between
# slots are where the picture gets to land.
LINES = [
    (0.7, 'Every night, your business tells a story. Most owners never get to hear it.', 0.93),
    (6.4, 'Bottles counted on paper. Cash in a drawer. Numbers you just have to trust.', 0.95),
    (12.4, 'Meet Bermi One.', 0.88),
    (15.2, 'Your staff sign in with their own PIN.', 0.97),
    (18.4, 'Every bottle, every category, live. And Bermi warns you before anything runs out.', 0.97),
    (25.2, 'At closing time, they count the shelves.', 0.97),
    (28.4, 'Bermi does the maths. What sold, what it earned, and exactly what cash should be in the drawer.', 0.98),
    (36.2, 'Cash, mobile money, expenses, even staff debts.', 0.97),
    (40.0, 'Everything is accounted for.', 0.95),
    (43.0, "Then it's on your phone, wherever you are.", 0.97),
    (46.4, 'One tap. Verified.', 0.9),
    (49.0, 'Tomorrow starts already counted.', 0.95),
    (52.6, 'Your cash book writes itself.', 0.97),
    (55.4, 'Reports are ready for WhatsApp.', 0.97),
    (58.2, 'And when you have a question, just ask Bermi.', 0.96),
    (62.2, 'One branch, or ten. English, or {KISWAHILI}.', 0.95),
    (66.2, 'Pay monthly, quarterly or yearly, straight from mobile money.', 0.97),
    (71.2, 'Bermi One.', 0.86),
    (73.6, 'Every bottle. Every shilling. Every night.', 0.88),
    (78.4, 'Run your business as one system.', 0.86),
    (83.0, 'Try it free for fourteen days.', 0.92),
]
KISWAHILI = 'kiswɑhˈiːli'  # kee-swa-HEE-lee, not the guess espeak makes


def to48k(x, sr_in=24000):
    """2× upsample with a windowed-sinc low-pass, good enough for speech."""
    assert sr_in * 2 == SR
    up = np.zeros(len(x) * 2)
    up[::2] = x * 2
    n = np.arange(-48, 49)
    h = np.sinc(n / 2) * np.blackman(len(n)) / 2
    return np.convolve(up, h, mode='same')


def trim(x, thresh=0.008):
    idx = np.where(np.abs(x) > thresh)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(0.03 * SR)), min(len(x), idx[-1] + int(0.12 * SR))
    return x[a:b]


def highpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = a * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    return y


def compress(x, thresh_db=-20, ratio=2.5, attack=0.005, release=0.12):
    env = np.abs(x)
    a_att, a_rel = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    e = np.empty_like(env)
    level = 0.0
    for i, v in enumerate(env):
        level = a_att * level + (1 - a_att) * v if v > level else a_rel * level + (1 - a_rel) * v
        e[i] = level
    db = 20 * np.log10(e + 1e-9)
    over = np.maximum(0, db - thresh_db)
    gain = 10 ** (-(over - over / ratio) / 20)
    return x * gain


def main():
    k = Kokoro(MODEL, VOICES)
    track = np.zeros(int(SR * DUR))
    timing = []
    prev_end = 0.0
    for i, (slot, text, speed) in enumerate(LINES):
        if '{KISWAHILI}' in text:
            ph = k.tokenizer.phonemize(text.replace('{KISWAHILI}', 'Swahili'), 'en-us')
            ph = ph.replace(k.tokenizer.phonemize('Swahili', 'en-us').strip('. '), KISWAHILI)
            audio, sr = k.create(ph, voice=VOICE, speed=speed, is_phonemes=True)
            text = text.replace('{KISWAHILI}', 'Kiswahili')
        else:
            audio, sr = k.create(text, voice=VOICE, speed=speed, lang='en-us')
        x = trim(to48k(np.asarray(audio, dtype=float), sr))
        start = max(slot, prev_end + 0.3)
        dur = len(x) / SR
        i0 = int(start * SR)
        track[i0:i0 + len(x)] += x[: len(track) - i0]
        timing.append({'id': i + 1, 'start': round(start, 3), 'dur': round(dur, 3), 'text': text})
        prev_end = start + dur
        print(f'{i + 1:2d}  {start:6.2f}–{start + dur:6.2f}  {text}')

    # light polish: rumble out, a touch of presence, gentle compression
    v = highpass(track, 90)
    v = v + 0.18 * highpass(v, 2500)
    v = compress(v)
    v *= 10 ** (-3 / 20) / np.abs(v).max()

    pcm = (v * 32767).astype('<i2')
    with wave.open(f'{OUT}/vo.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    with open(f'{OUT}/vo-timing.js', 'w') as f:
        f.write('// Generated by vo.py — the picture is cut to these times.\nwindow.VO = ' + json.dumps(timing, indent=1) + ';\n')
    print('last line ends at', round(prev_end, 2), 's')


if __name__ == '__main__':
    main()
