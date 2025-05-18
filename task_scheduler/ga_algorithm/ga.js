const { Chromosome } = require('./individualGA');
const { PopulationGA } = require('./populationGA');

/**
 * Implementation of the Genetic Algorithm for VM allocation in cloud computing
 */
class GeneticAlgorithm {
  /**
   * Constructor
   * @param {number} maxIterations - Maximum number of iterations
   * @param {number} populationSize - Population size
   * @param {number} crossoverProbability - Probability of crossover
   * @param {number} mutationProbability - Probability of mutation
   * @param {number} chromosomeLength - Length of each chromosome
   */
  constructor(maxIterations, populationSize, crossoverProbability, mutationProbability, chromosomeLength) {
    this.maxIterations = maxIterations;
    this.populationSize = populationSize;
    this.crossoverProbability = crossoverProbability;
    this.mutationProbability = mutationProbability;
    this.chromosomeLength = chromosomeLength;
    
    this.numberOfDataCenters = 1; // Simplified for our case
    this.globalBestFitnesses = new Array(this.numberOfDataCenters).fill(-Infinity);
    this.globalBestPositions = new Array(this.numberOfDataCenters);
    
    for (let i = 0; i < this.numberOfDataCenters; i++) {
      this.globalBestPositions[i] = new Array(chromosomeLength).fill(0);
    }
  }
  
  /**
   * Initialize population
   * @param {number} chromosomeLength - Length of each chromosome
   * @param {number} dataCenterIterator - Index of the datacenter being processed
   * @return {PopulationGA} The initialized population
   */
  initPopulation(chromosomeLength, dataCenterIterator) {
    return new PopulationGA(this.populationSize, chromosomeLength, dataCenterIterator);
  }
  
  /**
   * Compute fitness for all chromosomes in the population
   * @param {PopulationGA} population - The population
   * @param {number} dataCenterIterator - Index of the datacenter being processed
   */
  computeFitness(population, dataCenterIterator) {
    const chromosomes = population.getChromosomes();
    for (let chromosome of chromosomes) {
      const fitness = this.calcFitness(chromosome, dataCenterIterator);
      chromosome.setFitness(fitness);
    }
  }
  
  /**
   * Calculate fitness for a chromosome
   * @param {Chromosome} chromosome - The chromosome
   * @param {number} dataCenterIterator - Index of the datacenter being processed
   * @return {number} The fitness value
   */
  calcFitness(chromosome, dataCenterIterator) {
    // In our simplified case, we use a balancing metric instead of the cloud sim metrics
    const counts = {};
    const genes = chromosome.getGenes();
    
    // Count tasks assigned to each worker
    for (let gene of genes) {
      counts[gene] = (counts[gene] || 0) + 1;
    }
    
    const loads = Object.values(counts);
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    // Higher fitness for more balanced task distribution
    return 1 / (maxLoad - minLoad + 1);
  }
  
  /**
   * Select a pair of chromosomes using tournament selection
   * @param {PopulationGA} population - The population
   * @return {Array<Chromosome>} Two selected parent chromosomes
   */
  selectParents(population) {
    const chromosomes = population.getChromosomes();
    const parents = new Array(2);
    
    // Tournament selection
    for (let i = 0; i < 2; i++) {
      // Select 3 random chromosomes for tournament
      let best = null;
      let bestFitness = -Infinity;
      
      for (let j = 0; j < 3; j++) {
        const index = Math.floor(Math.random() * chromosomes.length);
        const candidate = chromosomes[index];
        
        if (candidate.getFitness() > bestFitness) {
          bestFitness = candidate.getFitness();
          best = candidate;
        }
      }
      
      parents[i] = best;
    }
    
    return parents;
  }
  
  /**
   * Apply crossover operation on selected parents
   * @param {Chromosome} parent1 - First parent
   * @param {Chromosome} parent2 - Second parent
   * @return {Array<Chromosome>} Two offspring chromosomes
   */
  crossover(parent1, parent2) {
    const offspring = [
      new Chromosome(parent1.getChromosomeLength()),
      new Chromosome(parent2.getChromosomeLength())
    ];
    
    offspring[0].setId(parent1.getId());
    offspring[1].setId(parent2.getId());
    
    // Apply crossover with probability
    if (Math.random() < this.crossoverProbability) {
      // Single-point crossover
      const crossoverPoint = Math.floor(Math.random() * parent1.getChromosomeLength());
      
      // Copy genes from parents to offspring
      for (let i = 0; i < parent1.getChromosomeLength(); i++) {
        if (i < crossoverPoint) {
          offspring[0].setGene(i, parent1.getGene(i));
          offspring[1].setGene(i, parent2.getGene(i));
        } else {
          offspring[0].setGene(i, parent2.getGene(i));
          offspring[1].setGene(i, parent1.getGene(i));
        }
      }
    } else {
      // No crossover, copy parents directly
      for (let i = 0; i < parent1.getChromosomeLength(); i++) {
        offspring[0].setGene(i, parent1.getGene(i));
        offspring[1].setGene(i, parent2.getGene(i));
      }
    }
    
    return offspring;
  }
  
