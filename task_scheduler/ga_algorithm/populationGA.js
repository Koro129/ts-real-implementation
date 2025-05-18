const { Chromosome } = require('./individualGA');

/**
 * Represents a population of chromosomes in the Genetic Algorithm.
 * This class manages the collection of chromosomes and provides methods
 * for population operations.
 */
function initializePopulation(populationSize, chromosomeLength, dataCenterIterator) {
  const chromosomes = [];
  
  for (let i = 0; i < populationSize; i++) {
    const genes = generateRandomChromosome(chromosomeLength, dataCenterIterator);
    chromosomes.push(new Chromosome(i, genes));
    
    // Create an opposite chromosome for diversity
    const oppositeGenes = generateOppositeChromosome(genes, dataCenterIterator);
    chromosomes.push(new Chromosome(i + populationSize, oppositeGenes));
  }
  
  return chromosomes;
}

/**
 * Generate a random chromosome
 * @param {number} chromosomeLength - Length of the chromosome
 * @param {number} dataCenterIterator - Index of datacenter being processed
 * @return {Array<number>} A randomly generated chromosome
 */
function generateRandomChromosome(chromosomeLength, dataCenterIterator) {
  const genes = [];
  const minPosition = (dataCenterIterator - 1) * 9;
  const maxPosition = (dataCenterIterator * 9) - 1;
  
  for (let j = 0; j < chromosomeLength; j++) {
    genes.push(minPosition + Math.floor(Math.random() * (maxPosition - minPosition + 1)));
  }
  
  return genes;
}

/**
 * Generate an opposite chromosome (for diversity)
 * @param {Array<number>} genes - The original chromosome genes
 * @param {number} dataCenterIterator - Index of datacenter being processed
 * @return {Array<number>} An opposite chromosome
 */
function generateOppositeChromosome(genes, dataCenterIterator) {
  const minPosition = (dataCenterIterator - 1) * 9;
  const maxPosition = (dataCenterIterator * 9) - 1;
  const oppositeGenes = [];
  
  for (let j = 0; j < genes.length; j++) {
    oppositeGenes.push(maxPosition + minPosition - genes[j]);
  }
  
  return oppositeGenes;
}

module.exports = { 
  initializePopulation, 
  generateRandomChromosome, 
  generateOppositeChromosome 
}; 