/**
 * IraqPay Paper Benchmark Script
 *
 * Runs benchmarks against available sandbox endpoints and outputs
 * results for Table 5 of the SoftwareX paper.
 *
 * Usage: npx ts-node paper/run-benchmarks.ts
 */

import { IraqPay } from '../src/index';
import { BenchmarkRunner } from '../src/benchmark';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== IraqPay Gateway Benchmark ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  // --- ZainCash Sandbox (public credentials) ---
  const pay = new IraqPay({
    gateways: {
      zaincash: {
        msisdn: '9647835077893',
        merchantId: '5ffacf6612b5777c6d44266f',
        secret: '$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS',
      },
      cod: {},
    },
    sandbox: true,
    tracing: { enabled: false }, // quiet output
  });

  const runner = new BenchmarkRunner(pay);

  // --- Run ZainCash benchmark ---
  console.log('--- Benchmarking ZainCash (sandbox, 50 iterations, 1s delay) ---');
  const zcReport = await runner.run({
    iterations: 50,
    delayMs: 1000, // avoid rate limiting
    gateways: ['zaincash'],
    paymentTemplate: {
      callbackUrl: 'https://example.com/callback',
      description: 'Benchmark test',
    },
    onProgress: (p) => {
      const status = p.status === 'success' ? `OK ${p.latencyMs}ms` : `FAIL: ${p.error}`;
      process.stdout.write(`\r  ZainCash ${p.iteration}/${p.totalIterations}: ${status}    `);
    },
  });
  console.log('\n');

  // --- Run COD benchmark ---
  console.log('--- Benchmarking COD (local, 50 iterations) ---');
  const codReport = await runner.run({
    iterations: 50,
    delayMs: 0,
    gateways: ['cod'],
    onProgress: (p) => {
      process.stdout.write(`\r  COD ${p.iteration}/${p.totalIterations}: OK ${p.latencyMs}ms    `);
    },
  });
  console.log('\n');

  // --- Try FIB (will fail at auth but measures network latency) ---
  console.log('--- Probing FIB endpoint (auth will fail, measuring network latency) ---');
  const fibPay = new IraqPay({
    gateways: {
      fib: { clientId: 'benchmark_test', clientSecret: 'benchmark_test' },
    },
    sandbox: true,
    tracing: { enabled: false },
  });
  const fibRunner = new BenchmarkRunner(fibPay);
  const fibReport = await fibRunner.run({
    iterations: 10,
    delayMs: 500,
    gateways: ['fib'],
    paymentTemplate: {
      callbackUrl: 'https://example.com/callback',
    },
    onProgress: (p) => {
      const status = p.status === 'success' ? `OK ${p.latencyMs}ms` : `ERR ${p.latencyMs}ms`;
      process.stdout.write(`\r  FIB ${p.iteration}/${p.totalIterations}: ${status}    `);
    },
  });
  console.log('\n');

  // --- Try QiCard ---
  console.log('--- Probing QiCard endpoint (auth will fail, measuring network latency) ---');
  const qiPay = new IraqPay({
    gateways: {
      qicard: { username: 'benchmark_test', password: 'benchmark_test', terminalId: 'T001' },
    },
    sandbox: true,
    tracing: { enabled: false },
  });
  const qiRunner = new BenchmarkRunner(qiPay);
  const qiReport = await qiRunner.run({
    iterations: 10,
    delayMs: 500,
    gateways: ['qicard'],
    paymentTemplate: {
      callbackUrl: 'https://example.com/callback',
    },
    onProgress: (p) => {
      const status = p.status === 'success' ? `OK ${p.latencyMs}ms` : `ERR ${p.latencyMs}ms`;
      process.stdout.write(`\r  QiCard ${p.iteration}/${p.totalIterations}: ${status}    `);
    },
  });
  console.log('\n');

  // --- Try NassPay ---
  console.log('--- Probing NassPay endpoint (auth will fail, measuring network latency) ---');
  const npPay = new IraqPay({
    gateways: {
      nasspay: { username: 'benchmark_test', password: 'benchmark_test' },
    },
    sandbox: true,
    tracing: { enabled: false },
  });
  const npRunner = new BenchmarkRunner(npPay);
  const npReport = await npRunner.run({
    iterations: 10,
    delayMs: 500,
    gateways: ['nasspay'],
    paymentTemplate: {
      callbackUrl: 'https://example.com/callback',
    },
    onProgress: (p) => {
      const status = p.status === 'success' ? `OK ${p.latencyMs}ms` : `ERR ${p.latencyMs}ms`;
      process.stdout.write(`\r  NassPay ${p.iteration}/${p.totalIterations}: ${status}    `);
    },
  });
  console.log('\n');

  // --- Print Results ---
  console.log('='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));

  const allReports = [
    { name: 'ZainCash', report: zcReport },
    { name: 'COD', report: codReport },
    { name: 'FIB (probe)', report: fibReport },
    { name: 'QiCard (probe)', report: qiReport },
    { name: 'NassPay (probe)', report: npReport },
  ];

  for (const { name, report } of allReports) {
    const gw = report.gateways[0];
    console.log(`\n--- ${name} ---`);
    console.log(`  Iterations: ${gw.iterations}`);
    console.log(`  Success: ${gw.successCount}/${gw.iterations} (${(gw.successRate * 100).toFixed(1)}%)`);
    if (gw.latencies.length > 0) {
      console.log(`  Avg: ${gw.stats.avg.toFixed(0)} ms`);
      console.log(`  Median: ${gw.stats.median.toFixed(0)} ms`);
      console.log(`  P95: ${gw.stats.p95.toFixed(0)} ms`);
      console.log(`  P99: ${gw.stats.p99.toFixed(0)} ms`);
      console.log(`  Min: ${gw.stats.min.toFixed(0)} ms`);
      console.log(`  Max: ${gw.stats.max.toFixed(0)} ms`);
      console.log(`  StdDev: ${gw.stats.stdDev.toFixed(0)} ms`);
    }
    if (gw.errors.length > 0) {
      console.log(`  Errors:`);
      for (const err of gw.errors) {
        console.log(`    - ${err.message.slice(0, 80)} (x${err.count})`);
      }
    }
    // Also show ALL latencies (including failures) for probes
    if (gw.successCount === 0 && report.raw.length > 0) {
      const allLatencies = report.raw.map(r => r.latencyMs).sort((a, b) => a - b);
      const avg = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
      console.log(`  Network RTT (all, including errors):`);
      console.log(`    Avg: ${avg.toFixed(0)} ms, Min: ${allLatencies[0]} ms, Max: ${allLatencies[allLatencies.length - 1]} ms`);
    }
  }

  // --- Save full reports ---
  const outputDir = path.join(__dirname);

  // Markdown
  const md = BenchmarkRunner.toMarkdown(zcReport);
  fs.writeFileSync(path.join(outputDir, 'benchmark-zaincash.md'), md);
  console.log('\n\nSaved: paper/benchmark-zaincash.md');

  // CSV
  const allRaw = [...zcReport.raw, ...codReport.raw, ...fibReport.raw, ...qiReport.raw, ...npReport.raw];
  const csvLines = ['gateway,iteration,success,latency_ms,error,timestamp'];
  for (const e of allRaw) {
    csvLines.push([
      e.gateway, e.iteration, e.success, e.latencyMs,
      e.error ? `"${e.error.replace(/"/g, '""')}"` : '', e.timestamp,
    ].join(','));
  }
  fs.writeFileSync(path.join(outputDir, 'benchmark-results.csv'), csvLines.join('\n'));
  console.log('Saved: paper/benchmark-results.csv');

  // JSON
  const jsonData = {
    timestamp: new Date().toISOString(),
    zaincash: zcReport.gateways[0],
    cod: codReport.gateways[0],
    fib_probe: fibReport.gateways[0],
    qicard_probe: qiReport.gateways[0],
    nasspay_probe: npReport.gateways[0],
  };
  fs.writeFileSync(path.join(outputDir, 'benchmark-results.json'), JSON.stringify(jsonData, null, 2));
  console.log('Saved: paper/benchmark-results.json');

  console.log('\nDone!');
}

main().catch(console.error);
