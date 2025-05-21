const { cloneDeep } = require('lodash');

// Constants for ABC parameters
const DEFAULT_POPULATION_SIZE = 30; // Must be even to support 50/50 split between employed and onlooker bees
const DEFAULT_ITERATIONS = 5;
const DEFAULT_EOBL_COEFFICIENT = 0.3;
const DEFAULT_USE_EOBL = false; // Optional enhancement

// Constants for cost and task calculations
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
 * Create a single individual (food source) for the ABC algorithm
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
    fitness: -Infinity, // In ABC, we maximize fitness
    trials: 0 // Number of trials without improvement (for scout bee phase)
  };
}

/**
 * Create initial population for ABC
 * @param {number} populationSize - Size of population (swarm size)
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @return {Array} Population of food sources (individuals)
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
    const execTime = CLOUDLET_LENGTH / mips;
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
 * Employed Bee Phase - each employed bee visits a food source
 * and produces a new food source in its neighborhood
 * @param {Array} population - Current population (food sources)
 * @param {number} employedBeesCount - Number of employed bees (50% of population)
 * @param {Array} tasks - Task information including weights
 * @param {number} workerCount - Number of workers
 * @return {Array} Updated population
 */
function employedBeePhase(population, employedBeesCount, tasks, workerCount) {
  console.log("PHASE 1: Employed Bee Phase");
  console.log("Role: Collect food from determined food sources for the hive");
  
  // Process only the employed bees (first half of population)
  for (let i = 0; i < employedBeesCount; i++) {
    const currentBee = population[i];
    
    // Create a new solution by modifying the current one
    const newSolution = {
      chromosome: [...currentBee.chromosome],
      fitness: -Infinity,
      trials: currentBee.trials // Inherit trials count
    };
    
    // Select a random dimension to modify
    const dimension = Math.floor(Math.random() * currentBee.chromosome.length);
    
    // Select another food source (excluding current one)
    let partnerIndex;
    do {
      partnerIndex = Math.floor(Math.random() * employedBeesCount);
    } while (partnerIndex === i);
    
    const partner = population[partnerIndex];
    
    // Calculate new position using ABC formula: vij = xij + φij(xij - xkj)
    const phi = Math.floor(Math.random() * 3) - 1; // Random value between -1, 0, 1
    let newValue = currentBee.chromosome[dimension] + 
                  phi * (currentBee.chromosome[dimension] - partner.chromosome[dimension]);
    
    // Ensure new position is within bounds
    newValue = Math.max(0, Math.min(workerCount - 1, newValue));
    newSolution.chromosome[dimension] = newValue;
    
    // Evaluate new solution
    newSolution.fitness = calculateFitness(newSolution, tasks);
    
    // Apply greedy selection mechanism
    if (newSolution.fitness > currentBee.fitness) {
      // If better, replace current solution
      population[i] = newSolution;
      population[i].trials = 0; // Reset trials counter
    } else {
      // If not better, increment trials counter
      population[i].trials++;
    }
  }
  
  return population;
}

/**
 * Calculate probabilities for food source selection by onlooker bees
 * @param {Array} population - Current population
 * @param {number} employedBeesCount - Number of employed bees
 * @return {Array} Selection probabilities
 */
function calculateProbabilities(population, employedBeesCount) {
  // Get sum of fitness values for employed bees
  let fitnessSum = 0;
  for (let i = 0; i < employedBeesCount; i++) {
    // Convert fitness to positive value if needed
    const fitness = Math.max(0, population[i].fitness);
    fitnessSum += fitness;
  }
  
  // Calculate probability for each food source
  const probabilities = new Array(population.length).fill(0);
  
  if (fitnessSum > 0) {
    for (let i = 0; i < employedBeesCount; i++) {
      const fitness = Math.max(0, population[i].fitness);
      probabilities[i] = fitness / fitnessSum;
    }
  } else {
    // If all fitness values are negative, use equal probability
    const equalProb = 1.0 / employedBeesCount;
    for (let i = 0; i < employedBeesCount; i++) {
      probabilities[i] = equalProb;
    }
  }
  
  return probabilities;
}

