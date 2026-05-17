# v8.11.168 Cursor Regression Closure

Target: https://openmanager-ai.vercel.app
Version: 8.11.168
GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2531890112

## Production Playwright DOM Check

- `/api/version`: `8.11.168`
- `.custom-cursor-dot`: `0`
- `.custom-cursor-ring`: `0`
- `.has-custom-cursor`: `0`
- `.mouse-spotlight__fragment`: `24`
- `body cursor`: `auto`
- Before mouse move: first fragment `--react-x=-31.82px`, opacity `0.594`
- After mouse move: first fragment `--react-x=25.78px`, `--react-y=14.21px`, opacity `0.397`

## Font Check

- Computed body font starts with `Noto Sans KR`
- Loaded `Noto Sans KR` FontFace count: `40`
- `Noto Sans KR Fallback` FontFace status remains `error`
- Rendering impact: none observed; fallback status is recorded as a known next/font DevTools/FontFace API artifact.

## Network Check

- Landing page network scan after `networkidle`: no HTTP responses with status `>=400`.
