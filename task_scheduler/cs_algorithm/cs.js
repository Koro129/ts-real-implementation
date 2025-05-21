// cuckoo.js - Cuckoo Search in Node.js (fitness: makespan + cost based on Java version)

const WEIGHT_TO_MIPS = {
  ringan: 400,
  sedang: 500,
  berat: 600,
};

const COST_PER_MIPS = 0.5;
const COST_PER_RAM = 0.05;
const COST_PER_BW = 0.1;
const BANDWIDTH_USAGE = 1000;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomNest(taskCount, workerCount) {
  return Array.from({ length: taskCount }, () => getRandomInt(0, workerCount - 1));
}

function levyFlight(nest, workerCount) {
  return nest.map(gene => {
    const step = Math.pow(Math.random(), -1.5);
    let newGene = gene + Math.round(step * (Math.random() < 0.5 ? -1 : 1));
    return Math.max(0, Math.min(workerCount - 1, newGene));
  });
}

function estimateFitness(nest, tasks) {
  const workerLoad = {};
  const workerCost = {};

  tasks.forEach((task, i) => {
    const worker = nest[i];
    const mips = WEIGHT_TO_MIPS[task.weight] || 500;
    const execTime = 10000 / mips;
    const cost = (execTime * COST_PER_MIPS) + (512 * COST_PER_RAM) + (BANDWIDTH_USAGE * COST_PER_BW);

    workerLoad[worker] = (workerLoad[worker] || 0) + execTime;
    workerCost[worker] = (workerCost[worker] || 0) + cost;
  });

  const totalExec = Object.values(workerLoad).reduce((a, b) => a + b, 0);
  const totalCost = Object.values(workerCost).reduce((a, b) => a + b, 0);

  const fitness = totalExec + totalCost;
  return { fitness, makespan: totalExec, totalCost };
}

function runCuckooSearch(taskCount, workerCount, tasks, maxIterations = 50, populationSize = 25, discoveryRate = 0.25) {
  let nests = [];
  let fitnesses = [];

  for (let i = 0; i < populationSize; i++) {
    const nest = generateRandomNest(taskCount, workerCount);
    const fit = estimateFitness(nest, tasks);
    nests.push(nest);
    fitnesses.push(fit);
  }

  let bestIndex = fitnesses.reduce((best, _, i) => fitnesses[i].fitness < fitnesses[best].fitness ? i : best, 0);
  let bestNest = nests[bestIndex];

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let i = 0; i < populationSize; i++) {
      const newNest = levyFlight(nests[i], workerCount);
      const newFitness = estimateFitness(newNest, tasks);

      if (newFitness.fitness < fitnesses[i].fitness) {
        nests[i] = newNest;
        fitnesses[i] = newFitness;

        if (newFitness.fitness < fitnesses[bestIndex].fitness) {
          bestIndex = i;
          bestNest = newNest;
        }
      }
    }

    for (let i = 0; i < populationSize; i++) {
      if (Math.random() < discoveryRate) {
        const newNest = generateRandomNest(taskCount, workerCount);
        const newFitness = estimateFitness(newNest, tasks);

        if (newFitness.fitness < fitnesses[i].fitness) {
          nests[i] = newNest;
          fitnesses[i] = newFitness;
        }
      }
    }
  }

  return bestNest;
}

module.exports = { runCuckooSearch };