/**
 * Select a food source based on probability (roulette wheel selection)
 * @param {Array} probabilities - Selection probabilities
 * @param {number} employedBeesCount - Number of employed bees
 * @return {number} Selected food source index
 */
function selectFoodSource(probabilities, employedBeesCount) {
  const r = Math.random();
  let sum = 0;
  
  for (let i = 0; i < employedBeesCount; i++) {
    sum += probabilities[i];
    if (r <= sum) {
      return i;
    }
  }
  
  // Fallback - return a random employed bee
  return Math.floor(Math.random() * employedBeesCount);
}

/**
 * Onlooker Bee Phase - onlooker bees select food sources based on their quality
 * @param {Array} population - Current population (food sources)
 * @param {number} employedBeesCount - Number of employed bees
 * @param {number} onlookerBeesCount - Number of onlooker bees
 * @param {Array} tasks - Task information including weights
 * @param {number} workerCount - Number of workers
 * @return {Array} Updated population
 */
function onlookerBeePhase(population, employedBeesCount, onlookerBeesCount, tasks, workerCount) {
  console.log("PHASE 2: Onlooker Bee Phase");
  console.log("Role: Oversee employed bees and verify the quality of food sources");
  console.log("      Choose food sources based on their quality (fitness)");
  
  // Calculate probabilities for food source selection
  const probabilities = calculateProbabilities(population, employedBeesCount);
  
  // Onlooker bees start after employed bees in the population
  const onlookerStartIndex = employedBeesCount;
  
  // Process onlooker bees
  for (let i = 0; i < onlookerBeesCount; i++) {
    // Select a food source based on its probability
    const selectedIndex = selectFoodSource(probabilities, employedBeesCount);
    const selectedBee = population[selectedIndex];
    
    // Create a new solution by modifying the selected one
    const newSolution = {
      chromosome: [...selectedBee.chromosome],
      fitness: -Infinity,
      trials: 0
    };
    
    // Select a random dimension to modify
    const dimension = Math.floor(Math.random() * selectedBee.chromosome.length);
    
    // Select another food source (excluding selected one)
    let partnerIndex;
    do {
      partnerIndex = Math.floor(Math.random() * employedBeesCount);
    } while (partnerIndex === selectedIndex);
    
    const partner = population[partnerIndex];
    
    // Calculate new position using ABC formula: vij = xij + φij(xij - xkj)
    const phi = Math.floor(Math.random() * 3) - 1; // Random value between -1, 0, 1
    let newValue = selectedBee.chromosome[dimension] + 
                  phi * (selectedBee.chromosome[dimension] - partner.chromosome[dimension]);
    
    // Ensure new position is within bounds
    newValue = Math.max(0, Math.min(workerCount - 1, newValue));
    newSolution.chromosome[dimension] = newValue;
    
    // Evaluate new solution
    newSolution.fitness = calculateFitness(newSolution, tasks);
    
    // Store the new solution in the onlooker bee part of the population
    const onlookerIndex = onlookerStartIndex + i;
    population[onlookerIndex] = newSolution;
    
    // Apply greedy selection mechanism
    if (newSolution.fitness > selectedBee.fitness) {
      // If better, replace original food source - "positive feedback"
      population[selectedIndex] = cloneDeep(newSolution);
      population[selectedIndex].trials = 0; // Reset trials counter
    } else {
      // If not better, increment trials - "negative feedback"
      population[selectedIndex].trials++;
    }
  }
  
  return population;
}

/**
 * Scout Bee Phase - abandoned food sources are replaced with random ones
 * @param {Array} population - Current population (food sources)
 * @param {number} employedBeesCount - Number of employed bees
 * @param {number} limit - Abandonment limit
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @param {Array} tasks - Task information
 * @return {Array} Updated population
 */
