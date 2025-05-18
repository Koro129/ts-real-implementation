const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { geneticAlgorithm } = require('./ga');

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
const totalTasks = 50;
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
  const data = fs.readFileSync(path.join(__dirname, '../task50.json'));
  tasks = JSON.parse(data);
  console.log(`✅ Successfully loaded ${tasks.length} tasks from task50.json`);
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
  console.log(`📊 Running GA with ${taskCount} tasks and ${workerCount} workers...`);
  
  const populationSize = 20;
  const maxIterations = 50; 
  const crossoverProbability = 0.8;
  const mutationProbability = 0.1;
  
  // Run the Genetic Algorithm
  const bestSolution = geneticAlgorithm(
    populationSize,
    maxIterations,
    taskCount,
    workerCount,
    crossoverProbability,
    mutationProbability
  );
  
  console.log(`✅ GA completed, solution found with ${bestSolution.length} assignments`);
  return bestSolution; // Array with length = taskCount, where each value is the worker index
}

// Mock worker response for testing without actual workers
function mockWorkerResponse() {
  const startTime = Date.now();
  const execTime = Math.floor(Math.random() * 1000) + 500; // Random execution time between 500-1500ms
  const finishTime = startTime + execTime;
  
  return {
    data: {
      status: 'success',
      result: {
        start_time: startTime,
        finish_time: finishTime,
        execution_time: execTime
      }
    }
  };
}

// Endpoint penjadwalan menggunakan Genetic Algorithm
app.post('/schedule', async (req, res) => {
  console.log(`📥 Received scheduling request (${currentIndex + 1}/${tasks.length})`);
  
  // Jalankan Genetic Algorithm saat pertama kali
  if (gaMapping.length === 0) {
    console.log('🧬 Initializing Genetic Algorithm...');
    gaMapping = runGeneticAlgorithm(tasks.length, workers.length);
    console.log('🧬 Genetic Algorithm mapping completed');
    
    // Debug jika mapping kosong
    if (!Array.isArray(gaMapping) || gaMapping.length !== tasks.length) {
      console.error(`❌ Invalid GA mapping: expected ${tasks.length} entries, got ${gaMapping.length}`);
      return res.status(500).json({ error: 'Invalid GA mapping' });
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
    console.log(`⏱️ Makespan timer started at ${new Date(makespanStart).toISOString()}`);
  }

  try {
    console.log(`🔄 Sending task ${task.name || task.type} to worker ${targetWorker}`);
    
    // UNCOMMENT FOR PRODUCTION - Use actual worker
    // const response = await axios.post(`${targetWorker}/api/execute`, { task: task.type });
    
    // TESTING ONLY - Use mock response
    const response = mockWorkerResponse();

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
    console.log(`✅ Task completed (${completedTasks}/${totalTasks})`);

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

      console.log(`\n🎉 RESULTS FOR GENETIC ALGORITHM 🎉`);
      console.log(`✅ All tasks completed`);
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

    // Auto-trigger next task for testing (uncomment for auto-testing)
    if (currentIndex < tasks.length && req.body.autorun) {
      console.log(`🔄 Auto-triggering next task...`);
      setTimeout(() => {
        axios.post('http://localhost:8081/schedule', { autorun: true })
          .catch(err => console.error('Error in auto-trigger:', err.message));
      }, 100);
    }

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
  console.log('🔄 Resetting GA scheduler...');
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

// Auto-test endpoint - runs all tasks with mock data
app.post('/auto-test', (req, res) => {
  console.log('🧪 Starting auto-test with GA...');
  
  // Reset state
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
  
  // Start the first request, which will trigger subsequent ones
  axios.post('http://localhost:8081/schedule', { autorun: true })
    .then(() => {
      res.json({ status: 'auto-test started' });
    })
    .catch(err => {
      console.error('Error starting auto-test:', err.message);
      res.status(500).json({ error: 'Failed to start auto-test' });
    });
});

const server = app.listen(8081, () => {
  console.log('🚀 Broker running on port 8081 (GENETIC ALGORITHM ENABLED)');
  console.log('📊 Available endpoints:');
  console.log('   - POST /schedule: Schedule a single task');
  console.log('   - POST /auto-test: Automatically run all tasks with mock data');
  console.log('   - POST /reset: Reset the scheduler state');
});

// Export the runGeneticAlgorithm function for use in the main index.js
module.exports = { runGeneticAlgorithm };