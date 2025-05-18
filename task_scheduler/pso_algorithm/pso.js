// pso.js - PSO Algorithm in Node.js (fitness: makespan + cost based on Java version)

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

function createParticle(taskCount, workerCount) {
  const chromosome = Array.from({ length: taskCount }, () => getRandomInt(0, workerCount - 1));
  const velocity = Array.from({ length: taskCount }, () => (Math.random() - 0.5) * workerCount);
  return {
    chromosome,
    velocity,
    personalBest: [...chromosome],
    personalBestFitness: -Infinity,
    fitness: -Infinity,
  };
}

function estimateFitness(individual, tasks) {
  const workerLoad = {};
  const workerCost = {};

  tasks.forEach((task, i) => {
    const worker = individual.chromosome[i];
    const mips = WEIGHT_TO_MIPS[task.weight] || 500;
    const execTime = 10000 / mips;
    const cost = (execTime * COST_PER_MIPS) + (512 * COST_PER_RAM) + (BANDWIDTH_USAGE * COST_PER_BW);

    workerLoad[worker] = (workerLoad[worker] || 0) + execTime;
    workerCost[worker] = (workerCost[worker] || 0) + cost;
  });

  const totalExec = Object.values(workerLoad).reduce((a, b) => a + b, 0);
  const totalCost = Object.values(workerCost).reduce((a, b) => a + b, 0);
  const fitness = totalExec + totalCost;

  individual.fitness = fitness;
  if (fitness < individual.personalBestFitness || individual.personalBestFitness === -Infinity) {
    individual.personalBestFitness = fitness;
    individual.personalBest = [...individual.chromosome];
  }

  return fitness;
}

function runPsoAlgorithm(taskCount, workerCount, tasks, options = {}) {
  const {
    maxIterations = 50,
    populationSize = 30,
    w = 0.5,
    l1 = 1.5,
    l2 = 1.5
  } = options;

  const population = Array.from({ length: populationSize }, () => createParticle(taskCount, workerCount));
  population.forEach(p => estimateFitness(p, tasks));

  let globalBest = population.reduce((best, p) => p.fitness < best.fitness ? p : best, population[0]);

  for (let iter = 0; iter < maxIterations; iter++) {
    for (const particle of population) {
      for (let i = 0; i < taskCount; i++) {
        const r1 = Math.random();
        const r2 = Math.random();

        particle.velocity[i] = w * particle.velocity[i]
          + l1 * r1 * (particle.personalBest[i] - particle.chromosome[i])
          + l2 * r2 * (globalBest.chromosome[i] - particle.chromosome[i]);

        const Vmax = workerCount * 0.5;
        particle.velocity[i] = Math.max(-Vmax, Math.min(Vmax, particle.velocity[i]));

        particle.chromosome[i] = Math.round(particle.chromosome[i] + particle.velocity[i]);
        particle.chromosome[i] = Math.max(0, Math.min(workerCount - 1, particle.chromosome[i]));
      }
      estimateFitness(particle, tasks);
      if (particle.fitness < globalBest.fitness) {
        globalBest = JSON.parse(JSON.stringify(particle));
      }
    }
  }

  return globalBest.chromosome;
}

module.exports = { runPsoAlgorithm };