function scoutBeePhase(population, employedBeesCount, limit, taskCount, workerCount, tasks) {
  console.log("PHASE 3: Scout Bee Phase");
  console.log("Role: Search and explore for new valid food source locations");
  
  // Find the most abandoned food source
  let maxTrialsIndex = -1;
  let maxTrials = -1;
  
  for (let i = 0; i < employedBeesCount; i++) {
    if (population[i].trials > maxTrials) {
      maxTrials = population[i].trials;
      maxTrialsIndex = i;
    }
  }
  
  // If the most abandoned food source exceeds limit, replace it
  if (maxTrials > limit && maxTrialsIndex >= 0) {
    console.log(`Food source at position ${maxTrialsIndex} abandoned after ${maxTrials} trials (limit: ${limit})`);
    console.log("Scout bee is exploring for new food source");
    
    // Generate completely new random solution
    const scout = createIndividual(taskCount, workerCount);
    
    // Evaluate new solution
    scout.fitness = calculateFitness(scout, tasks);
    
    // Replace abandoned food source
    population[maxTrialsIndex] = scout;
    
    console.log(`Scout bee found new food source with fitness: ${scout.fitness}`);
  } else {
    console.log("No food sources abandoned this iteration");
  }
  
  return population;
}

/**
 * Enhanced Opposition-Based Learning (EOBL) - optional enhancement
 * @param {Array} population - Current population
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @param {Array} tasks - Task information
 * @param {number} d - EOBL coefficient
 * @return {Array} Updated population with potential improvements
 */
function applyEOBL(population, taskCount, workerCount, tasks, d) {
  console.log("ENHANCEMENT: Applying EOBL to improve solution quality");
  
  // Find the best solution in the population
  let bestSolution = null;
  let bestFitness = -Infinity;
  
  for (const individual of population) {
    if (individual.fitness > bestFitness) {
      bestFitness = individual.fitness;
      bestSolution = individual;
    }
  }
  
  if (!bestSolution) return population;
  
  // Calculate the opposite solution
  const oppositeSolution = {
    chromosome: new Array(taskCount),
    fitness: -Infinity,
    trials: 0
  };
  
  // Apply EOBL formula: opposite = (min + max)*d - original
  for (let i = 0; i < taskCount; i++) {
    const max = workerCount - 1;
    const min = 0;
    
    let candidate = Math.floor((min + max) * d) - bestSolution.chromosome[i];
    
    // If the opposite value is outside boundaries, generate a random value
    if (candidate < min || candidate > max) {
      candidate = Math.floor(Math.random() * workerCount);
    }
    
    oppositeSolution.chromosome[i] = candidate;
  }
  
  // Evaluate opposite solution
  oppositeSolution.fitness = calculateFitness(oppositeSolution, tasks);
  
  // If the opposite solution is better, replace the worst solution in the population
  if (oppositeSolution.fitness > bestFitness) {
    console.log(`EOBL SUCCESS: New fitness = ${oppositeSolution.fitness} (improved from ${bestFitness})`);
    
    // Find the worst solution in the population
    let worstIndex = 0;
    let worstFitness = Infinity;
    
    for (let i = 0; i < population.length; i++) {
      if (population[i].fitness < worstFitness) {
        worstFitness = population[i].fitness;
        worstIndex = i;
      }
    }
    
    // Replace the worst solution with the opposite solution
    population[worstIndex] = oppositeSolution;
  } else {
    console.log("EOBL did not find a better solution");
  }
  
  return population;
}

/**
 * Run the Artificial Bee Colony Algorithm for task scheduling
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @param {Array} tasks - Array of tasks with their properties (REQUIRED)
 * @param {Object} options - Optional parameters
 * @return {Array} Best solution found
 * @throws {Error} If tasks are not provided
 */
