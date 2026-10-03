"""
Soundtrack for the Bermi One introduction film.

    python3 audio.py events.json out.wav

Everything is synthesised here, so the track has no licensing strings:
- a slow pad (A minor 9 → F maj 7 → C add 9 → G sus),
- a sub that arrives with the product,
- an eighth-note pluck arpeggio that builds through the demo and peaks on the
  ecosystem shot,
- interface sounds placed from the same event list the picture uses.

The energy curve follows the brief: quiet open, build at the reveal, momentum
through the demo, peak at the big picture, stripped back for the logo. The
last two seconds are crossfaded into the first two so the film loops without a
seam. Music dips under the voiceover windows in VO-SCRIPT.md, so a recorded
voice drops straight in.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 75.0
TAIL = 2.5  # rendered past the end, then folded into the start for the loop
N = int(SR * (DUR + TAIL))
t = np.arange(N) / SR
rng = np.random.default_rng(11)

# Voiceover windows (seconds) — the music ducks a little under each.
VO = [(0.6, 3.0), (3.2, 7.0), (8.6, 12.2), (12.6, 14.4), (29.0, 31.2), (33.4, 35.8),
      (40.6, 43.6), (51.0, 54.2), (60.8, 62.3), (62.6, 65.6), (66.2, 69.8)]


def env_curve(points):
    """Piecewise-linear automation from (time, value) pairs."""
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


# Energy: how much of the arrangement is playing.
ENERGY = env_curve([(0, .25), (7, .3), (7.05, .12), (8, .2), (10.1, .5), (15, .58), (27, .66),
                    (40, .76), (50, .82), (51, 1.0), (58.5, 1.0), (60.3, .42), (66, .38),
                    (70, .26), (DUR + TAIL, .25)])


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# Chords every 5 s (two bars at 96 bpm). Notes as MIDI numbers.
CHORDS = [
    [57, 60, 64, 67, 71],   # Am9
    [53, 57, 60, 64, 69],   # Fmaj7 (add A)
    [48, 55, 60, 62, 64],   # C add9 / G
    [55, 60, 62, 67, 71],   # Gsus
]
BEAT = 60 / 96
CHORD_LEN = 8 * BEAT  # 5 s


def chord_at(time):
    return CHORDS[int(time // CHORD_LEN) % len(CHORDS)]


def pad():
    out = np.zeros((2, N))
    n_chords = int(np.ceil((DUR + TAIL) / CHORD_LEN)) + 1
    for c in range(n_chords):
        start = c * CHORD_LEN
        notes = CHORDS[c % len(CHORDS)]
        # raised-cosine crossfade between chords
        a, b = start - 0.9, start + CHORD_LEN + 0.9
        seg = (t >= a) & (t < b)
        if not seg.any():
            continue
        tt = t[seg]
        e = np.ones_like(tt)
        e = np.where(tt < start + 0.9, 0.5 - 0.5 * np.cos(np.pi * np.clip((tt - a) / 1.8, 0, 1)), e)
        e = np.where(tt > b - 1.8, 0.5 + 0.5 * np.cos(np.pi * np.clip((tt - (b - 1.8)) / 1.8, 0, 1)), e)
        for i, n in enumerate(notes):
            f = midi(n)
            for ch, det in ((0, -0.13), (1, 0.13)):
                ff = f * 2 ** (det / 12)
                ph = rng.uniform(0, 2 * np.pi)
                # soft saw-ish: a few harmonics with falling weight, slow shimmer
                wave_ = (np.sin(2 * np.pi * ff * tt + ph) + 0.28 * np.sin(4 * np.pi * ff * tt + ph * 1.3)
                         + 0.09 * np.sin(6 * np.pi * ff * tt + ph * 0.7))
                lfo = 1 + 0.12 * np.sin(2 * np.pi * (0.11 + 0.03 * i) * tt + i)
                out[ch, seg] += wave_ * e * lfo * (0.05 if i else 0.065)
    return out


def sub():
    out = np.zeros(N)
    for c in range(int(np.ceil((DUR + TAIL) / CHORD_LEN)) + 1):
        root = CHORDS[c % len(CHORDS)][0] - 24
        start = c * CHORD_LEN
        seg = (t >= start) & (t < start + CHORD_LEN)
        tt = t[seg] - start
        e = np.clip(tt / 0.4, 0, 1) * np.clip((CHORD_LEN - tt) / 0.4, 0, 1)
        out[seg] += np.sin(2 * np.pi * midi(root) * t[seg]) * e
    gain = env_curve([(0, 0), (10, 0), (15.5, .12), (27, .17), (50, .2), (51, .3), (58.5, .3), (60.4, .05), (66, 0), (DUR + TAIL, 0)])
    return out * gain


def plucks():
    """Eighth-note arpeggio; density and level follow the energy curve."""
    out = np.zeros((2, N))
    step = BEAT / 2
    k = 0
    time = 0.0
    while time < DUR + TAIL:
        e = float(np.interp(time, t[::480], ENERGY[::480]))
        level = max(0.0, (e - 0.45) / 0.55)  # silent below ~0.45
        if level > 0.01 and not (60.3 < time < 67.5):
            notes = chord_at(time)
            pattern = [0, 2, 4, 1, 3, 4, 2, 1]
            n = notes[pattern[k % 8]] + 12
            if k % 16 in (6, 14):
                n += 12
            f = midi(n)
            L = int(SR * 0.42)
            i0 = int(time * SR)
            tt = np.arange(L) / SR
            v = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 18)) * np.exp(-tt * 9)
            v *= 0.07 * level * (1.0 if k % 2 == 0 else 0.7)
            pan = 0.5 + 0.35 * np.sin(k * 0.9)
            end = min(N, i0 + L)
            out[0, i0:end] += v[: end - i0] * (1 - pan)
            out[1, i0:end] += v[: end - i0] * pan
        k += 1
        time += step
    return out


def pulse():
    """A felt heartbeat under the demo, every beat at the peak."""
    out = np.zeros(N)
    time = 0.0
    b = 0
    while time < DUR + TAIL:
        every = 1 if 50.0 <= time < 58.6 else 2
        if 27.0 <= time < 59.8 and b % every == 0:
            L = int(SR * 0.35)
            i0 = int(time * SR)
            tt = np.arange(L) / SR
            f = 52 + 40 * np.exp(-tt * 30)
            v = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 11) * (0.22 if every == 1 else 0.15)
            end = min(N, i0 + L)
            out[i0:end] += v[: end - i0]
        b += 1
        time += BEAT
    return out


# ------------------------------------------------------------------ interface sounds
def noise(n):
    return rng.standard_normal(n)


def onepole(x, a):
    """Low-pass, a in (0,1): higher = darker. Short buffers only."""
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = acc + (1 - a) * (x[i] - acc)
        y[i] = acc
    return y


def tone(f, dur, decay, harm=0.25):
    tt = np.arange(int(SR * dur)) / SR
    return (np.sin(2 * np.pi * f * tt) + harm * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * decay) * np.clip(tt / 0.004, 0, 1)


def sfx(kind, idx):
    if kind == 'click':
        n = noise(int(SR * 0.012)) * np.exp(-np.arange(int(SR * 0.012)) / (SR * 0.002))
        return np.concatenate([n * 0.35, np.zeros(10)])[: len(n)] + tone(2400, 0.012, 300, 0)[: len(n)] * 0.25
    if kind == 'key':
        f = 1700 + 300 * ((idx * 7) % 5)
        return tone(f, 0.03, 160, 0) * 0.14 + noise(int(SR * 0.03)) * np.exp(-np.arange(int(SR * 0.03)) / (SR * 0.003)) * 0.06
    if kind == 'pop':
        tt = np.arange(int(SR * 0.09)) / SR
        f = 1250 - 500 * (tt / 0.09)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 40) * 0.12
    if kind == 'blip':
        return tone(1900 + 140 * (idx % 4), 0.06, 70, 0) * 0.1
    if kind == 'dock':
        return tone(240, 0.12, 40, 0.4) * 0.28
    if kind in ('whoosh', 'reverse', 'swipe', 'open', 'swell'):
        dur = {'whoosh': 0.8, 'reverse': 0.9, 'swipe': 0.28, 'open': 0.32, 'swell': 1.6}[kind]
        L = int(SR * dur)
        x = noise(L)
        x = onepole(x, 0.86) - onepole(x, 0.995)  # band-ish
        tt = np.arange(L) / L
        envl = np.sin(np.pi * tt) ** 2 if kind in ('whoosh', 'swipe', 'open') else tt ** 2.2 * (tt < 0.97)
        if kind == 'swell':
            envl = tt ** 1.6 * np.clip((1 - tt) * 12, 0, 1)
        g = {'whoosh': 0.5, 'reverse': 0.45, 'swipe': 0.22, 'open': 0.16, 'swell': 0.3}[kind]
        return x * envl * g * 2.2
    if kind == 'notify':
        a = tone(1046.5, 0.5, 7, 0.3)
        b = tone(1568, 0.6, 6, 0.3)
        out = np.zeros(int(SR * 0.75))
        out[: len(a)] += a * 0.16
        o = int(SR * 0.11)
        out[o: o + len(b)] += b * 0.15
        return out
    if kind == 'confirm':
        a = tone(659.3, 0.4, 8, 0.3)
        b = tone(987.8, 0.5, 7, 0.3)
        out = np.zeros(int(SR * 0.62))
        out[: len(a)] += a * 0.17
        o = int(SR * 0.085)
        out[o: o + len(b)] += b * 0.17
        return out
    if kind == 'step':
        scale = [69, 71, 73, 76, 78, 81, 83]
        out = tone(midi(scale[idx % 7]), 0.5, 7, 0.5) * 0.15
        hi = tone(midi(scale[idx % 7] + 12), 0.3, 14, 0) * 0.05
        out[: len(hi)] += hi
        return out
    if kind == 'impact':
        tt = np.arange(int(SR * 1.6)) / SR
        f = 46 + 70 * np.exp(-tt * 18)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6)
        n = onepole(noise(len(tt)), 0.97) * np.exp(-tt * 9) * 2
        return (body * 0.55 + n * 0.2)
    if kind == 'freeze':
        tt = np.arange(int(SR * 0.7)) / SR
        f = 180 * np.exp(-tt * 3)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5) * 0.25
    if kind == 'count':
        out = np.zeros(int(SR * 1.1))
        for i in range(12):
            o = int(SR * (i * 0.085))
            v = tone(2200 + i * 40, 0.02, 220, 0) * 0.05
            out[o: o + len(v)] += v
        return out
    if kind == 'logo':
        tt = np.arange(int(SR * 4.5)) / SR
        out = np.zeros(len(tt))
        for i, n in enumerate([57, 64, 69, 71, 76]):
            att = np.clip(tt / (0.25 + i * 0.08), 0, 1)
            out += np.sin(2 * np.pi * midi(n) * tt) * att * np.exp(-tt * 0.75) * 0.07
        out += np.sin(2 * np.pi * midi(88) * tt) * np.clip(tt / 0.6, 0, 1) * np.exp(-tt * 1.6) * 0.02
        return out
    return np.zeros(10)


def place_sfx(events):
    out = np.zeros((2, N))
    counters = {}
    for ev in events:
        kind = ev['type']
        idx = counters.get(kind, 0)
        counters[kind] = idx + 1
        x = sfx(kind, idx) * ev.get('gain', 1)
        i0 = int(ev['t'] * SR)
        end = min(N, i0 + len(x))
        if end <= i0:
            continue
        pan = 0.5 if kind in ('impact', 'logo', 'freeze', 'swell', 'notify', 'confirm') else 0.5 + 0.18 * np.sin(idx * 1.7)
        out[0, i0:end] += x[: end - i0] * (1 - pan) * 2
        out[1, i0:end] += x[: end - i0] * pan * 2
    return out


def reverb(x, seconds=2.2, mix=0.22):
    L = int(SR * seconds)
    tt = np.arange(L) / SR
    ir = rng.standard_normal(L) * np.exp(-tt * 3.2)
    ir[: int(SR * 0.012)] = 0
    ir /= np.sqrt((ir ** 2).sum())
    n = len(x) + L
    nfft = 1 << (n - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - mix) + wet * mix


def main():
    events = json.load(open(sys.argv[1]))
    out_path = sys.argv[2]

    pads = pad()
    pad_gain = env_curve([(0, .55), (8, .6), (15, .7), (50, .8), (60.3, .9), (66, .75), (DUR + TAIL, .55)])
    music = pads * pad_gain + plucks() + np.vstack([sub(), sub()]) + np.vstack([pulse(), pulse()])
    # the freeze: the music holds its breath
    music *= env_curve([(0, 1), (6.95, 1), (7.05, .35), (7.9, .45), (8.4, 1), (DUR + TAIL, 1)])
    duck = np.ones(N)
    for a, b in VO:
        duck *= 1 - 0.28 * np.clip(np.minimum((t - a + 0.25) / 0.25, (b + 0.35 - t) / 0.35), 0, 1)
    music *= duck

    fx = place_sfx(events)
    mix = np.vstack([reverb(music[0] + fx[0] * 0.6, mix=0.2) + fx[0] * 0.55,
                     reverb(music[1] + fx[1] * 0.6, mix=0.2) + fx[1] * 0.55])

    # fold the tail into the head: the loop has no seam
    L = int(SR * TAIL)
    end = int(SR * DUR)
    fade = 0.5 - 0.5 * np.cos(np.pi * np.arange(L) / L)
    head = mix[:, :L] * fade + mix[:, end:end + L] * (1 - fade)
    mix = np.concatenate([head, mix[:, L:end]], axis=1)

    # gentle master: soft-clip, then peak at −1 dBFS
    peak = np.abs(mix).max()
    mix = np.tanh(mix / peak * 1.4) / np.tanh(1.4)
    mix *= 10 ** (-1 / 20) / np.abs(mix).max()

    pcm = (mix.T * 32767).astype('<i2')
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out_path, f'{mix.shape[1] / SR:.2f}s')


if __name__ == '__main__':
    main()
