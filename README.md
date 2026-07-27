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

## Production deployment

The production image is a non-root, standalone Next.js container. Docker
Compose exposes it only on `127.0.0.1:3000`, ready for the EC2 reverse proxy.

The GitHub Actions workflow in `.github/workflows/deploy-ec2.yml` deploys every
push to `main` and can also be run manually. Create a GitHub Environment named
`production` with these values:

| Type | Name | Value |
|---|---|---|
| Secret | `EC2_HOST` | EC2 hostname or public IP |
| Secret | `EC2_USER` | SSH user, for example `ubuntu` |
| Secret | `EC2_DEPLOY_PATH` | Absolute portal-only path, for example `/opt/meridian-doctor-portal` |
| Secret | `EC2_SSH_PRIVATE_KEY` | Private deployment key |
| Secret | `EC2_SSH_KNOWN_HOSTS` | Pinned `known_hosts` entry for the EC2 host |
| Variable | `NEXT_PUBLIC_API_URL` | Production API base URL, for example `https://api.example.com/api/v1` |

`NEXT_PUBLIC_API_URL` may be stored as a secret instead of a variable, but it
is public by design because Next.js embeds it into the browser bundle. The
workflow requires an HTTPS non-localhost value and supplies it during the image
build; changing it requires a new deployment.

The EC2 host must already have Docker Engine, Docker Compose v2, and a reverse
proxy forwarding the portal hostname to `127.0.0.1:3000`. The workflow builds
the exact Git commit, checks container health, and rolls back to the prior image
if the new release does not become healthy.