  /**
   * Apply mutation operation on offspring
   * @param {Chromosome} offspring - The offspring to mutate
   * @param {number} dataCenterIterator - Index of the datacenter being processed
   */
  mutate(offspring, dataCenterIterator) {
    // Apply mutation with probability for each gene
    for (let i = 0; i < offspring.getChromosomeLength(); i++) {
      if (Math.random() < this.mutationProbability) {
        // Generate a new random value for the gene
        const minPosition = (dataCenterIterator - 1) * 9;
        const maxPosition = (dataCenterIterator * 9) - 1;
        const newValue = minPosition + Math.floor(Math.random() * (maxPosition - minPosition + 1));
        offspring.setGene(i, newValue);
      }
    }
  }
  
  /**
   * Run the genetic algorithm
   * @param {PopulationGA} population - The initial population
   * @param {number} dataCenterIterator - Index of the datacenter being processed
   */
  runGA(population, dataCenterIterator) {
    let iteration = 0;
    
    // Compute initial fitness
    this.computeFitness(population, dataCenterIterator);
    
    // Main iteration loop
    while (iteration < this.maxIterations) {
      // Create a new population for the next generation
      const newPopulation = [];
      
      // Elitism: Keep the best chromosome
      population.sortByFitness();
      newPopulation.push(population.getChromosome(0).clone());
      
      // Generate the rest of the new population
      while (newPopulation.length < population.getPopulationSize()) {
        // Select parents
        const parents = this.selectParents(population);
        
        // Apply crossover
        const offspring = this.crossover(parents[0], parents[1]);
        
        // Apply mutation
        this.mutate(offspring[0], dataCenterIterator);
        this.mutate(offspring[1], dataCenterIterator);
        
        // Add offspring to new population
        newPopulation.push(offspring[0]);
        if (newPopulation.length < population.getPopulationSize()) {
          newPopulation.push(offspring[1]);
        }
      }
      
      // Replace old population with new population
      population.setChromosomes(newPopulation);
      
      // Compute fitness for new population
      this.computeFitness(population, dataCenterIterator);
      
      // Sort population by fitness
      population.sortByFitness();
      
      // Update global best if necessary
      const dcIndex = dataCenterIterator - 1;
      if (population.getChromosome(0).getFitness() > this.globalBestFitnesses[dcIndex]) {
        this.globalBestFitnesses[dcIndex] = population.getChromosome(0).getFitness();
        this.globalBestPositions[dcIndex] = [...population.getChromosome(0).getGenes()];
      }
      
      // Increment iteration counter
      iteration++;
    }
  }
  
  /**
   * Get the best VM allocation for a datacenter
   * @param {number} dataCenterIterator - Index of the datacenter
   * @return {Array<number>} The best VM allocation
   */
  getBestVmAllocationForDatacenter(dataCenterIterator) {
    return this.globalBestPositions[dataCenterIterator - 1];
  }
  
  /**
   * Get the best fitness for a datacenter
   * @param {number} dataCenterIterator - Index of the datacenter
   * @return {number} The best fitness
   */
  getBestFitnessForDatacenter(dataCenterIterator) {
    return this.globalBestFitnesses[dataCenterIterator - 1];
  }
}

/**
 * Legacy function to maintain compatibility with the BAT algorithm pattern
 * @param {Array} population - Initial population
 * @param {number} iterations - Maximum number of iterations
 * @return {Array<number>} Best position found
 */
function geneticAlgorithm(population, iterations) {
  const populationSize = population.length;
  const taskCount = population[0].position.length;
  
  // Convert BAT-style population to GA-style chromosomes
  const gaPopulation = new PopulationGA(populationSize, taskCount, 1);
  const chromosomes = [];
  
  for (let i = 0; i < populationSize; i++) {
    const chromosome = new Chromosome(taskCount);
    chromosome.setId(i);
    chromosome.setGenes([...population[i].position]);
    chromosomes.push(chromosome);
  }
  
  gaPopulation.setChromosomes(chromosomes);
  
  // Run the GA
  const ga = new GeneticAlgorithm(iterations, populationSize, 0.8, 0.1, taskCount);
  ga.runGA(gaPopulation, 1);
  
  // Return the best position
  return ga.getBestVmAllocationForDatacenter(1);
}

module.exports = { 
  GeneticAlgorithm,
  geneticAlgorithm
}; 