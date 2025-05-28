const { cloneDeep } = require('lodash');

// Estimasi MIPS berdasarkan bobot task
const WEIGHT_TO_MIPS = {
  ringan: 400,
  sedang: 500,
  berat: 600,
};

// VM specifications for real environment
const VM_SPECS = [
  { id: 1, ram: 512, cpu: 1, port: 31001, mips: 1000 },
  { id: 2, ram: 1024, cpu: 2, port: 31002, mips: 2000 },
  { id: 3, ram: 512, cpu: 1, port: 31003, mips: 1000 },
  { id: 4, ram: 1024, cpu: 2, port: 31004, mips: 2000 },
  { id: 5, ram: 512, cpu: 1, port: 31005, mips: 1000 },
  { id: 6, ram: 1024, cpu: 2, port: 31006, mips: 2000 },
];

// Estimasi biaya (arbitrary unit)
const COST_PER_MIPS = 0.5;
const COST_PER_RAM = 0.05;
const COST_PER_BW = 0.1;
const BANDWIDTH_USAGE = 1000;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fungsi untuk menginisialisasi individu (chromosome)
function createIndividual(taskCount, workerCount) {
  // Ensure we don't assign to non-existent VMs
  const maxValidWorker = Math.min(workerCount - 1, VM_SPECS.length - 1);
  const chromosome = Array.from({ length: taskCount }, () => getRandomInt(0, maxValidWorker));
  return {
    chromosome,
    fitness: Infinity,
  };
}

// Fungsi untuk membuat populasi awal
function createInitialPopulation(populationSize, taskCount, workerCount) {
  return Array.from({ length: populationSize }, () => createIndividual(taskCount, workerCount));
}

// Chaotic map - implementasi Iterative map
function chaos() {
  const x = 0.7;
  const a = 0.7;
  // Iterative map implementation
  const nextX = Math.sin((a * Math.PI) / x);
  return ((x + 1) * 1) / 2;
}

// Menghitung fitness untuk individu - semakin kecil semakin baik
function calculateFitness(individual, tasks) {
  const workerLoad = {}; // total time per worker
  const workerCost = {};

  tasks.forEach((task, i) => {
    const worker = individual.chromosome[i];
    const vmSpec = VM_SPECS[worker % VM_SPECS.length]; // Get VM specs for the worker
    const taskMips = WEIGHT_TO_MIPS[task.weight] || 500;
    
    // Execution time based on VM's MIPS capacity and CPU cores
    const vmMips = vmSpec.mips * vmSpec.cpu; // Adjust MIPS by CPU cores
    const execTime = 10000 / vmMips; // cloudletLength diasumsikan 10.000
    
    // Cost calculation based on actual VM specs
    const cost = (execTime * COST_PER_MIPS) + (vmSpec.ram * COST_PER_RAM) + (BANDWIDTH_USAGE * COST_PER_BW);

    workerLoad[worker] = (workerLoad[worker] || 0) + execTime;
    workerCost[worker] = (workerCost[worker] || 0) + cost;
  });

  const makespan = Math.max(...Object.values(workerLoad));
  const totalCost = Object.values(workerCost).reduce((a, b) => a + b, 0);

  // Gabungkan makespan dan cost dalam satu nilai fitness
//   const w1 = 0.6; // bobot untuk makespan
//   const w2 = 0.4; // bobot untuk cost
//   individual.fitness = w1 * makespan + w2 * totalCost;
  individual.fitness = makespan + totalCost;
  return individual.fitness;
}

// Opposition-Based Learning (OBL)
function applyOBL(population, taskCount, workerCount, tasks) {
  const oppositePopulation = [];
  
  for (const individual of population) {
    const oppositeChromosome = individual.chromosome.map(gene => workerCount - 1 - gene);
    const oppositeIndividual = { chromosome: oppositeChromosome, fitness: Infinity };
    calculateFitness(oppositeIndividual, tasks);
    oppositePopulation.push(oppositeIndividual);
  }
  
  // Combine and select the best
  const combined = [...population, ...oppositePopulation];
  combined.sort((a, b) => a.fitness - b.fitness);
  
  return combined.slice(0, population.length);
}

