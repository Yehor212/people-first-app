# Hyperfocus Gemini/Lyria Pilot QC - 2026-06-19

## Verdict

Do not integrate either pilot into ZenFlow.

Both files were generated through Google Lyria 3 Clip, which satisfies the Google/Gemini-family provider constraint but does not satisfy the Hyperfocus soundscape loop requirement in this environment. The generated audio behaves like a produced clip with end fade and peak issues, not like a stable loopable environmental bed.

## Pilot 1

- Model: lyria-3-clip
- Generation id: 2c1c3499-8fb2-4fa8-88b1-6bad04a01cb1
- Local quarantine file: output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3
- SHA-256: f0ebe90779a78b4614199533bc67185adff534650c9fa0893b7d7facb579843c
- Duration: 28.317s
- Channels/sample rate: 2ch, 44100Hz
- RMS: -14.29 dBFS
- Peak: 0 dBFS
- Clipped samples: 20
- Start RMS: -13.37 dBFS
- End RMS: -59.47 dBFS
- Seam mean absolute diff: 0.152222
- Technical verdict: REVIEW_REQUIRED

Reject reasons:

- Peak reaches 0 dBFS.
- Clipped samples are present.
- End fades far below start level, which breaks seamless looping.
- Agent cannot verify listening quality; audible review remains UNVERIFIED.

## Pilot 2

- Model: lyria-3-clip
- Generation id: 9dfc0bc6-e371-49f9-a1ee-f59b4d861e5f
- Local quarantine file: output/audio-quarantine/hyperfocus-fireplace-soft-revised-raw.mp3
- SHA-256: 7430486ed1e0bf392fddd2b39850be318ed77093e975a2e25fcfa1013258d963
- Duration: 29.127s
- Channels/sample rate: 2ch, 44100Hz
- RMS: -14.47 dBFS
- Peak: 0 dBFS
- Clipped samples: 157
- Start RMS: -13.55 dBFS
- End RMS: -65.76 dBFS
- Seam mean absolute diff: 0.143613
- Technical verdict: REVIEW_REQUIRED

Reject reasons:

- Peak reaches 0 dBFS.
- Clipped samples increased.
- End still fades far below start level, which breaks seamless looping.
- Agent cannot verify listening quality; audible review remains UNVERIFIED.

## Decision

Keep the generated pilots in output/audio-quarantine only. Do not copy them into public/sounds and do not wire them into the app.

Continue only when one of these is true:

1. A Gemini-family soundscape or SFX model becomes available.
2. The user explicitly approves using a non-Gemini SFX model such as ElevenLabs SFX.
3. The task changes from environmental soundscapes to musical focus tracks, where Lyria is a better fit.
