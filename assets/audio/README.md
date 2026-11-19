# Music + stings

Original music for HAUNT//HOUND, composed and synthesized from scratch by
The team's music bot, in Python with numpy/scipy (oscillators, filters,
noise). No samples, soundfonts or AI music services were used. Free to use in
the game, its Devpost entry and its trailer.

| File | Use | Length |
|---|---|---|
| garage-loop.ogg / .mp3 | title + garage loop | 76.8 s (32 bars, 100 BPM) |
| duel-loop.ogg / .mp3 | combat loop | 75.0 s (40 bars, 128 BPM) |
| title-sting | title → garage | 3 s |
| victory-sting / defeat-sting | end card | 3 s |

OGG Vorbis q3 is the primary format (gapless). MP3 128k is the fallback for
browsers without Vorbis; its ~24 ms encoder padding is skipped with
loopStart/loopEnd (see src/engine/music.js LOOP_LENGTH_S).
