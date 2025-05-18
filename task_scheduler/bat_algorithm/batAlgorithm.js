function evaluateFitness(position) {
  const counts = {};
  for (let worker of position) {
    counts[worker] = (counts[worker] || 0) + 1;
  }

  const loads = Object.values(counts);
  const maxLoad = Math.max(...loads);
  const minLoad = Math.min(...loads);
  return 1 / (maxLoad - minLoad + 1); // Semakin seimbang, nilai semakin besar
}

function batAlgorithm(population, iterations) {
  const populationSize = population.length;
  const taskCount = population[0].position.length;

  const frequency = new Array(populationSize).fill(0).map(() => Math.random() * 2);
  const loudness = new Array(populationSize).fill(1.0);
  const pulseRate = new Array(populationSize).fill(0.0);
  const alpha = 0.92;
  const gamma = 0.92;

  // Evaluasi awal & inisialisasi global best
  for (let bat of population) {
    bat.fitness = evaluateFitness(bat.position);
  }

  let globalBest = structuredClone(population[0]);
  for (let bat of population) {
    if (bat.fitness > globalBest.fitness) {
      globalBest = structuredClone(bat);
    }
  }

  for (let t = 0; t < iterations; t++) {
    for (let i = 0; i < populationSize; i++) {
      const bat = population[i];

      // Update velocity & posisi baru (mutasi acak)
      const newPosition = [...bat.position];
      const idx1 = Math.floor(Math.random() * taskCount);
      const idx2 = Math.floor(Math.random() * taskCount);
      [newPosition[idx1], newPosition[idx2]] = [newPosition[idx2], newPosition[idx1]];

      // Local search probabilitas
      if (Math.random() > pulseRate[i]) {
        const idx = Math.floor(Math.random() * taskCount);
        newPosition[idx] = globalBest.position[idx];
      }

      const newFitness = evaluateFitness(newPosition);

      // Solusi diterima berdasarkan kondisi probabilistik
      if (Math.random() < loudness[i] && newFitness > bat.fitness) {
        bat.position = newPosition;
        bat.fitness = newFitness;

        loudness[i] *= alpha;
        pulseRate[i] = Math.min(1.0, pulseRate[i] + gamma);

        if (newFitness > globalBest.fitness) {
          globalBest = structuredClone(bat);
        }
      }
    }
  }

  return globalBest.position;
}

module.exports = { batAlgorithm };