const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// GAP_MS controls the delay between events. 
// Speed this up to tighten the 3-minute live demo pacing[cite: 18].
const GAP_MS = 2200; 

app.post('/run', (req, res) => {
  const run_id = Math.random().toString(36).substring(7);
  app.locals[run_id] = req.body;
  res.json({ run_id }); //[cite: 19]
});

app.get('/run/:run_id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const config = app.locals[req.params.run_id] || { mode: 'dry-run' };
  let step = 0;

  const processStream = setInterval(() => {
    if (config.mode === 'naive') {
      // Naive Mode Sequence[cite: 19]
      if (step === 0) res.write(`event: executing\ndata: {"message": "Running DROP TABLE directly on production..."}\n\n`);
      if (step === 1) {
        res.write(`event: error\ndata: {"message": "nightly_report_job crashed — dependency on old_sessions", "rows_lost": 48213}\n\n`);
        clearInterval(processStream);
        res.end();
      }
    } else {
      // Dry-Run Mode Sequence[cite: 19]
      if (step === 0) res.write(`event: fork_started\ndata: {"message": "Forking a copy of the database..."}\n\n`);
      if (step === 1) res.write(`event: plans_generated\ndata: {"plans": [{"plan_id": "A", "label": "Hard delete"}, {"plan_id": "B", "label": "Archive, then delete in 30 days"}]}\n\n`);
      if (step === 2) res.write(`event: plan_testing\ndata: {"plan_id": "A"}\n\n`);
      if (step === 3) res.write(`event: plan_result\ndata: {"plan_id": "A", "status": "failed", "reason": "nightly_report_job still reads from this table"}\n\n`);
      if (step === 4) res.write(`event: plan_testing\ndata: {"plan_id": "B"}\n\n`);
      if (step === 5) res.write(`event: plan_result\ndata: {"plan_id": "B", "status": "passed", "reason": "No dependencies found. Safe to archive."}\n\n`);
      if (step === 6) res.write(`event: committing\ndata: {"plan_id": "B", "message": "Applying the winning plan..."}\n\n`);
      if (step === 7) {
        res.write(`event: committed\ndata: {"plan_id": "B", "message": "Done. old_sessions archived, 0 rows lost."}\n\n`);
        clearInterval(processStream);
        res.end();
      }
    }
    step++;
  }, GAP_MS);

  req.on('close', () => clearInterval(processStream));
});

app.listen(4000, '127.0.0.1', () => console.log('Mock server running on 127.0.0.1:4000'));