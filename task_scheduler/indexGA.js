index.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { geneticAlgorithm } = require('./ga_algorithm/ga');
// const { runMOICS } = require('./moics/runMOICS')

const app = express();
app.use(express.json());

// Daftar IP:PORT worker
const workers = [
  'http://192.168.56.11:31001',
  'http://192.168.56.11:31002',
  'http://192.168.56.12:31001',
  'http://192.168.56.12:31002',
  'http://192.168.56.13:31001',
  'http://192.168.56.13:31002'
];

// Round Robin Disabled
// let currentWorker = 0;

let makespanStart = null;
let makespanEnd = null;
let completedTasks = 0;
const totalTasks = 50;
let currentIndex = 0;
let totalCost = 0;

const startTimes = [];
const finishTimes = [];
const executionTimes = [];
const executionTimeByWorker = {};

let tasks = [];
let gaMapping = []; // 🔄 Hasil GA Algorithm: mapping index task -> index worker
let moicsMapping = [];

// Load tasks
try {
  const data = fs.readFileSync(path.join(__dirname, 'tasks500.json'));
  tasks = JSON.parse(data);
} catch (err) {
  console.error('Gagal membaca tasks.json:', err.message);
  process.exit(1);
}

// Endpoint penjadwalan menggunakan GA Algorithm
app.post('/schedule', async (req, res) => {
  // Jalankan GA Algorithm saat pertama kali
  if (gaMapping.length === 0) {
    gaMapping = geneticAlgorithm(tasks.length, workers.length); // 🔄 Menjalankan GA Algorithm untuk mapping
    console.log('📌 GA Algorithm mapping:', gaMapping);

    // Debug jika mapping kosong
    if (!Array.isArray(gaMapping) || gaMapping.length !== tasks.length) {
      console.error(`❌ Invalid mapping: expected ${tasks.length} entries, got ${gaMapping.length}`);
      process.exit(1);
    }
  }

  if (currentIndex >= tasks.length) {
    return res.status(400).json({
      error: 'Semua task telah selesai dijalankan'
    });
  }

  const task = tasks[currentIndex];
  const targetIndex = gaMapping[currentIndex]; // 🔄 Alokasi berdasarkan GA Algorithm
  const targetWorker = workers[targetIndex];
  currentIndex++;

  if (!makespanStart) {
    makespanStart = Date.now();
  }

  try {
    // Menambahkan informasi task yang akan diproses
    const response = await axios.post(`${targetWorker}/api/execute`, { task: task.type }); // Mengirim task berdasarkan type

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

      console.log(`✅ All tasks completed.`);
      console.log(`🕒 Makespan: ${makespanDurationSec.toFixed(2)} detik`);
      console.log(`📈 Throughput: ${throughput.toFixed(2)} tugas/detik`);
      console.log(`📊 Average Start Time: ${avgStart.toFixed(2)} ms`);
      console.log(`📊 Average Finish Time: ${avgFinish.toFixed(2)} ms`);
      console.log(`📊 Average Execution Time: ${avgExec.toFixed(2)} ms`);
      console.log(`⚖️ Imbalance Degree: ${imbalanceDegree.toFixed(3)}`);
      console.log(`💲 Total Cost: $${totalCost}`);
    }

    res.json({
      status: 'sent',
      task: task.name,
      weight: task.weight,
      worker: targetWorker,
      result: response.data
    });

  } catch (err) {
    console.error(`Gagal mengirim task ke ${targetWorker}:`, err.message);
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
  gaMapping = [];
  moicsMapping = [];
  startTimes.length = 0;
  finishTimes.length = 0;
  executionTimes.length = 0;
  totalCost = 0;
  for (let key in executionTimeByWorker) delete executionTimeByWorker[key];

  res.json({ status: 'reset done' });
});

app.listen(8080, () => {
  console.log('🚀 Broker running on port 8080 (GA ALGORITHM ENABLED)');
});