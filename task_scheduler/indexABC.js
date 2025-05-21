const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { runABCAlgorithm, WORKER_SPECS } = require('./abc_algorithm/abc');

const app = express();
app.use(express.json());

// Worker URLs
const workers = [
  'http://192.168.56.11:31001', // host2, vm1
  'http://192.168.56.11:31002', // host2, vm2
  'http://192.168.56.12:31001', // host3, vm1
  'http://192.168.56.12:31002', // host3, vm2
  'http://192.168.56.13:31001', // host1, vm1
  'http://192.168.56.13:31002'  // host1, vm2
];

// Worker specifications based on actual VM configurations
const workerSpecifications = [
  // host2 (192.168.56.11)
  { id: 0, url: 'http://192.168.56.11:31001', host: "host2", cpu: 1, mips: 400, ram: 512, bw: 1000, costPerMips: 0.4 },
  { id: 1, url: 'http://192.168.56.11:31002', host: "host2", cpu: 1, mips: 600, ram: 1024, bw: 1000, costPerMips: 0.6 },
  // host3 (192.168.56.12)
  { id: 2, url: 'http://192.168.56.12:31001', host: "host3", cpu: 1, mips: 400, ram: 512, bw: 1000, costPerMips: 0.4 },
  { id: 3, url: 'http://192.168.56.12:31002', host: "host3", cpu: 1, mips: 600, ram: 1024, bw: 1000, costPerMips: 0.6 },
  // host1 (192.168.56.13)
  { id: 4, url: 'http://192.168.56.13:31001', host: "host1", cpu: 1, mips: 400, ram: 512, bw: 1000, costPerMips: 0.4 },
  { id: 5, url: 'http://192.168.56.13:31002', host: "host1", cpu: 1, mips: 600, ram: 1024, bw: 1000, costPerMips: 0.6 }
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
const cpuUsages = []; 
const waitingTimes = [];
const executionTimeByWorker = {};

let tasks = [];
let abcMapping = [];
let workerSpecs = [];

try {
  const data = fs.readFileSync(path.join(__dirname, 'tasks50.json'));
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

// Function to get worker specifications
async function getWorkerSpecifications() {
  console.log('📊 Fetching worker specifications...');
  
  try {
    // In a production environment, you might want to query each worker
    // to get their actual specifications dynamically
    workerSpecs = [...workerSpecifications];
    
    // Log worker specifications
    console.log('📑 Worker specifications:');
    workerSpecs.forEach((spec) => {
      console.log(`Worker ${spec.id}: Host=${spec.host}, CPU=${spec.cpu}, Memory=${spec.ram}MB, MIPS=${spec.mips}`);
    });
    
    return workerSpecs;
  } catch (error) {
    console.error('❌ Error fetching worker specifications:', error.message);
    // Fall back to default worker specifications
    console.log('⚠️ Using default worker specifications from ABC module');
    return WORKER_SPECS;
  }
}

app.post('/schedule', async (req, res) => {
  if (currentIndex === 0) {
    cpuUsages.length = 0;
  }

  if (abcMapping.length === 0) {
    // Get worker specifications before running ABC algorithm
    workerSpecs = await getWorkerSpecifications();
    
    console.log('🔄 Running ABC algorithm with worker specifications...');
    abcMapping = runABCAlgorithm(tasks.length, workers.length, tasks, workerSpecs);
    console.log('📌 ABC Mapping:', abcMapping);

    if (!Array.isArray(abcMapping) || abcMapping.length !== tasks.length) {
      console.error(`❌ Invalid ABC mapping`);
      process.exit(1);
    }
  }

  if (currentIndex >= tasks.length) {
    return res.status(400).json({ error: 'Semua task telah selesai dijalankan' });
  }

  const task = tasks[currentIndex];
  const targetIndex = abcMapping[currentIndex];
  const targetWorker = workers[targetIndex];
  
  // Get worker specification for the chosen worker
  const workerSpec = workerSpecs[targetIndex];
  currentIndex++;

  if (!makespanStart) makespanStart = Date.now();

  try {
    // Include worker specification in the request
    const response = await axios.post(`${targetWorker}/api/execute`, { 
      task: task.weight,
      // Optionally include worker specs for the worker to use
      workerSpec: {
        host: workerSpec.host,
        cpu: workerSpec.cpu,
        mips: workerSpec.mips,
        ram: workerSpec.ram,
        bw: workerSpec.bw
      }
    });

    const workerURL = targetWorker;
    const startTime = response.data?.result?.start_time || 0;
    const finishTime = response.data?.result?.finish_time || 0;
    const execTime = response.data?.result?.execution_time || 0;

    // Use worker-specific cost per MIPS from specifications
    const costPerMips = workerSpec.costPerMips;
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

      const totalWaiting = waitingTimes.reduce((a, b) => a + b, 0);
      const avgWaitingTime = totalWaiting / totalTasks;

      console.log(`✅ All tasks completed with ABC.`);
      console.log(`🕒 Makespan: ${makespanDurationSec.toFixed(2)} detik`);
      console.log(`💲 Total Cost: $${totalCost.toFixed(2)}`);
      console.log(`📈 Throughput: ${throughput.toFixed(2)} tugas/detik`);
      console.log(`⏱️ Avg Waiting Time: ${avgWaitingTime.toFixed(6)} ms`);
      console.log(`💡 Resource Utilization: ${resourceUtilization.toFixed(4)}%`);
      console.log(`📊 Avg Start: ${avgStart.toFixed(2)} ms`);
      console.log(`📊 Avg Finish: ${avgFinish.toFixed(2)} ms`);
      console.log(`📊 Avg Exec Time: ${avgExec.toFixed(2)} ms`);
      console.log(`⚖️ Imbalance Degree: ${imbalanceDegree.toFixed(3)}`);
      
      // Calculate energy consumption estimate (simple model)
      // Assuming higher spec VMs consume more energy
      let totalEnergy = 0;
      workerSpecs.forEach((spec, idx) => {
        const workload = executionTimeByWorker[workers[idx]] || 0;
        // Simple energy model: base energy + (workload * coefficient based on RAM)
        const energyCoefficient = spec.ram / 512; // Higher RAM = higher energy
        const workerEnergy = (0.1 * makespanDurationSec) + (workload / 1000 * energyCoefficient * 0.2);
        totalEnergy += workerEnergy;
      });
      console.log(`⚡ Estimated Energy Consumption: ${totalEnergy.toFixed(2)} kWh`);
    }

    res.json({
      status: 'sent',
      task: task.name,
      weight: task.weight,
      worker: targetWorker,
      workerSpec: {
        host: workerSpec.host,
        cpu: workerSpec.cpu,
        mips: workerSpec.mips,
        ram: workerSpec.ram
      },
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
  abcMapping = [];
  workerSpecs = [];
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

// Add endpoint to get worker specifications
app.get('/worker-specs', async (req, res) => {
  try {
    const specs = await getWorkerSpecifications();
    res.json({ 
      status: 'success', 
      workerSpecs: specs.map(spec => ({
        id: spec.id,
        url: spec.url,
        host: spec.host,
        cpu: spec.cpu,
        ram: spec.ram,
        mips: spec.mips
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to get worker specifications', 
      error: error.message 
    });
  }
});

app.listen(8080, () => {
  console.log('🚀 Broker running on port 8080 (ABC ENABLED)');
});