function generatePopulation(popSize, taskCount, workerCount) {
  const population = [];

  for (let i = 0; i < popSize; i++) {
    const position = [];
    for (let j = 0; j < taskCount; j++) {
      const assignedWorker = Math.floor(Math.random() * workerCount);
      position.push(assignedWorker);
    }

    population.push({
      position: position,
      velocity: new Array(taskCount).fill(0),
      fitness: Infinity
    });
  }

  return population;
}

module.exports = { generatePopulation };