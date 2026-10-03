# Bermi One — phone film · voiceover script

**Length:** 2:58, vertical 1080×1920. **Voice:** warm, calm, close to the mic, like telling a friend about something you trust. No announcer energy.

Each line sits under the on-screen caption that carries the same thought. The music already makes room in every window below, so the read drops straight in.

| # | In | Out | Chapter | Line |
|---|----|-----|---------|------|
| 1 | 0:01.3 | 0:04.8 | Cold open | It's eleven at night. The bar is closing. |
| 2 | 0:11.4 | 0:15.0 | Title | Bermi One. One system for every business. |
| 3 | 0:20.7 | 0:25.2 | 01 Who's working? | Every person signs in with their own PIN. |
| 4 | 0:25.5 | 0:29.8 | 01 | Staff record the work. Owners make the decisions. |
| 5 | 0:31.9 | 0:35.8 | 02 Stock | Every bottle, every category — live. |
| 6 | 0:36.3 | 0:41.0 | 02 | And low stock warns you before it runs out. |
| 7 | 0:43.1 | 0:46.6 | 03 Delivery | A crate arrives? Add it in seconds. |
| 8 | 0:47.1 | 0:51.2 | 03 | It goes straight into tonight's count. |
| 9 | 0:53.3 | 0:58.0 | 04 Close the day | Count what's on the shelf. |
| 10 | 0:58.5 | 1:02.2 | 04 | Bermi does the maths. |
| 11 | 1:02.7 | 1:07.4 | 04 | Sold, sales and expected cash — instantly. |
| 12 | 1:09.5 | 1:12.8 | 05 Every shilling | Cash, mobile money and bank. |
| 13 | 1:13.3 | 1:19.4 | 05 | Expenses, losses and staff debts all go into the count. |
| 14 | 1:21.7 | 1:23.2 | 06 Submit. Verify. | Joseph submits. |
| 15 | 1:23.7 | 1:27.0 | 06 | Neema sees it, wherever she is. |
| 16 | 1:27.5 | 1:32.6 | 06 | One tap — and it's verified. |
| 17 | 1:34.9 | 1:40.8 | 07 Tomorrow | Tomorrow starts already counted. |
| 18 | 1:43.1 | 1:47.2 | 08 Cash book | The cash book writes itself. |
| 19 | 1:47.7 | 1:52.2 | 08 | Money in, money out — always balanced. |
| 20 | 1:54.3 | 1:58.8 | 09 Reports | See your week at a glance. |
| 21 | 1:59.3 | 2:05.2 | 09 | Send it as a PDF, or straight to WhatsApp. |
| 22 | 2:07.5 | 2:11.8 | 10 Ask Bermi | Ask anything about your business. |
| 23 | 2:12.3 | 2:16.6 | 10 | Bermi answers from your own numbers. |
| 24 | 2:18.7 | 2:25.6 | 11 Every branch | Every branch, in one account. |
| 25 | 2:27.9 | 2:32.8 | 12 Language | Kiswahili or English. Light or dark. |
| 26 | 2:35.1 | 2:38.0 | 13 Pay | Pay monthly, quarterly or yearly — |
| 27 | 2:38.4 | 2:42.2 | 13 | by mobile money, switched on by itself. |
| 28 | 2:43.4 | 2:48.4 | Finale | *(slower)* Run your business as one system. |
| 29 | 2:50.6 | 2:53.6 | Logo | Bermi One. |

## Notes
- Record mono, 48 kHz, 24-bit, in a quiet, dead room. Leave a second of room tone at the head.
- **Swahili read:** the same windows fit a Swahili version. Keep each line inside its window.
- **Mixing it in** (voice.wav is the full-length voice track, already placed on these timecodes):

```sh
ffmpeg -i bermi-one-phone-film.mp4 -i voice.wav \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k bermi-one-phone-film-vo.mp4
```
