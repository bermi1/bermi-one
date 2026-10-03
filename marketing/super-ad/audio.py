"""
Score, sound design and voice mix for the Bermi One 90-second ad.

    python3 audio.py events.json 90 out.wav [vo.wav]

The phone film's engine, retuned for an ad: 100 bpm, the drums arrive with
"Meet Bermi One", drop out for the second "Bermi One", and hit hardest on
"Every bottle. Every shilling. Every night." The music is side-chain ducked
under the real voice (vo.wav from vo.py), which is mixed on top with a touch
of room so it sits in the track rather than on it.

Warm, unhurried, hopeful — the register of a product film that trusts its
picture: a felt-piano motif over soft string pads, a sub that arrives with the
first chapter, light percussion (shaker, rim, a soft kick) that carries the
demos and opens up on the finale, then resolves on the logo. Every interface
sound comes from the film's own cue list, so a tap on screen is a tap in the
ear. The tail is folded into the head, so the film loops without a seam.

Nothing here is sampled; it is all synthesised, so the track is ours to use.
"""
import json
import os
import sys
import wave

import numpy as np

SR = 48000
EVENTS = json.load(open(sys.argv[1]))
DUR = float(sys.argv[2])
OUT = sys.argv[3]
VO_PATH = sys.argv[4] if len(sys.argv) > 4 else None
TAIL = 3.0
N = int(SR * (DUR + TAIL))
t = np.arange(N) / SR
rng = np.random.default_rng(5)

FIN = 70.8                 # the finale (matches timeline.js)
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORD_LEN = 2 * BAR

# Voiceover windows: the music sits back a little under each (see VO-SCRIPT.md).
VO = []
if False:
    for line in open('VO-SCRIPT.md'):
        if line.startswith('| ') and line.count('|') >= 6 and ':' in line.split('|')[2]:
            cells = [c.strip() for c in line.split('|')]
            def sec(x):
                m, s = x.split(':')
                return int(m) * 60 + float(s)
            VO.append((sec(cells[2]), sec(cells[3])))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def curve(points):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


# Energy across the film: intimate open, steady demos, open finale, resolve.
ENERGY = curve([(0, .22), (5.6, .3), (6.2, .5), (11.0, .55), (11.9, .25), (12.15, .8), (25, .74), (45, .78), (60, .8),
                (70.6, .82), (70.8, .4), (73.3, .5), (73.6, 1.0), (80.4, 1.0), (81.4, .5), (85.5, .38),
                (DUR, .22), (DUR + TAIL, .22)])

# D major, warm voicings: Dmaj9 · Bm9 · Gmaj7(#11) · A6sus
CHORDS = [
    [50, 57, 62, 64, 66, 69],
    [47, 54, 61, 62, 66, 69],
    [43, 50, 57, 62, 66, 69],
    [45, 52, 59, 61, 64, 66],
]


