#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  TRACKER_PATH,
  TRENDS_JSON_PATH,
  TRENDS_MARKDOWN_PATH,
  buildQaTrendSnapshot,
  writeQaTrendArtifacts,
} = require('./qa-trends');

function printUsage() {
  console.log('Usage: npm run qa:trends [-- --write]');
  console.log('  default: read-only summary from qa-tracker.json');
  console.log(
    '  --write: regenerate reports/qa/QA_TRENDS.md and latest-qa-trends.json'
  );
}

function run() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    printUsage();
    process.exit(0);
  }

  if (!fs.existsSync(TRACKER_PATH)) {
    console.log('qa-tracker.json not found. Run `npm run qa:record` first.');
    process.exit(0);
  }

  const shouldWrite = args.has('--write') || args.has('--sync');
  const tracker = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
  const snapshot = buildQaTrendSnapshot(tracker);

  if (shouldWrite) {
    writeQaTrendArtifacts({
      trackerPath: TRACKER_PATH,
      markdownPath: TRENDS_MARKDOWN_PATH,
      jsonPath: TRENDS_JSON_PATH,
    });
  }

  console.log('QA Trend Summary');
  console.log(`- recorded runs: ${snapshot.totals.recordedRuns}`);
  console.log(`- counted runs: ${snapshot.totals.countedRuns}`);
  console.log(`- overall pass rate: ${snapshot.totals.overallPassRatePct}%`);
  const latestWindow = snapshot.windows.find((item) => item.label === 'Last 10 Counted Runs');
  if (latestWindow) {
    console.log(
      `- last 10 counted runs: fail-rate ${latestWindow.failingRunRatePct}% / regression-rate ${latestWindow.regressionRunRatePct}%`
    );
  }
  console.log(
    `- latest recorded/counting run: ${snapshot.totals.latestRecordedRunId || '-'} / ${snapshot.totals.lastCountedRunId || '-'}`
  );

  if (shouldWrite) {
    console.log(
      `- trends synced: ${path.relative(process.cwd(), TRENDS_MARKDOWN_PATH)}`
    );
    console.log(
      `- trend snapshot synced: ${path.relative(process.cwd(), TRENDS_JSON_PATH)}`
    );
  } else if (fs.existsSync(TRENDS_MARKDOWN_PATH)) {
    console.log(
      `- trend file: ${path.relative(process.cwd(), TRENDS_MARKDOWN_PATH)} (read-only)`
    );
  } else {
    console.log(
      `- trend file missing: ${path.relative(process.cwd(), TRENDS_MARKDOWN_PATH)} (--write to sync)`
    );
  }
}

try {
  run();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
