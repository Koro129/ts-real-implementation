const { cloneDeep } = require('lodash');

// Constants for GA parameters
const DEFAULT_POPULATION_SIZE = 30;
const DEFAULT_ITERATIONS = 50;
const DEFAULT_CROSSOVER_PROBABILITY = 0.8;
const DEFAULT_MUTATION_PROBABILITY = 0.1;

// Constants for cost and task calculations (from moics.js)
const WEIGHT_TO_MIPS = {
  ringan: 400,
  sedang: 500,
  berat: 600,
};
const COST_PER_MIPS = 0.5;
const COST_PER_RAM = 0.05;
const COST_PER_BW = 0.1;
const BANDWIDTH_USAGE = 1000;
const CLOUDLET_LENGTH = 10000;
const RAM_USAGE = 512;

// Define task weights for simulation
const TASK_WEIGHTS = ['ringan', 'sedang', 'berat'];

/**
 * Create a single individual (chromosome) for the GA
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @return {Object} Individual with chromosome and fitness
 */
function createIndividual(taskCount, workerCount) {
  const chromosome = Array.from(
    { length: taskCount }, 
    () => Math.floor(Math.random() * workerCount)
  );
  return {
    chromosome,
    fitness: Infinity
  };
}

/**
 * Create initial population for GA
 * @param {number} populationSize - Size of population
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @return {Array} Population of individuals
 */
function createInitialPopulation(populationSize, taskCount, workerCount) {
  return Array.from(
    { length: populationSize }, 
    () => createIndividual(taskCount, workerCount)
  );
}

/**
 * Calculate fitness for an individual based on makespan and cost
 * @param {Object} individual - The individual to evaluate
 * @param {Array} tasks - Task information including weights (REQUIRED)
 * @return {number} Fitness value
 * @throws {Error} If tasks are not provided
 */
function calculateFitness(individual, tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    throw new Error("Tasks array is required for fitness calculation");
  }
  
  const workerLoad = {}; // total time per worker
  const workerCost = {};
  
  tasks.forEach((task, i) => {
    if (i >= individual.chromosome.length) return;
    
    const worker = individual.chromosome[i];
    const mips = WEIGHT_TO_MIPS[task.weight] || 500;
    const execTime = CLOUDLET_LENGTH / mips; // cloudletLength diasumsikan 10.000
    const cost = (execTime * COST_PER_MIPS) + (RAM_USAGE * COST_PER_RAM) + (BANDWIDTH_USAGE * COST_PER_BW);
    
    workerLoad[worker] = (workerLoad[worker] || 0) + execTime;
    workerCost[worker] = (workerCost[worker] || 0) + cost;
  });
  
  const makespan = Object.values(workerLoad).length > 0 
    ? Math.max(...Object.values(workerLoad)) 
    : Infinity;
  
  const totalCost = Object.values(workerCost).reduce((a, b) => a + b, 0);
  
  // Store these values for potential future use
  individual._makespan = makespan;
  individual._cost = totalCost;
  
  // Convert to a single fitness value (higher is better)
  // Use inverse because lower makespan and cost are better
  const makespanFitness = 1.0 / (makespan + 1); // Adding 1 to avoid division by zero
  const costFitness = 1.0 / (totalCost + 0.1); // Adding 0.1 to avoid division by zero
  
  // Combined fitness - higher is better
  return makespanFitness + costFitness;
}

/**
 * Tournament selection to choose parents
 * @param {Array} population - Current population
 * @return {Array} Two selected parents
 */
function selectParents(population) {
  const parents = [];
  
  for (let i = 0; i < 2; i++) {
    // Select 3 random individuals for tournament
    let best = null;
    let bestFitness = -Infinity;
    
    for (let j = 0; j < 3; j++) {
      const index = Math.floor(Math.random() * population.length);
      const candidate = population[index];
      
      if (candidate.fitness > bestFitness) {
        bestFitness = candidate.fitness;
        best = candidate;
      }
    }
    
    parents.push(best);
  }
  
  return parents;
}

/**
 * Perform crossover between two parents
 * @param {Object} parent1 - First parent
 * @param {Object} parent2 - Second parent
 * @param {number} crossoverProbability - Probability of crossover
 * @return {Array} Two offspring
 */
