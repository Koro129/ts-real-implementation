/**
 * Represents a chromosome (individual) in the Genetic Algorithm.
 * Each chromosome contains a solution to the VM allocation problem.
 */
class Chromosome {
  /**
   * Constructor
   * @param {number} id - Unique identifier for the chromosome
   * @param {Array<number>} genes - The solution represented by this chromosome
   */
  constructor(id, genes) {
    this.id = id || -1;
    this.genes = genes || [];
    this.fitness = 0.0;
    this.velocity = new Array(genes ? genes.length : 0).fill(0);
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
    const clone = new Chromosome(this.id, [...this.genes]);
    clone.fitness = this.fitness;
    clone.velocity = [...this.velocity];
    return clone;
  }
}

module.exports = { Chromosome }; 