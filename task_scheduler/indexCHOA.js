const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { runChoaAlgorithm, getWorkerSpec, WORKER_SPECS } = require('./choa_algorithm/choa'); // Updated import

const app = express();
app.use(express.json());

// Define workers with their URLs
const workers = [
  'http://192.168.56.11:31001', // VM 1
  'http://192.168.56.11:31002', // VM 2
  'http://192.168.56.12:31001', // VM 3
  'http://192.168.56.12:31002', // VM 4
  'http://192.168.56.13:31001', // VM 5
  'http://192.168.56.13:31002'  // VM 6
];

let makespanStart = null;
let makespanEnd = null;
let completedTasks = 0;
const totalTasks = 1000;
let currentIndex = 0;
let totalCost = 0;

const startTimes = [];
const finishTimes = [];
const executionTimes = [];
const cpuUsages = [];
const waitingTimes = [];
const executionTimeByWorker = {};

let tasks = [];
let choaMapping = [];

try {
  const data = fs.readFileSync(path.join(__dirname, 'tasks1000.json'));
  tasks = JSON.parse(data);
} catch (err) {
  console.error('Failed to read tasks.json:', err.message);
  process.exit(1);
}

app.post('/cpu-usage-report', (req, res) => {
  const { host, avgCpu } = req.body;
  cpuUsages.push({ time: Date.now(), host, avgCpu });
  res.json({ status: 'received' });
});

app.post('/schedule', async (req, res) => {
  if (currentIndex === 0) {
    cpuUsages.length = 0;
  }

  if (choaMapping.length === 0) {
    console.log('Running ChOA algorithm with worker specifications...');
    choaMapping = runChoaAlgorithm(tasks.length, workers.length, tasks);
    console.log('📌 ChOA Mapping:', choaMapping);

    if (!Array.isArray(choaMapping) || choaMapping.length !== tasks.length) {
      console.error('❌ Invalid ChOA mapping');
      process.exit(1);
    }
  }

  if (currentIndex >= tasks.length) {
    return res.status(400).json({ error: 'All tasks have been completed' });
  }

  const task = tasks[currentIndex];
  const targetIndex = choaMapping[currentIndex];
  const targetWorker = workers[targetIndex];
  const workerSpec = getWorkerSpec(targetIndex);
  currentIndex++;

  if (!makespanStart) makespanStart = Date.now();

  try {
    const response = await axios.post(`${targetWorker}/api/execute`, { 
      task: task.weight
    });

    const workerURL = targetWorker;
    const startTime = response.data?.result?.start_time || 0;
    const finishTime = response.data?.result?.finish_time || 0;
    const execTime = response.data?.result?.execution_time || 0;

    const costPerMips = 0.5;
    const taskCost = execTime / 1000 * costPerMips;
    totalCost += taskCost;

    startTimes.push(startTime);
    finishTimes.push(finishTime);
    executionTimes.push(execTime);
    waitingTimes.push(startTime - makespanStart);

    if (!executionTimeByWorker[workerURL]) {
      executionTimeByWorker[workerURL] = 0;
    }
    executionTimeByWorker[workerURL] += execTime;

    completedTasks++;

    if (completedTasks === totalTasks) {
      makespanEnd = Date.now();
      const makespanDurationSec = (makespanEnd - makespanStart) / 1000;
      const throughput = totalTasks / makespanDurationSec;

      const avgStart = startTimes.reduce((a, b) => a + b, 0) / startTimes.length;
      const avgFinish = finishTimes.reduce((a, b) => a + b, 0) / finishTimes.length;
      const avgExec = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;

      const allExecs = Object.values(executionTimeByWorker);
      const totalCPUTime = allExecs.reduce((a, b) => a + b, 0);
      const totalValues = allExecs.length;
      const Tavg = totalCPUTime / totalValues;
      const Tmax = Math.max(...allExecs);
      const Tmin = Math.min(...allExecs);
      const imbalanceDegree = (Tmax - Tmin) / Tavg;

      const grouped = {};
      cpuUsages.forEach(entry => {
        if (!grouped[entry.host]) grouped[entry.host] = [];
        grouped[entry.host].push(entry.avgCpu);
      });

      let ruSum = 0;
      let ruCount = 0;
      for (const host in grouped) {
        const hostAvg = grouped[host].reduce((a, b) => a + b, 0) / grouped[host].length;
        ruSum += hostAvg;
        ruCount++;
      }

      const resourceUtilization = ruCount > 0 ? ruSum / ruCount : 0;

      const totalWaiting = waitingTimes.reduce((a, b) => a + b, 0);
      const avgWaitingTime = totalWaiting / totalTasks;

      console.log(`✅ All tasks completed with ChOA-OBL.`);
      console.log(`🕒 Makespan: ${makespanDurationSec.toFixed(2)} seconds`);
      console.log(`💲 Total Cost: $${totalCost.toFixed(2)}`);
      console.log(`📈 Throughput: ${throughput.toFixed(2)} tasks/sec`);
      console.log(`⏱️ Avg Waiting Time: ${avgWaitingTime.toFixed(6)} ms`);
      console.log(`💡 Resource Utilization: ${resourceUtilization.toFixed(4)}%`);
      console.log(`📊 Avg Start: ${avgStart.toFixed(2)} ms`);
      console.log(`📊 Avg Finish: ${avgFinish.toFixed(2)} ms`);
      console.log(`📊 Avg Exec Time: ${avgExec.toFixed(2)} ms`);
      console.log(`⚖️ Imbalance Degree: ${imbalanceDegree.toFixed(3)}`);
    }

    res.json({
      status: 'sent',
      task: task.name,
      weight: task.weight,
      worker: targetWorker,
      result: response.data
    });

  } catch (err) {
    console.error(`❌ Failed to send task to ${targetWorker}:`, err.message);
    res.status(500).json({
      error: 'Worker unreachable',
      worker: targetWorker,
      task: task.name,
      weight: task.weight
    });
  }
});

app.post('/reset', (req, res) => {
  currentIndex = 0;
  completedTasks = 0;
  makespanStart = null;
  makespanEnd = null;
  choaMapping = [];
  startTimes.length = 0;
  finishTimes.length = 0;
  executionTimes.length = 0;
  totalCost = 0;
  cpuUsages.length = 0;
  waitingTimes.length = 0;
  for (let key in executionTimeByWorker) delete executionTimeByWorker[key];

  res.json({ status: 'reset done' });
});

app.listen(8080, () => {
  console.log('🚀 Broker running on port 8080 (ChOA-OBL with Worker Specifications ENABLED)');
});