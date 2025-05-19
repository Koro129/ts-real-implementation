const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GeneticAlgorithm, geneticAlgorithm } = require('./ga_algorithm/ga');
const { PopulationGA } = require('./ga_algorithm/populationGA');

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

let makespanStart = null;
let makespanEnd = null;
let completedTasks = 0;
let totalTasks = 0; // Will be set dynamically based on tasks.length
let currentIndex = 0;
let totalCost = 0;

const startTimes = [];
const finishTimes = [];
const executionTimes = [];
const executionTimeByWorker = {};

let tasks = [];
let gaMapping = []; // 🧬 Hasil Genetic Algorithm: mapping index task -> index worker

// Load tasks
try {
  const data = fs.readFileSync(path.join(__dirname, 'task50.json'));
  tasks = JSON.parse(data);
  totalTasks = tasks.length; // Set totalTasks to match the actual number of tasks
  console.log(`✅ Successfully loaded ${tasks.length} tasks from task50.json`);
  console.log(`✅ Total tasks to process: ${totalTasks}`);
} catch (err) {
  console.error('❌ Gagal membaca task50.json:', err.message);
  process.exit(1);
}

/**
 * Run the Genetic Algorithm for task scheduling
 * @param {number} taskCount - Number of tasks to schedule
 * @param {number} workerCount - Number of available workers
 * @return {Array<number>} Array of worker assignments for each task
 */
function runGeneticAlgorithm(taskCount, workerCount) {
  const populationSize = 10;
  const iterations = 5;
  const crossoverProbability = 0.8;
  const mutationProbability = 0.1;
  
  // Method 1: Using BAT-compatible function (simple)
  const population = [];
  for (let i = 0; i < populationSize; i++) {
    const position = [];
    for (let j = 0; j < taskCount; j++) {
      position.push(Math.floor(Math.random() * workerCount));
    }
    population.push({
      position: position,
      velocity: new Array(taskCount).fill(0),
      fitness: 0
    });
  }
  
  // Run the Genetic Algorithm through BAT-compatible interface
  return geneticAlgorithm(population, iterations);
}

// Endpoint penjadwalan menggunakan Genetic Algorithm
app.post('/schedule', async (req, res) => {
  // Jalankan Genetic Algorithm saat pertama kali
  if (gaMapping.length === 0) {
    console.log('🧬 Running Genetic Algorithm...');
    gaMapping = runGeneticAlgorithm(tasks.length, workers.length);
    console.log('🧬 Genetic Algorithm mapping:', gaMapping);
    
    // Debug jika mapping kosong
    if (!Array.isArray(gaMapping) || gaMapping.length !== tasks.length) {
      console.error(`❌ Invalid GA mapping: expected ${tasks.length} entries, got ${gaMapping.length}`);
      process.exit(1);
    }
  }

  if (currentIndex >= tasks.length) {
    return res.status(400).json({
      error: 'Semua task telah selesai dijalankan'
    });
  }

  const task = tasks[currentIndex];
  const targetIndex = gaMapping[currentIndex]; // 🧬 Alokasi berdasarkan Genetic Algorithm
  const targetWorker = workers[targetIndex % workers.length]; // Ensure index is valid
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
    console.log(`✅ Task ${completedTasks}/${totalTasks} completed`);

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

      console.log(`\n🎉 FINAL RESULTS FOR GENETIC ALGORITHM 🎉`);
      console.log(`✅ All ${totalTasks} tasks completed.`);
      console.log(`🕒 Makespan: ${makespanDurationSec.toFixed(2)} detik`);
      console.log(`📈 Throughput: ${throughput.toFixed(2)} tugas/detik`);
      console.log(`📊 Average Start Time: ${avgStart.toFixed(2)} ms`);
      console.log(`📊 Average Finish Time: ${avgFinish.toFixed(2)} ms`);
      console.log(`📊 Average Execution Time: ${avgExec.toFixed(2)} ms`);
      console.log(`⚖️ Imbalance Degree: ${imbalanceDegree.toFixed(3)}`);
      console.log(`💲 Total Cost: $${totalCost.toFixed(2)}`);
    }

    res.json({
      status: 'sent',
      task: task.name || task.type,
      weight: task.weight,
      worker: targetWorker,
      result: response.data
    });

  } catch (err) {
    console.error(`❌ Gagal mengirim task ke ${targetWorker}:`, err.message);
    res.status(500).json({
      error: 'Worker unreachable',
      worker: targetWorker,
      task: task.name || task.type,
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
  startTimes.length = 0;
  finishTimes.length = 0;
  executionTimes.length = 0;
  totalCost = 0;
  for (let key in executionTimeByWorker) delete executionTimeByWorker[key];

  res.json({ status: 'reset done' });
});

app.listen(8080, () => {
  console.log('🚀 Broker running on port 8080 (GENETIC ALGORITHM ENABLED)');
});