// Update f and dynamic coefficients
function updateFandCoefficients(iter, iterations) {
  const f = 2 - iter * (2.0 / iterations); // decreases linearly from 2 to 0
  
  // Dynamic coefficients calculation
  const C1G1 = 1.95 - ((2 * Math.pow(iter, 1.0/3)) / Math.pow(iterations, 1.0/3));
  const C2G1 = (2 * Math.pow(iter, 1.0/3)) / Math.pow(iterations, 1.0/3) + 0.5;
  
  const C1G2 = C1G1;
  const C2G2 = (2 * Math.pow(iter, 3) / Math.pow(iterations, 3)) + 0.5;
  
  const C1G3 = (-2 * Math.pow(iter, 3) / Math.pow(iterations, 3)) + 2.5;
  const C2G3 = C2G1;
  
  const C1G4 = C1G3;
  const C2G4 = C2G2;
  
  return { f, C1G1, C2G1, C1G2, C2G2, C1G3, C2G3, C1G4, C2G4 };
}

// Update positions of all chimps
function updatePositions(population, taskCount, workerCount, coefficients, attacker, barrier, chaser, driver, tasks) {
  const { f, C1G1, C2G1, C1G2, C2G2, C1G3, C2G3, C1G4, C2G4 } = coefficients;
  const m = chaos(); // Chaotic multiplier
  const maxValidWorker = Math.min(workerCount - 1, VM_SPECS.length - 1);
  
  for (const chimp of population) {
    const newChromosome = [];
    
    for (let j = 0; j < taskCount; j++) {
      // Group 1
      const r11 = C1G1 * Math.random();
      const r12 = C2G1 * Math.random();
      const A1 = 2 * f * r11 - f;
      const C1 = 2 * r12;
      
      // Group 2
      const r21 = C1G2 * Math.random();
      const r22 = C2G2 * Math.random();
      const A2 = 2 * f * r21 - f;
      const C2 = 2 * r22;
      
      // Group 3
      const r31 = C1G3 * Math.random();
      const r32 = C2G3 * Math.random();
      const A3 = 2 * f * r31 - f;
      const C3 = 2 * r32;
      
      // Group 4
      const r41 = C1G4 * Math.random();
      const r42 = C2G4 * Math.random();
      const A4 = 2 * f * r41 - f;
      const C4 = 2 * r42;
      
      const currentPos = chimp.chromosome[j];
      
      // Calculate distances
      const D1 = Math.abs(C1 * attacker.chromosome[j] - m * currentPos);
      const X1 = attacker.chromosome[j] - A1 * D1;
      
      const D2 = Math.abs(C2 * barrier.chromosome[j] - m * currentPos);
      const X2 = barrier.chromosome[j] - A2 * D2;
      
      const D3 = Math.abs(C3 * chaser.chromosome[j] - m * currentPos);
      const X3 = chaser.chromosome[j] - A3 * D3;
      
      const D4 = Math.abs(C4 * driver.chromosome[j] - m * currentPos);
      const X4 = driver.chromosome[j] - A4 * D4;
      
      // Calculate new position
      let newPosition = Math.round((X1 + X2 + X3 + X4) / 4.0);
      
      // Ensure within bounds - using maxValidWorker to stay within VM specs
      newPosition = Math.max(0, Math.min(maxValidWorker, newPosition));
      
      newChromosome.push(newPosition);
    }
    
    // Create new chimp with updated position
    const newChimp = { chromosome: newChromosome, fitness: Infinity };
    calculateFitness(newChimp, tasks);
    
    // Update position if better
    if (newChimp.fitness < chimp.fitness) {
      chimp.chromosome = newChimp.chromosome;
      chimp.fitness = newChimp.fitness;
    }
  }
}

// Evaluate fitness and update chimps ranking
function evaluateFitness(population, tasks, currentBests) {
  // Current best chimps or initialize with default values
  const { 
    attacker = { chromosome: [], fitness: -Infinity },
    barrier = { chromosome: [], fitness: -Infinity },
    chaser = { chromosome: [], fitness: -Infinity },
    driver = { chromosome: [], fitness: -Infinity }
  } = currentBests || {};
  
  let newAttacker = cloneDeep(attacker);
  let newBarrier = cloneDeep(barrier);
  let newChaser = cloneDeep(chaser);
  let newDriver = cloneDeep(driver);
  
  // Evaluate each individual
  for (const individual of population) {
    calculateFitness(individual, tasks);
    
    // Update using Java-like logic
    if (individual.fitness < newAttacker.fitness) {
      // Update Attacker (best solution)
      newAttacker = cloneDeep(individual);
    } 
    else if (individual.fitness > newAttacker.fitness && individual.fitness < newBarrier.fitness) {
      // Update Barrier
      newBarrier = cloneDeep(individual);
    }
    else if (individual.fitness > newAttacker.fitness && 
             individual.fitness > newBarrier.fitness && 
             individual.fitness < newChaser.fitness) {
      // Update Chaser
      newChaser = cloneDeep(individual);
    }
    else if (individual.fitness > newAttacker.fitness && 
             individual.fitness > newBarrier.fitness && 
             individual.fitness > newChaser.fitness &&
             individual.fitness < newDriver.fitness) {
      // Update Driver
      newDriver = cloneDeep(individual);
    }
  }
  
  return { 
    attacker: newAttacker, 
    barrier: newBarrier, 
    chaser: newChaser, 
    driver: newDriver 
  };
}

