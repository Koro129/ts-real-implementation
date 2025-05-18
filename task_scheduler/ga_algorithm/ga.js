const { Chromosome } = require('./individualGA');
const { initializePopulation } = require('./populationGA');

/**
 * Calculate fitness for a chromosome
 * @param {Chromosome} chromosome - The chromosome to evaluate
 * @param {number} workerCount - Number of available workers
 * @return {number} The fitness value
 */
function evaluateFitness(chromosome) {
  const counts = {};
  
  // Count tasks assigned to each worker
  for (let worker of chromosome.genes) {
    counts[worker] = (counts[worker] || 0) + 1;
  }
  
  const loads = Object.values(counts);
  const maxLoad = Math.max(...loads);
  const minLoad = Math.min(...loads);
  
  // Higher fitness for more balanced task distribution
  return 1 / (maxLoad - minLoad + 1);
}

/**
 * Select a pair of chromosomes using tournament selection
 * @param {Array<Chromosome>} population - The population
 * @return {Array<Chromosome>} Two selected parent chromosomes
 */
function selectParents(population) {
  const parents = [];
  
  // Tournament selection for both parents
  for (let i = 0; i < 2; i++) {
    let bestFitness = -Infinity;
    let bestChromosome = null;
    
    // Select 3 random chromosomes for tournament
    for (let j = 0; j < 3; j++) {
      const index = Math.floor(Math.random() * population.length);
      const candidate = population[index];
      
      if (candidate.fitness > bestFitness) {
        bestFitness = candidate.fitness;
        bestChromosome = candidate;
      }
    }
    
    parents.push(bestChromosome);
  }
  
  return parents;
}

/**
 * Apply crossover operation on selected parents
 * @param {Chromosome} parent1 - First parent
 * @param {Chromosome} parent2 - Second parent
 * @param {number} crossoverProbability - Probability of crossover
 * @return {Array<Chromosome>} Two offspring chromosomes
 */
function crossover(parent1, parent2, crossoverProbability) {
  const offspring = [
    new Chromosome(parent1.id, [...parent1.genes]),
    new Chromosome(parent2.id, [...parent2.genes])
  ];
  
  // Apply crossover with probability
  if (Math.random() < crossoverProbability) {
    // Single-point crossover
    const crossoverPoint = Math.floor(Math.random() * parent1.genes.length);
    
    // Copy genes from parents to offspring
    for (let i = 0; i < parent1.genes.length; i++) {
      if (i < crossoverPoint) {
        offspring[0].genes[i] = parent1.genes[i];
        offspring[1].genes[i] = parent2.genes[i];
      } else {
        offspring[0].genes[i] = parent2.genes[i];
        offspring[1].genes[i] = parent1.genes[i];
      }
    }
  }
  
  return offspring;
}

/**
 * Apply mutation operation on offspring
 * @param {Chromosome} chromosome - The chromosome to mutate
 * @param {number} mutationProbability - Probability of mutation
 * @param {number} dataCenterIterator - Index of datacenter being processed
 */
function mutate(chromosome, mutationProbability, dataCenterIterator) {
  // Apply mutation with probability for each gene
  for (let i = 0; i < chromosome.genes.length; i++) {
    if (Math.random() < mutationProbability) {
      // Generate a new random value for the gene
      const minPosition = (dataCenterIterator - 1) * 9;
      const maxPosition = (dataCenterIterator * 9) - 1;
      const newValue = minPosition + Math.floor(Math.random() * (maxPosition - minPosition + 1));
      chromosome.genes[i] = newValue;
    }
  }
}

/**
 * Run the genetic algorithm
 * @param {number} populationSize - Size of the population
 * @param {number} maxIterations - Maximum number of iterations
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @param {number} crossoverProbability - Probability of crossover
 * @param {number} mutationProbability - Probability of mutation
 * @return {Array<number>} Best solution found
 */
function geneticAlgorithm(populationSize, maxIterations, taskCount, workerCount, 
                          crossoverProbability = 0.8, mutationProbability = 0.1) {
  const dataCenterIterator = 1; // Simplified for our case
  const chromosomeLength = taskCount;
  
  // Initialize population
  let population = initializePopulation(populationSize, chromosomeLength, dataCenterIterator);
  
  // Evaluate initial population
  population.forEach(chromosome => {
    chromosome.fitness = evaluateFitness(chromosome);
  });
  
  // Sort by fitness (descending)
  population.sort((a, b) => b.fitness - a.fitness);
  
  // Keep track of global best
  let globalBest = population[0].clone();
  
  // Main iteration loop
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const newPopulation = [];
    
    // Elitism: Keep the best chromosome
    newPopulation.push(population[0].clone());
    
    // Generate the rest of the new population
    while (newPopulation.length < populationSize) {
      // Select parents
      const parents = selectParents(population);
      
      // Apply crossover
      const offspring = crossover(parents[0], parents[1], crossoverProbability);
      
      // Apply mutation
      mutate(offspring[0], mutationProbability, dataCenterIterator);
      mutate(offspring[1], mutationProbability, dataCenterIterator);
      
      // Add offspring to new population
      newPopulation.push(offspring[0]);
      if (newPopulation.length < populationSize) {
        newPopulation.push(offspring[1]);
      }
    }
    
    // Replace old population with new population
    population = newPopulation;
    
    // Evaluate new population
    population.forEach(chromosome => {
      chromosome.fitness = evaluateFitness(chromosome);
    });
    
    // Sort by fitness (descending)
    population.sort((a, b) => b.fitness - a.fitness);
    
    // Update global best if necessary
    if (population[0].fitness > globalBest.fitness) {
      globalBest = population[0].clone();
    }
  }
  
  return globalBest.genes;
}

module.exports = { geneticAlgorithm }; 