const { batAlgorithm } = require('./batAlgorithm');
const { generatePopulation } = require('./populationBA');

function runBatAlgorithm(taskCount, workerCount) {
  const populationSize = 10;
  const iterations = 5;

  // Generate initial population
  const population = generatePopulation(populationSize, taskCount, workerCount);

  // Run the Bat Algorithm
  const globalBest = batAlgorithm(population, iterations);

  return globalBest; // array dengan panjang = taskCount
}

module.exports = { runBatAlgorithm };