def chord_at(x):
    return CHORDS[int(x // CHORD_LEN) % len(CHORDS)]


# ------------------------------------------------------------------ instruments
def strings():
    out = np.zeros((2, N))
    n_chords = int((DUR + TAIL) // CHORD_LEN) + 2
    for c in range(n_chords):
        start = c * CHORD_LEN
        a, b = start - 1.2, start + CHORD_LEN + 1.2
        m = (t >= max(0, a)) & (t < b)
        if not m.any():
            continue
        tt = t[m]
        env = np.clip((tt - a) / 2.4, 0, 1) * np.clip((b - tt) / 2.4, 0, 1)
        env = env * env * (3 - 2 * env)
        for i, n in enumerate(CHORDS[c % 4][1:]):
            f = midi(n)
            for ch, det in ((0, -0.08), (1, 0.08)):
                ff = f * 2 ** (det / 12) * (1 + 0.0025 * np.sin(2 * np.pi * 5.1 * tt + i))
                ph = 2 * np.pi * np.cumsum(ff) / SR
                w = sum(np.sin(h * ph + h * i) / h ** 1.35 for h in range(1, 7))
                out[ch, m] += w * env * 0.028
    return out


def piano_note(f, dur, vel):
    L = int(SR * dur)
    tt = np.arange(L) / SR
    partials = [(1, 1.0, 1.6), (2.002, .45, 2.6), (3.005, .22, 3.8), (4.01, .12, 5.5), (5.02, .06, 7)]
    x = np.zeros(L)
    for k, a, d in partials:
        x += a * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * d * (0.7 + f / 900))
    hammer = rng.standard_normal(L) * np.exp(-tt * 140) * 0.08
    att = np.clip(tt / 0.006, 0, 1)
    return (x * att + hammer) * vel


def piano():
    """A simple phrase over each chord, sparse at the open, fuller later."""
    out = np.zeros((2, N))
    phrase = [(0, 2, .9), (1.5, 4, .6), (2, 3, .7), (3, 5, .55), (4.5, 4, .6), (6, 2, .7), (7, 1, .5)]
    x = 0.0
    c = 0
    while x < DUR + TAIL:
        notes = sorted(set(CHORDS[c % 4][2:]))
        e = float(np.interp(x, t[::480], ENERGY[::480]))
        sparse = e < 0.35
        for beat, idx, vel in phrase:
            if sparse and beat not in (0, 4.5):
                continue
            if (70.8 < x + beat * BEAT < 73.5 or 80.8 < x + beat * BEAT < 86.0) and beat not in (0,):
                continue
            n = notes[idx % len(notes)] + (12 if idx >= 4 and c % 2 else 0)
            v = piano_note(midi(n + 12), 2.6, 0.11 * vel * (0.7 + 0.5 * e))
            i0 = int((x + beat * BEAT) * SR)
            if i0 >= N:
                continue
            end = min(N, i0 + len(v))
            pan = 0.5 + 0.25 * np.sin(idx * 1.3)
            out[0, i0:end] += v[: end - i0] * (1 - pan)
            out[1, i0:end] += v[: end - i0] * pan
        x += CHORD_LEN
        c += 1
    return out


def sub():
    out = np.zeros(N)
    for c in range(int((DUR + TAIL) // CHORD_LEN) + 2):
        start = c * CHORD_LEN
        m = (t >= start) & (t < start + CHORD_LEN)
        tt = t[m] - start
        e = np.clip(tt / 0.5, 0, 1) * np.clip((CHORD_LEN - tt) / 0.5, 0, 1)
        out[m] += np.sin(2 * np.pi * midi(CHORDS[c % 4][0] - 12) * t[m]) * e
    g = curve([(0, 0), (6.0, 0), (6.4, .08), (11.0, .1), (11.9, 0), (12.15, .2), (70.6, .2), (70.9, .06), (73.4, .06), (73.6, .28), (80.5, .28), (81.6, .06), (DUR, 0), (DUR + TAIL, 0)])
    return out * g


def drums():
    out = np.zeros((2, N))
    step = BEAT / 2
    k = 0
    x = 12.15
    while x < 80.6:
        i0 = int(x * SR)
        if 70.8 <= x < 73.55:
            k += 1
            x += step
            continue
        peak = x >= 73.55
        # shaker on every eighth, accented off-beats
        L = int(SR * 0.08)
        sh = rng.standard_normal(L)
        sh = np.diff(np.concatenate([[0], sh]))
        sh *= np.exp(-np.arange(L) / (SR * 0.018)) * (0.05 if k % 2 else 0.028) * (1.4 if peak else 1)
        end = min(N, i0 + L)
        out[0, i0:end] += sh[: end - i0] * 0.8
        out[1, i0:end] += sh[: end - i0] * 1.1
        # rim on 2 and 4
        if k % 4 == 2:
            L2 = int(SR * 0.06)
            tt = np.arange(L2) / SR
            rim = (np.sin(2 * np.pi * 1700 * tt) * 0.5 + rng.standard_normal(L2) * 0.4) * np.exp(-tt * 70) * 0.07
            end = min(N, i0 + L2)
            out[:, i0:end] += rim[: end - i0]
        # soft kick on 1 (and 3 at the peak)
        if k % 4 == 0 or (peak and k % 2 == 0):
            L3 = int(SR * 0.4)
            tt = np.arange(L3) / SR
            f = 48 + 60 * np.exp(-tt * 26)
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * (0.32 if peak else 0.2)
            end = min(N, i0 + L3)
            out[:, i0:end] += kick[: end - i0]
        k += 1
        x += step
    fade = curve([(0, 0), (12.0, 0), (12.2, 1), (80.4, 1), (80.7, 0), (DUR + TAIL, 0)])
    return out * fade


# ------------------------------------------------------------------ interface sounds
def noise(n):
    return rng.standard_normal(n)


def onepole(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += (1 - a) * (x[i] - acc)
        y[i] = acc
    return y


def tone(f, dur, decay, harm=0.25):
    tt = np.arange(int(SR * dur)) / SR
    return (np.sin(2 * np.pi * f * tt) + harm * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * decay) * np.clip(tt / 0.004, 0, 1)


def mix_at(buf, x, at):
    i0 = int(at * SR)
    end = min(len(buf), i0 + len(x))
    if end > i0:
        buf[i0:end] += x[: end - i0]


def swoosh(dur, up=False, gain=0.4, dark=0.9):
    L = int(SR * dur)
    x = noise(L)
    x = onepole(x, dark) - onepole(x, 0.995)
    tt = np.arange(L) / L
    env = tt ** 2.2 * (tt < 0.98) if up else np.sin(np.pi * tt) ** 2
    return x * env * gain * 2.5


def chime(notes, gap=0.09, decay=6, gain=0.15):
    out = np.zeros(int(SR * (gap * len(notes) + 1.0)))
    for i, n in enumerate(notes):
        mix_at(out, tone(midi(n), 0.9, decay, 0.3) * gain, i * gap)
    return out


def sfx(kind, idx):
    if kind == 'tap':
        L = int(SR * 0.025)
        return (tone(1500, 0.025, 180, 0) * 0.16 + noise(L) * np.exp(-np.arange(L) / (SR * 0.002)) * 0.05)
    if kind == 'key':
        f = 1900 + 220 * ((idx * 7) % 4)
        L = int(SR * 0.03)
        return tone(f, 0.03, 190, 0) * 0.12 + noise(L) * np.exp(-np.arange(L) / (SR * 0.002)) * 0.06
    if kind == 'type':
        return tone(2600 + 150 * (idx % 3), 0.018, 260, 0) * 0.06
    if kind == 'pop':
        tt = np.arange(int(SR * 0.12)) / SR
        f = 900 + 500 * np.exp(-tt * 40)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 28) * 0.13
    if kind == 'notify':
        return chime([79, 86], gap=0.12, decay=5, gain=0.17)
    if kind == 'haptic':
        out = np.zeros(int(SR * 0.5))
        for i in range(3):
            tt = np.arange(int(SR * 0.08)) / SR
            mix_at(out, np.sin(2 * np.pi * 165 * tt) * np.sin(np.pi * tt / 0.08) * 0.22, i * 0.13)
        return out
    if kind == 'success':
        return chime([74, 78, 81], gap=0.075, decay=6, gain=0.13)
    if kind == 'confirm':
        return chime([74, 81, 86], gap=0.09, decay=4.5, gain=0.16)
    if kind in ('whoosh', 'swipe', 'sheet', 'rise', 'reverse', 'card', 'sent', 'dark'):
        d = {'whoosh': .8, 'swipe': .3, 'sheet': .35, 'rise': 1.6, 'reverse': 1.0, 'card': .55, 'sent': .45, 'dark': .9}[kind]
        g = {'whoosh': .35, 'swipe': .16, 'sheet': .14, 'rise': .3, 'reverse': .35, 'card': .22, 'sent': .2, 'dark': .3}[kind]
        x = swoosh(d, up=kind in ('rise', 'reverse'), gain=g, dark=0.93 if kind in ('dark', 'card') else 0.86)
        if kind == 'card':
            tt = np.arange(int(SR * 0.4)) / SR
            mix_at(x, np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 9) * 0.12, 0.18)
        if kind == 'sent':
            mix_at(x, tone(midi(81), 0.4, 9, 0.2) * 0.09, 0.2)
        return x
    if kind == 'drop':
        tt = np.arange(int(SR * 0.9)) / SR
        thud = np.sin(2 * np.pi * np.cumsum(60 + 80 * np.exp(-tt * 25)) / SR) * np.exp(-tt * 7) * 0.45
        for i in range(7):
            mix_at(thud, tone(rng.uniform(2400, 3600), 0.25, 28, 0.1) * 0.05, 0.04 + i * 0.035 + rng.uniform(0, .02))
        return thud
    if kind == 'count':
        out = np.zeros(int(SR * 1.2))
        for i in range(14):
            mix_at(out, tone(2100 + i * 35, 0.02, 230, 0) * 0.045, i * 0.075)
        return out
    if kind == 'flip':
        return tone(1300, 0.04, 120, 0) * 0.1 + np.concatenate([np.zeros(int(SR * .05)), tone(1700, 0.04, 120, 0) * 0.08])[: int(SR * 0.04)]
    if kind == 'stream':
        out = np.zeros(int(SR * 1.3))
        for i in range(10):
            mix_at(out, tone(midi(86 + (i * 5) % 12), 0.3, 14, 0) * 0.04, i * 0.1)
        return out
    if kind == 'shimmer':
        out = np.zeros(int(SR * 2.2))
        for i, n in enumerate([86, 90, 93, 97, 98]):
            mix_at(out, tone(midi(n), 1.4, 2.8, 0) * 0.03, i * 0.12)
        return out
    if kind == 'paper':
        L = int(SR * 0.7)
        x = onepole(noise(L), 0.6) - onepole(noise(L), 0.98) * 0.3
        tt = np.arange(L) / L
        return x * (np.sin(np.pi * tt) ** 1.5) * (0.6 + 0.4 * np.sin(tt * 60)) * 0.16
    if kind == 'reply':
        return chime([81, 76], gap=0.07, decay=9, gain=0.1)
    if kind == 'merge':
        return chime([74, 78, 81, 86], gap=0.06, decay=5, gain=0.11)
    if kind == 'bloom':
        tt = np.arange(int(SR * 3.0)) / SR
        out = np.zeros(len(tt))
        for i, n in enumerate([62, 69, 74, 78]):
            out += np.sin(2 * np.pi * midi(n) * tt) * np.clip(tt / (0.6 + i * .2), 0, 1) * np.exp(-tt * 1.2) * 0.045
        return out
    if kind == 'impact':
        tt = np.arange(int(SR * 2.0)) / SR
        body = np.sin(2 * np.pi * np.cumsum(42 + 60 * np.exp(-tt * 16)) / SR) * np.exp(-tt * 2.2) * 0.5
        return body + onepole(noise(len(tt)), 0.97) * np.exp(-tt * 8) * 0.4
    if kind == 'slam':
        tt = np.arange(int(SR * 0.9)) / SR
        body = np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-tt * 30)) / SR) * np.exp(-tt * 6) * 0.5
        return body + np.pad(swoosh(0.35, gain=0.22), (0, len(tt) - int(SR * 0.35)))
    if kind == 'stampHit':
        tt = np.arange(int(SR * 0.8)) / SR
        thud = np.sin(2 * np.pi * np.cumsum(70 + 120 * np.exp(-tt * 35)) / SR) * np.exp(-tt * 8) * 0.55
        return thud + onepole(noise(len(tt)), 0.7) * np.exp(-tt * 30) * 0.25
    if kind == 'logo':
        tt = np.arange(int(SR * 5.0)) / SR
        out = np.zeros(len(tt))
        for i, n in enumerate([50, 57, 62, 66, 69, 76]):
            out += np.sin(2 * np.pi * midi(n) * tt) * np.clip(tt / (0.3 + i * 0.07), 0, 1) * np.exp(-tt * 0.65) * 0.055
        out += np.sin(2 * np.pi * midi(93) * tt) * np.clip(tt / 0.8, 0, 1) * np.exp(-tt * 1.4) * 0.018
        return out
    return np.zeros(10)


