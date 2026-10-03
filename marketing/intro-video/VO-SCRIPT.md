# Bermi One — introduction film · voiceover script

**Length:** 75 s. **Voice:** calm, confident, intelligent. Speak like you're explaining to a peer, not announcing an ad. Use natural pauses and no hard sell.

The music already dips under each window below, so drop the recorded voice in at these timecodes. Small timing drift (±0.3 s) is fine.

| # | In | Out | Picture | Line |
|---|----|-----|---------|------|
| 1 | 0:00.6 | 0:03.0 | Fragments drift in: stock, cash, staff… | Your business is moving every day. |
| 2 | 0:03.2 | 0:07.0 | Windows pile up, then the line "Your business shouldn't feel like this." | But your work shouldn't be scattered across different tools. |
| 3 | 0:08.6 | 0:12.2 | Windows collapse into points of light; Bermi One opens | Bring your operations, people, finances and information together. |
| 4 | 0:12.6 | 0:14.4 | "Everything connected." | One connected system. |
| — | 0:15 | 0:27 | **Product demo, no voice.** Let the clicks and the closing carry it. | *(silence)* |
| 5 | 0:29.0 | 0:31.2 | Modules wire into the dashboard | See what's happening. |
| 6 | 0:33.4 | 0:35.8 | Team and Reports dock | Know what needs attention. |
| 7 | 0:40.6 | 0:43.6 | The workflow runs by itself | Automate the work that slows you down. |
| 8 | 0:51.0 | 0:54.2 | The ecosystem orbits | And run your business with clarity. |
| 9 | 1:00.8 | 1:02.3 | Logo settles | Bermi One. |
| 10 | 1:02.6 | 1:05.6 | "Bermi One / Built for modern businesses." | Everything your business needs. Working together. |
| 11 | 1:06.2 | 1:09.8 | The dashboard drifts away into the loop | *(slower)* Run your business as one system. |

**Order of lines.** The brief's line order is kept, except that "Automate the work that slows you down" moves to the automation scene at 0:40.

**Words on screen.** The on-screen text doesn't repeat the voice word for word. It lands just before or after each line, so the two support each other.

## Recording notes
- Record mono, 48 kHz, 24-bit, close mic in a dead room. Leave a second of room tone at the head.
- Read line 11 noticeably slower, with a short breath before "one system."
- **Swahili version:** the same timecodes fit a Swahili read. Keep each line within its window.

## Mixing it in
```sh
# voice.wav is the full 75 s voice track, already placed on these timecodes
ffmpeg -i bermi-one-intro-1080p.mp4 -i voice.wav \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k bermi-one-intro-vo.mp4
```