// Fungsi untuk mendapatkan informasi VM untuk penugasan spesifik
function getVMForAssignment(workerIndex) {
  return VM_SPECS[workerIndex % VM_SPECS.length];
}

// Fungsi untuk mendapatkan statistik detail dari solusi penjadwalan
function getSchedulingStatistics(assignments, tasks) {
  const vmLoads = {};
  const vmCosts = {};
  const taskAssignments = [];
  
  // Initialize VM loads and costs
  VM_SPECS.forEach((vm, index) => {
    vmLoads[index] = 0;
    vmCosts[index] = 0;
  });
  
  // Calculate statistics
  assignments.forEach((workerIndex, taskIndex) => {
    const task = tasks[taskIndex];
    const vmIndex = workerIndex % VM_SPECS.length;
    const vm = VM_SPECS[vmIndex];
    
    const taskMips = WEIGHT_TO_MIPS[task.weight] || 500;
    const vmMips = vm.mips * vm.cpu;
    const execTime = 10000 / vmMips;
    const cost = (execTime * COST_PER_MIPS) + (vm.ram * COST_PER_RAM) + (BANDWIDTH_USAGE * COST_PER_BW);
    
    vmLoads[vmIndex] += execTime;
    vmCosts[vmIndex] += cost;
    
    taskAssignments.push({
      taskId: taskIndex,
      taskWeight: task.weight,
      vmId: vm.id,
      vmSpecs: vm,
      executionTime: execTime,
      cost: cost
    });
  });
  
  // Calculate overall statistics
  const makespan = Math.max(...Object.values(vmLoads));
  const totalCost = Object.values(vmCosts).reduce((a, b) => a + b, 0);
  
  return {
    makespan,
    totalCost,
    vmLoads,
    vmCosts,
    taskAssignments
  };
}

// Fungsi utama ChOA algorithm
function runChoaAlgorithm(taskCount, workerCount, tasks, iterations = 5, populationSize = 80, useOBL = true) {
  // Initialize parameters
  let population = createInitialPopulation(populationSize, taskCount, workerCount);
  
  // Initialize fittest chimps with default values
  let attacker = { chromosome: [], fitness: Infinity };
  let barrier = { chromosome: [], fitness: Infinity };
  let chaser = { chromosome: [], fitness: Infinity };
  let driver = { chromosome: [], fitness: Infinity };
  
  // Apply OBL if enabled
  if (useOBL) {
    population.forEach(ind => calculateFitness(ind, tasks));
    population = applyOBL(population, taskCount, workerCount, tasks);
  } else {
    population.forEach(ind => calculateFitness(ind, tasks));
  }
  
  // Initialize fittest chimps after evaluation
  const initialBests = { attacker, barrier, chaser, driver };
  const topChimps = evaluateFitness(population, tasks, initialBests);
  attacker = topChimps.attacker;
  barrier = topChimps.barrier;
  chaser = topChimps.chaser;
  driver = topChimps.driver;
  
  // Main iteration loop
  for (let iter = 0; iter < iterations; iter++) {
    // Update parameters
    const coefficients = updateFandCoefficients(iter, iterations);
    
    // Update positions
    updatePositions(population, taskCount, workerCount, coefficients, attacker, barrier, chaser, driver, tasks);
    
    // Evaluate fitness and update chimps
    const currentBests = { attacker, barrier, chaser, driver };
    const newTopChimps = evaluateFitness(population, tasks, currentBests);
    attacker = newTopChimps.attacker;
    barrier = newTopChimps.barrier;
    chaser = newTopChimps.chaser;
    driver = newTopChimps.driver;
  }
  
  // Get detailed statistics about the solution
  const statistics = getSchedulingStatistics(attacker.chromosome, tasks);
  
  // Return the best solution (attacker's chromosome) and statistics
  return {
    assignments: attacker.chromosome,
    statistics: statistics
  };
}

module.exports = { runChoaAlgorithm, getVMForAssignment, VM_SPECS }; 