CENTRED = {'slam', 'stampHit', 'impact', 'logo', 'bloom', 'notify', 'confirm', 'success', 'haptic', 'card', 'drop', 'rise', 'reverse'}


def place_fx():
    out = np.zeros((2, N))
    counters = {}
    for e in EVENTS:
        k = e['type']
        i = counters.get(k, 0)
        counters[k] = i + 1
        x = sfx(k, i) * e.get('gain', 1)
        pan = 0.5 if k in CENTRED else 0.5 + 0.15 * np.sin(i * 1.9)
        mix_at(out[0], x * (1 - pan) * 2, e['t'])
        mix_at(out[1], x * pan * 2, e['t'])
    return out


def reverb(x, seconds=2.8, mix=0.24):
    L = int(SR * seconds)
    tt = np.arange(L) / SR
    ir = rng.standard_normal(L) * np.exp(-tt * 2.6)
    ir[: int(SR * 0.015)] = 0
    ir /= np.sqrt((ir ** 2).sum())
    n = len(x) + L
    nfft = 1 << (n - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - mix) + wet * mix


def main():
    music = strings() * curve([(0, .7), (10, .85), (FIN, .9), (FIN + 7, 1.1), (DUR, .7), (DUR + TAIL, .7)])
    music += piano()
    s = sub()
    music += np.vstack([s, s])
    music += drums()
    music *= 0.55 + 0.6 * ENERGY
    voice = np.zeros(N)
    if VO_PATH:
        with wave.open(VO_PATH) as w:
            v = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32767
        voice[: min(N, len(v))] = v[:N]
        # side-chain: a smoothed envelope of the voice pulls the music down ~8 dB
        env = np.abs(voice)
        k = int(SR * 0.025)
        env = np.convolve(env, np.ones(k) / k, mode='same')
        hold = np.maximum.accumulate(np.where(env > 0.02, np.arange(N), 0))
        talking = (np.arange(N) - hold) < int(SR * 0.35)
        target = np.where(talking & (hold > 0), 0.3, 1.0)
        sm = int(SR * 0.12)
        duck = np.convolve(np.concatenate([np.ones(sm), target]), np.ones(sm) / sm, mode='same')[sm:]
        music *= duck

    fx = place_fx()
    if VO_PATH:
        fx *= 0.4 + 0.6 * duck  # interface hits step back while she speaks, too
    room = reverb(voice, seconds=1.2, mix=0.07)
    if os.environ.get('STEMS'):
        np.save(os.environ['STEMS'] + '-music.npy', (reverb(music[0] + fx[0] * 0.5) * 0.62 + fx[0] * 0.45)[::4])
        np.save(os.environ['STEMS'] + '-voice.npy', (room * 1.5)[::4])
    mix = np.vstack([reverb(music[0] + fx[0] * 0.5) * 0.62 + fx[0] * 0.45 + room * 1.5,
                     reverb(music[1] + fx[1] * 0.5) * 0.62 + fx[1] * 0.45 + room * 1.5])

    L = int(SR * TAIL)
    end = int(SR * DUR)
    fade = 0.5 - 0.5 * np.cos(np.pi * np.arange(L) / L)
    head = mix[:, :L] * fade + mix[:, end:end + L] * (1 - fade)
    mix = np.concatenate([head, mix[:, L:end]], axis=1)

    peak = np.abs(mix).max()
    mix = np.tanh(mix / peak * 1.6) / np.tanh(1.6)
    mix *= 10 ** (-1 / 20) / np.abs(mix).max()
    pcm = (mix.T * 32767).astype('<i2')
    with wave.open(OUT, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', OUT, f'{mix.shape[1] / SR:.2f}s', 'voice:', bool(VO_PATH))


if __name__ == '__main__':
    main()
