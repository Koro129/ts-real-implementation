const { GeneticAlgorithm, geneticAlgorithm } = require('./ga');
const { PopulationGA } = require('./populationGA');

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
  
  // Two ways to run the GA:
  
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
  const globalBest = geneticAlgorithm(population, iterations);
  
  // Method 2: Using GA class directly (commented out)
  /*
  // Create GA instance
  const ga = new GeneticAlgorithm(iterations, populationSize, crossoverProbability, 
                             mutationProbability, taskCount);
  
  // Initialize population
  const dataCenterIterator = 1; // Always 1 in our simplified case
  const population = ga.initPopulation(taskCount, dataCenterIterator);
  
  // Run the algorithm
  ga.runGA(population, dataCenterIterator);
  
  // Get the best solution
  const globalBest = ga.getBestVmAllocationForDatacenter(dataCenterIterator);
  */
  
  return globalBest; // array with length = taskCount
}

module.exports = { runGeneticAlgorithm }; 