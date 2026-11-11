# LeaseManager demo video

Records the product demo (about 7 minutes, 1080p, captions and chapter cards) by
driving the running app in a hidden Chrome window. Nothing in the app is changed
by the recorder itself; the demo actions (approvals, payments…) are real clicks.

## Run it

Docker Desktop must be running with the four containers up (`docker compose up -d`).

```powershell
cd demo-video
npm install          # first time only: playwright-core + ffmpeg
npm run record       # reseeds the demo data, records, writes out\LeaseManager-demo.mp4
```

`npm run record` takes about 15 minutes: the seed, the thirteen chapters in real
time, then a final encode. The video lands in `demo-video\out\`.

Other commands:

| Command | What it does |
|---|---|
| `npm run probe` | Fast dry run: no recording, no data changes, screenshots in `out\probe\` |
| `node record.mjs --only=3,4` | Record only some chapters (data is reseeded first) |
| `node record.mjs --no-seed` | Skip the reseed |
| `node record.mjs --speed=1` | Slower pace (default 1.35) |
| `node record.mjs --headed` | Show the browser while it works |
| `node record.mjs --apicheck` | Read-only API check of every GET endpoint as every account → `out\apicheck.txt` |
| `node record.mjs --survey` | Read-only tour of every page of every account → `out\survey\` and `out\survey.json` |
| `node record.mjs --diag --up --build=api,web` | Health report, then rebuild and restart those containers from the current code |

After a recording the demo data has been changed (approvals, payments…); run
`npm run db:seed:full` in `backend\` before a live demo, as usual.

## What it records

1. Guest: public home page, map, space panel, AI space finder, application form
2. Platform owner: dashboard (KPIs, charts, occupancy), Clients, Users, Analytics, Occupancy heatmap, Predictive maintenance, Export, Email, Audit Logs
3. Client admin (Khalid): dashboard, Team, Company, Buildings, Floors, Spaces, Add-ons, Contracts, Billing, Revenue forecast
4. Manager (Fatima): dashboard, approve Najma Architects, accept a Suite 502 applicant, approve Acme's Conference 7, calendar
5. Reception (Maria): confirm Wakra Coffee Roasters by phone, record a completed visit
6. Manager: finalize Rumaila Consulting Group's lease
7. Manager: AI ticket triage (socket sparked → Electrical / Emergency, Rajesh Nair)
8. West Bay manager: only West Bay's tickets
9. Finance (Omar): dashboard, confirm Brightpath's cheque, renewals, Excel export
10. Technician (Rajesh): dashboard, accept the Zubarah Room leak, start work, risk scoring
11. Renter admin (Noor): lease, submit a payment, team
12. Renter employee (Karim): his bookings, book a room on the floor map
13. API: Swagger, then a live check of every read endpoint as all ten identities

## Files

- `record.mjs` – entry point (options, browser, seeding, encoding)
- `scenes.mjs` – the thirteen chapters, captions and chapter cards
- `lib.mjs` – capture, cursor, captions, camera and timing helpers
- `overlay.js` – the in-page cursor, captions, cards and spotlight
- `apicheck.mjs` / `apiview.mjs` – the API check and its on-screen table
- `survey.mjs` – the read-only page tour used to plan the video
- `runner.mjs` – optional: lets Claude start probe/record runs while the window is open
