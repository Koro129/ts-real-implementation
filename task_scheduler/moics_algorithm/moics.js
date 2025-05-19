const { cloneDeep } = require('lodash');

// Estimasi MIPS berdasarkan bobot task
const WEIGHT_TO_MIPS = {
  ringan: 400,
  sedang: 500,
  berat: 600,
};

// Estimasi biaya (arbitrary unit)
const COST_PER_MIPS = 0.5;
const COST_PER_RAM = 0.05;
const COST_PER_BW = 0.1;
const BANDWIDTH_USAGE = 1000;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createIndividual(taskCount, workerCount) {
  const chromosome = Array.from({ length: taskCount }, () => getRandomInt(0, workerCount - 1));
  return {
    chromosome,
    fitnessValues: [Infinity, Infinity],
  };
}

function createInitialPopulation(populationSize, taskCount, workerCount) {
  return Array.from({ length: populationSize }, () => createIndividual(taskCount, workerCount));
}

function estimateFitness(individual, tasks) {
  const workerLoad = {}; // total time per worker
  const workerCost = {};

  tasks.forEach((task, i) => {
    const worker = individual.chromosome[i];
    const mips = WEIGHT_TO_MIPS[task.weight] || 500;
    const execTime = 10000 / mips; // cloudletLength diasumsikan 10.000
    const cost = (execTime * COST_PER_MIPS) + (512 * COST_PER_RAM) + (BANDWIDTH_USAGE * COST_PER_BW);

    workerLoad[worker] = (workerLoad[worker] || 0) + execTime;
    workerCost[worker] = (workerCost[worker] || 0) + cost;
  });

  const makespan = Math.max(...Object.values(workerLoad));
  const totalCost = Object.values(workerCost).reduce((a, b) => a + b, 0);

  individual.fitnessValues = [makespan, totalCost];
}

function dominates(a, b) {
  return (a[0] < b[0] && a[1] <= b[1]) || (a[0] <= b[0] && a[1] < b[1]);
}

function getParetoFront(population) {
  const front = [];
  population.forEach(ind => {
    if (!front.some(existing => dominates(existing.fitnessValues, ind.fitnessValues))) {
      // remove dominated
      for (let i = front.length - 1; i >= 0; i--) {
        if (dominates(ind.fitnessValues, front[i].fitnessValues)) front.splice(i, 1);
      }
      front.push(ind);
    }
  });
  return front;
}

function levyFlight(individual, workerCount) {
  const newChromosome = individual.chromosome.map(gene => {
    const step = Math.round(Math.pow(Math.random(), -1.5));
    let newGene = gene + step * (Math.random() < 0.5 ? -1 : 1);
    return Math.max(0, Math.min(workerCount - 1, newGene));
  });
  return { chromosome: newChromosome, fitnessValues: [Infinity, Infinity] };
}

function mutate(individual, workerCount) {
  const chromosome = [...individual.chromosome];
  const i = getRandomInt(0, chromosome.length - 1);
  chromosome[i] = getRandomInt(0, workerCount - 1);
  return { chromosome, fitnessValues: [Infinity, Infinity] };
}

function abandonWorst(population, pa, workerCount) {
  const abandonCount = Math.floor(pa * population.length);
  const sorted = [...population].sort((a, b) => (a.fitnessValues[0] + a.fitnessValues[1]) - (b.fitnessValues[0] + b.fitnessValues[1]));
  for (let i = 0; i < abandonCount; i++) {
    const mutated = mutate(sorted[i], workerCount);
    sorted[i] = mutated;
  }
  return sorted;
}

function runMoicsAlgorithm(taskCount, workerCount, tasks, iterations = 50, popSize = 30, pa = 0.25) {
  let population = createInitialPopulation(popSize, taskCount, workerCount);

  // Evaluate initial
  population.forEach(ind => estimateFitness(ind, tasks));

  for (let iter = 0; iter < iterations; iter++) {
    const newPopulation = [];

    // Lévy flight
    for (const ind of population) {
      const newInd = levyFlight(ind, workerCount);
      estimateFitness(newInd, tasks);
      if ((newInd.fitnessValues[0] + newInd.fitnessValues[1]) < (ind.fitnessValues[0] + ind.fitnessValues[1])) {
        newPopulation.push(newInd);
      } else {
        newPopulation.push(ind);
      }
    }

    // Abandon worst
    population = abandonWorst(newPopulation, pa, workerCount);

    // Re-evaluate
    population.forEach(ind => estimateFitness(ind, tasks));
  }

  // Ambil satu solusi dari pareto front
  const front = getParetoFront(population);
  const best = front.sort((a, b) => (a.fitnessValues[0] + a.fitnessValues[1]) - (b.fitnessValues[0] + b.fitnessValues[1]))[0];

  return best.chromosome;
}

module.exports = { runMoicsAlgorithm };