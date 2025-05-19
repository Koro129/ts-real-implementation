const { Chromosome } = require('./individualGA');

/**
 * Represents a population of chromosomes in the Genetic Algorithm.
 * This class manages the collection of chromosomes and provides methods
 * for population operations.
 */
class PopulationGA {
  /**
   * Constructor
   * @param {number} populationSize - The size of the population
   * @param {number} chromosomeLength - The length of each chromosome
   * @param {number} dataCenterIterator - The index of the datacenter being processed
   */
  constructor(populationSize, chromosomeLength, dataCenterIterator) {
    this.populationSize = populationSize;
    this.chromosomeLength = chromosomeLength;
    this.dataCenterIterator = dataCenterIterator;
    this.chromosomes = [];

    // Initialize the population
    this.initializePopulation();
  }

  /**
   * Initialize the population with random chromosomes
   */
  initializePopulation() {
    for (let i = 0; i < this.populationSize; i++) {
      const genes = this.generateRandomChromosome();
      this.chromosomes.push(Chromosome.withIdAndGenes(i, genes));
      
      // Create an opposite chromosome for diversity
      const oppositeGenes = this.generateOppositeChromosome(genes);
      this.chromosomes.push(Chromosome.withIdAndGenes(i + this.populationSize, oppositeGenes));
    }
  }

  /**
   * Generate a random chromosome
   * @return {Array<number>} A randomly generated chromosome
   */
  generateRandomChromosome() {
    const genes = [];
    const minPosition = (this.dataCenterIterator - 1) * 9;
    const maxPosition = (this.dataCenterIterator * 9) - 1;
    
    for (let j = 0; j < this.chromosomeLength; j++) {
      genes.push(minPosition + Math.floor(Math.random() * (maxPosition - minPosition + 1)));
    }
    
    return genes;
  }

  /**
   * Generate an opposite chromosome (for diversity)
   * @param {Array<number>} genes - The original chromosome genes
   * @return {Array<number>} An opposite chromosome
   */
  generateOppositeChromosome(genes) {
    const minPosition = (this.dataCenterIterator - 1) * 9;
    const maxPosition = (this.dataCenterIterator * 9) - 1;
    const oppositeGenes = [];
    
    for (let j = 0; j < genes.length; j++) {
      oppositeGenes.push(maxPosition + minPosition - genes[j]);
    }
    
    return oppositeGenes;
  }

  /**
   * Apply opposition-based learning to improve diversity
   */
  applyOppositionBasedLearning() {
    for (let i = 0; i < this.chromosomes.length; i++) {
      const chromosome = this.chromosomes[i];
      const oppositeGenes = this.generateOppositeChromosome(chromosome.getGenes());
      const oppositeChromosome = Chromosome.withIdAndGenes(
        i + this.chromosomes.length, 
        oppositeGenes
      );
      
      if (oppositeChromosome.getFitness() > chromosome.getFitness()) {
        this.chromosomes[i] = oppositeChromosome;
      }
    }
  }

  /**
   * Sort chromosomes by fitness (descending order)
   */
  sortByFitness() {
    this.chromosomes.sort((c1, c2) => c2.getFitness() - c1.getFitness());
  }

  /**
   * Get the list of chromosomes
   * @return {Array<Chromosome>} The list of chromosomes
   */
  getChromosomes() {
    return this.chromosomes;
  }

  /**
   * Set the list of chromosomes
   * @param {Array<Chromosome>} chromosomes - The new list of chromosomes
   */
  setChromosomes(chromosomes) {
    this.chromosomes = chromosomes;
  }

  /**
   * Get a chromosome at a specific index
   * @param {number} index - The index of the chromosome
   * @return {Chromosome} The chromosome at the specified index
   */
  getChromosome(index) {
    return this.chromosomes[index];
  }

  /**
   * Set a chromosome at a specific index
   * @param {number} index - The index of the chromosome
   * @param {Chromosome} chromosome - The new chromosome
   */
  setChromosome(index, chromosome) {
    this.chromosomes[index] = chromosome;
  }

  /**
   * Get the size of the population
   * @return {number} The population size
   */
  getPopulationSize() {
    return this.populationSize;
  }

  /**
   * Get the length of each chromosome
   * @return {number} The chromosome length
   */
  getChromosomeLength() {
    return this.chromosomeLength;
  }

  /**
   * Get the datacenter iterator
   * @return {number} The datacenter iterator
   */
  getDataCenterIterator() {
    return this.dataCenterIterator;
  }
}

/**
 * Generate initial population for the Genetic Algorithm using the same pattern as BAT algorithm
 * @param {number} popSize - Size of the population
 * @param {number} taskCount - Number of tasks
 * @param {number} workerCount - Number of workers
 * @return {Array} Population of individuals
 */
function generatePopulation(popSize, taskCount, workerCount) {
  const population = [];

  for (let i = 0; i < popSize; i++) {
    // Create random position (task to worker assignment)
    const position = [];
    for (let j = 0; j < taskCount; j++) {
      const assignedWorker = Math.floor(Math.random() * workerCount);
      position.push(assignedWorker);
    }
    
    // Add individual to population with BAT-like structure
    population.push({
      position: position,
      velocity: new Array(taskCount).fill(0),
      fitness: 0
    });
  }

  return population;
}

module.exports = { 
  PopulationGA,
  generatePopulation
}; 