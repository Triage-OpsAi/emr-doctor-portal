# Meridian Health AI — Doctor Portal

Next.js clinical workspace for voice patient intake, longitudinal EMR review,
clinical-document upload and discharge-summary generation.

## Run locally

```powershell
npm install
npm run dev
```

The portal runs at `http://localhost:3000` and uses
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api/v1`.

## Services used by this portal

| Service | Responsibility |
|---|---|
| Doctor portal | Patient list and dedicated patient chart pages |
| FastAPI clinical API | Authenticated tenant-scoped API and job lifecycle |
| Clinical file storage service | Direct private uploads to Backblaze and signed listen/download links |
| Voice transcription worker | Indian-language speech recognition and English translation |
| Patient/EMR reasoning worker | Patient EMR, report and discharge-summary generation |
| Report reasoning service | PDF, Word and image report summaries |
| Discharge service | Recorded instructions, complete-chart reasoning, PDF creation and B2 storage |
| PostgreSQL | Durable clinical and processing state |
| Redis-compatible broker | Separate worker queues |
| Backblaze B2 | Private audio, reports and generated PDFs |
| Sarvam AI | Multilingual transcription/translation |
| OpenAI Responses API | Structured clinical reasoning |

See `../emr-backend/README.md` for exact processes, commands, queue routes and
backend service ownership.

## Checks

```powershell
npx tsc --noEmit
npm run lint
npm run build
```
