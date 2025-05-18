/**
 * Represents a chromosome (individual) in the Genetic Algorithm.
 * Each chromosome contains a solution to the VM allocation problem.
 */
class Chromosome {
  /**
   * Constructor with chromosome length
   * @param {number} chromosomeLength - The length of the chromosome
   */
  constructor(chromosomeLength) {
    this.id = -1; // Default ID if not provided
    this.genes = new Array(chromosomeLength || 0).fill(0);
    this.fitness = 0.0;
    this.velocity = new Array(chromosomeLength || 0).fill(0);
  }

  /**
   * Constructor with ID and genes
   * @param {number} id - The unique identifier for this chromosome
   * @param {Array<number>} genes - The chromosome genes (solution)
   */
  static withIdAndGenes(id, genes) {
    const chromosome = new Chromosome(genes.length);
    chromosome.id = id;
    chromosome.genes = [...genes];
    return chromosome;
  }

  /**
   * Get the ID of this chromosome
   * @return {number} The chromosome ID
   */
  getId() {
    return this.id;
  }

  /**
   * Set the ID of this chromosome
   * @param {number} id - The new ID
   */
  setId(id) {
    this.id = id;
  }

  /**
   * Get the genes of this chromosome
   * @return {Array<number>} The chromosome genes
   */
  getGenes() {
    return this.genes;
  }

  /**
   * Set the genes of this chromosome
   * @param {Array<number>} genes - The new genes
   */
  setGenes(genes) {
    this.genes = genes;
  }

  /**
   * Get the fitness value of this chromosome
   * @return {number} The fitness value
   */
  getFitness() {
    return this.fitness;
  }

  /**
   * Set the fitness value of this chromosome
   * @param {number} fitness - The new fitness value
   */
  setFitness(fitness) {
    this.fitness = fitness;
  }

  /**
   * Get the velocity array of this chromosome
   * @return {Array<number>} The velocity array
   */
  getVelocity() {
    return this.velocity;
  }

  /**
   * Set the velocity for a specific index
   * @param {number} index - The index in the velocity array
   * @param {number} value - The new velocity value
   */
  setVelocity(index, value) {
    if (index >= 0 && index < this.velocity.length) {
      this.velocity[index] = value;
    } else {
      throw new Error("Index out of bounds for velocity array.");
    }
  }

  /**
   * Get a specific gene from the chromosome
   * @param {number} index - The index of the gene
   * @return {number} The gene value
   */
  getGene(index) {
    return this.genes[index];
  }

  /**
   * Set a specific gene in the chromosome
   * @param {number} index - The index of the gene
   * @param {number} value - The new gene value
   */
  setGene(index, value) {
    this.genes[index] = value;
  }

  /**
   * Get the length of the chromosome
   * @return {number} The chromosome length
   */
  getChromosomeLength() {
    return this.genes.length;
  }

  /**
   * Clone this chromosome
   * @return {Chromosome} A deep copy of this chromosome
   */
  clone() {
    const clone = Chromosome.withIdAndGenes(this.id, this.genes);
    clone.fitness = this.fitness;
    clone.velocity = [...this.velocity];
    return clone;
  }
}

module.exports = { Chromosome }; 