function runABCAlgorithm(taskCount, workerCount, tasks, options = {}) {
  // Validate tasks parameter - REQUIRED
  if (!tasks) {
    throw new Error("Tasks array is required for ABC algorithm");
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
    useEOBL = DEFAULT_USE_EOBL,
    eoblCoefficient = DEFAULT_EOBL_COEFFICIENT
  } = options;

  // ABC requires an even population for 50/50 split between employed and onlooker bees
  const actualPopulationSize = populationSize % 2 === 0 ? populationSize : populationSize + 1;
  const employedBeesCount = actualPopulationSize / 2;
  const onlookerBeesCount = actualPopulationSize / 2;
  
  // Calculate the limit parameter for abandonment (from ABC literature)
  const dimensions = taskCount; // Each task is one dimension
  const limit = Math.round(0.5 * employedBeesCount * dimensions);
  
  // Print algorithm configuration
  console.log("\n====== ABC ALGORITHM CONFIGURATION ======");
  console.log(`- Swarm Size: ${actualPopulationSize}`);
  console.log(`- Employed Bees: ${employedBeesCount} (50% of swarm)`);
  console.log(`- Onlooker Bees: ${onlookerBeesCount} (50% of swarm)`);
  console.log("- Scout Bees: 1");
  console.log(`- Dimensions: ${dimensions}`);
  console.log(`- Limit: ${limit}`);
  console.log(`- Max Iterations: ${iterations}`);
  console.log(`- EOBL Enhancement: ${useEOBL ? `Enabled (d=${eoblCoefficient})` : "Disabled"}`);
  console.log("========================================\n");

  // Initialize population (Step 4 in pseudocode)
  console.log("Initial population generation");
  let population = createInitialPopulation(actualPopulationSize, taskCount, workerCount);
  
  // Evaluate initial population (Step 5 in pseudocode)
  console.log("Evaluating initial population");
  population.forEach(individual => {
    individual.fitness = calculateFitness(individual, tasks);
  });

  let bestSolution = null;
  let bestFitness = -Infinity;

  // Main ABC loop (Step 6 in pseudocode)
  for (let iter = 1; iter <= iterations; iter++) {
    console.log(`\n========== ITERATION ${iter} OF ${iterations} ==========`);
    
    // Employed Bee Phase (Steps 7-10 in pseudocode)
    population = employedBeePhase(population, employedBeesCount, tasks, workerCount);
    
    // Onlooker Bee Phase (Steps 11-17 in pseudocode)
    population = onlookerBeePhase(population, employedBeesCount, onlookerBeesCount, tasks, workerCount);
    
    // Store Best Food Source Solution (from flowchart)
    console.log("Storing best food source found so far");
    const currentBest = population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best, 
      { fitness: -Infinity }
    );
    
    if (currentBest.fitness > bestFitness) {
      bestFitness = currentBest.fitness;
      bestSolution = cloneDeep(currentBest);
      console.log(`Updated Best Food Source with fitness: ${bestFitness}`);
      
      // Output additional metrics if available
      if (currentBest._makespan !== undefined) {
        console.log(`Makespan: ${currentBest._makespan.toFixed(2)}`);
      }
      if (currentBest._cost !== undefined) {
        console.log(`Cost: ${currentBest._cost.toFixed(2)}`);
      }
    }
    
    // Scout Bee Phase (Steps 18-21 in pseudocode)
    population = scoutBeePhase(population, employedBeesCount, limit, taskCount, workerCount, tasks);
    
    // Apply EOBL if enabled (optional enhancement)
    if (useEOBL) {
      population = applyEOBL(population, taskCount, workerCount, tasks, eoblCoefficient);
    }
    
    // Output current best fitness
    console.log(`Current Best Fitness: ${bestFitness}`);
    
    // Check termination condition
    if (iter === iterations) {
      console.log("Termination criterion met - ending algorithm");
    } else {
      console.log("Termination criterion not met - continuing to next iteration");
    }
  }
  
  console.log("\nFINAL BEST SOLUTION FOUND:");
  console.log(`Fitness: ${bestFitness}`);
  if (bestSolution._makespan !== undefined) {
    console.log(`Makespan: ${bestSolution._makespan.toFixed(2)}`);
  }
  if (bestSolution._cost !== undefined) {
    console.log(`Cost: ${bestSolution._cost.toFixed(2)}`);
  }
  
  return bestSolution.chromosome;
}

module.exports = { 
  runABCAlgorithm
}; 