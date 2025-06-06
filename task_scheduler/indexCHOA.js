const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { runChoaAlgorithm } = require('./choa_algorithm/choa');

const app = express();
app.use(express.json());

const workers = [
  'http://192.168.56.11:31001',
  'http://192.168.56.11:31002',
  'http://192.168.56.12:31001',
  'http://192.168.56.12:31002',
  'http://192.168.56.13:31001',
  'http://192.168.56.13:31002'
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
let lastFinishTime = 0; // Track the finish time of the last executed task

let tasks = [];
let choaMapping = [];

try {
  const data = fs.readFileSync(path.join(__dirname, 'tasks1000.json'));
  tasks = JSON.parse(data);
} catch (err) {
  console.error('Gagal membaca tasks.json:', err.message);
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
    lastFinishTime = 0;
  }

  if (choaMapping.length === 0) {
    choaMapping = runChoaAlgorithm(tasks.length, workers.length, tasks);
    console.log('📌 ChOA Mapping:', choaMapping);

    if (!Array.isArray(choaMapping) || choaMapping.length !== tasks.length) {
      console.error(`❌ Invalid ChOA mapping`);
      process.exit(1);
    }
  }

  if (currentIndex >= tasks.length) {
    return res.status(400).json({ error: 'Semua task telah selesai dijalankan' });
  }

  const task = tasks[currentIndex];
  const targetIndex = choaMapping[currentIndex];
  const targetWorker = workers[targetIndex];
  currentIndex++;

  if (!makespanStart) makespanStart = Date.now();

  try {
    const response = await axios.post(`${targetWorker}/api/execute`, { task: task.weight });

    const workerURL = targetWorker;
    const startTime = response.data?.result?.start_time || 0;
    const finishTime = response.data?.result?.finish_time || 0;
    const execTime = response.data?.result?.execution_time || 0;

    const costPerMips = 0.5;
    const taskCost = execTime / 1000 * costPerMips;
    totalCost += taskCost;

    // Store relative times from makespanStart
    const relativeStartTime = startTime - makespanStart;
    const relativeFinishTime = finishTime - makespanStart;

    startTimes.push(relativeStartTime);
    finishTimes.push(relativeFinishTime);
    executionTimes.push(execTime);

    // Implement waiting time according to the journal
    // For first task, waiting time is 0
    // For subsequent tasks, waiting time is the time it waited for previous tasks
    let waitingTime;
    if (completedTasks === 0) {
      waitingTime = 0;
    } else {
      waitingTime = lastFinishTime; // Time task had to wait from start of simulation
    }
    waitingTimes.push(waitingTime);
    
    // Update the last finish time (for next tasks' waiting time)
    lastFinishTime = relativeFinishTime;

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

      // Calculate average waiting time according to journal
      const totalWaitingTime = waitingTimes.reduce((a, b) => a + b, 0);
      const avgWaitingTime = totalWaitingTime / totalTasks;

      // Calculate scheduling length (total waiting time + makespan)
      const schedulingLength = totalWaitingTime + (makespanEnd - makespanStart);

      // Hitung Resource Utilization
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

      console.log(`✅ All tasks completed with ChOA OBL.`);
      console.log(`🕒 Makespan: ${makespanDurationSec.toFixed(2)} detik`);
      console.log(`💲 Total Cost: $${totalCost.toFixed(2)}`);
      console.log(`📈 Throughput: ${throughput.toFixed(2)} tugas/detik`);
      console.log(`⏱️ Avg Waiting Time: ${avgWaitingTime.toFixed(2)} ms`);
      console.log(`💡 Resource Utilization: ${resourceUtilization.toFixed(4)}%`);
      console.log(`📊 Avg Start: ${avgStart.toFixed(2)} ms`);
      console.log(`📊 Avg Finish: ${avgFinish.toFixed(2)} ms`);
      console.log(`📊 Avg Exec Time: ${avgExec.toFixed(2)} ms`);
      console.log(`⚖️ Imbalance Degree: ${imbalanceDegree.toFixed(3)}`);
      console.log(`📋 Scheduling Length: ${schedulingLength.toFixed(2)} ms`);
    }

    res.json({
      status: 'sent',
      task: task.name,
      weight: task.weight,
      worker: targetWorker,
      result: response.data
    });

  } catch (err) {
    console.error(`❌ Gagal kirim task ke ${targetWorker}:`, err.message);
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
  const cpuUsages = []; 
  cpuUsages.length = 0;
  waitingTimes.length = 0;
  for (let key in executionTimeByWorker) delete executionTimeByWorker[key];

  res.json({ status: 'reset done' });
});

app.listen(8080, () => {
  console.log('🚀 Broker running on port 8080 (ChOA OBL ENABLED)');
});