function crossover(parent1, parent2, crossoverProbability) {
  const offspring = [
    { chromosome: [...parent1.chromosome], fitness: Infinity },
    { chromosome: [...parent2.chromosome], fitness: Infinity }
  ];
  
  if (Math.random() < crossoverProbability) {
    // Single-point crossover
    const crossoverPoint = Math.floor(Math.random() * parent1.chromosome.length);
    
    for (let i = 0; i < parent1.chromosome.length; i++) {
      if (i < crossoverPoint) {
        offspring[0].chromosome[i] = parent1.chromosome[i];
        offspring[1].chromosome[i] = parent2.chromosome[i];
      } else {
        offspring[0].chromosome[i] = parent2.chromosome[i];
        offspring[1].chromosome[i] = parent1.chromosome[i];
      }
    }
  }
  
  return offspring;
}

/**
 * Apply mutation to an individual
 * @param {Object} individual - Individual to mutate
 * @param {number} workerCount - Number of workers
 * @param {number} mutationProbability - Probability of mutation
 */
function mutate(individual, workerCount, mutationProbability) {
  for (let i = 0; i < individual.chromosome.length; i++) {
    if (Math.random() < mutationProbability) {
      individual.chromosome[i] = Math.floor(Math.random() * workerCount);
    }
  }
}

/**
 * Run the Genetic Algorithm for task scheduling
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @param {Array} tasks - Array of tasks with their properties (REQUIRED)
 * @param {Object} options - Optional parameters
 * @return {Array} Best solution found
 * @throws {Error} If tasks are not provided
 */
function runGeneticAlgorithm(taskCount, workerCount, tasks, options = {}) {
  // Validate tasks parameter - REQUIRED
  if (!tasks) {
    throw new Error("Tasks array is required for genetic algorithm");
  }
  
  if (!Array.isArray(tasks)) {
    throw new Error("Tasks must be an array");
  }
  
  if (tasks.length === 0) {
    throw new Error("Tasks array cannot be empty");
  }
  
  if (tasks.length !== taskCount) {
    console.warn(`Warning: Task count (${taskCount}) does not match tasks array length (${tasks.length}). Using tasks length.`);
    taskCount = tasks.length;
  }

  const {
    populationSize = DEFAULT_POPULATION_SIZE,
    iterations = DEFAULT_ITERATIONS,
    crossoverProbability = DEFAULT_CROSSOVER_PROBABILITY,
    mutationProbability = DEFAULT_MUTATION_PROBABILITY
  } = options;

  // Initialize population
  let population = createInitialPopulation(populationSize, taskCount, workerCount);
  
  // Evaluate initial population
  population.forEach(ind => {
    ind.fitness = calculateFitness(ind, tasks);
  });

  let bestSolution = null;
  let bestFitness = -Infinity;

  // Main GA loop
  for (let iter = 0; iter < iterations; iter++) {
    const newPopulation = [];
    
    // Elitism: Keep the best individual
    population.sort((a, b) => b.fitness - a.fitness);
    newPopulation.push(cloneDeep(population[0]));
    
    // Generate rest of new population
    while (newPopulation.length < populationSize) {
      // Select parents
      const parents = selectParents(population);
      
      // Apply crossover
      const offspring = crossover(parents[0], parents[1], crossoverProbability);
      
      // Apply mutation
      mutate(offspring[0], workerCount, mutationProbability);
      mutate(offspring[1], workerCount, mutationProbability);
      
      // Evaluate offspring
      offspring[0].fitness = calculateFitness(offspring[0], tasks);
      offspring[1].fitness = calculateFitness(offspring[1], tasks);
      
      // Add offspring to new population
      newPopulation.push(offspring[0]);
      if (newPopulation.length < populationSize) {
        newPopulation.push(offspring[1]);
      }
    }
    
    // Replace old population
    population = newPopulation;
    
    // Update best solution
    const currentBest = population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );
    
    if (currentBest.fitness > bestFitness) {
      bestFitness = currentBest.fitness;
      bestSolution = cloneDeep(currentBest);
    }
  }
  
  return bestSolution.chromosome;
}

/**
 * Legacy function to maintain compatibility with the BAT algorithm pattern
 * This function is now deprecated - use runGeneticAlgorithm directly
 * @param {Array} population - Initial population
 * @param {number} iterations - Maximum number of iterations
 * @param {Array} tasks - REQUIRED: Task information including weights
 * @return {Array<number>} Best position found
 * @throws {Error} If tasks are not provided
 */
function geneticAlgorithm(population, iterations, tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    throw new Error("Tasks array is required for genetic algorithm. The legacy geneticAlgorithm function no longer creates simulated tasks.");
  }
  
  const taskCount = population[0].position.length;
  const workerCount = Math.max(...population[0].position) + 1;
  
  return runGeneticAlgorithm(taskCount, workerCount, tasks, { iterations });
}

module.exports = { 
  runGeneticAlgorithm,
  geneticAlgorithm
}; 