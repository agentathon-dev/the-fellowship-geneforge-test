var x = 1;
    pick2.parent[pick2.field] = pick1.node.clone();
  }
  return [child1, child2];
}
function mutate(tree, vars, maxDepth) {
  var clone = tree.clone();
  var nodes = allNodes(clone);
  if (nodes.length <= 1) {
    return randomTree(vars, Math.min(maxDepth, 3));
  }
  var idx = 1 + randInt(nodes.length - 1);
  var target = nodes[idx];
  if (target.parent) {
    var newSubtree = randomTree(vars, Math.min(3, maxDepth), 0);
    target.parent[target.field] = newSubtree;
  }
  return clone;
}
function fitness(tree, data, target, vars) {
  var totalError = 0;
  var n = data.length;
  for (var i = 0; i < n; i++) {
    var env = {};
    for (var j = 0; j < vars.length; j++) {
      env[vars[j]] = data[i][vars[j]];
    }
    var predicted = tree.evaluate(env);
    var actual = data[i][target];
    var err = predicted - actual;
    totalError += err * err;
  }
  var mse = totalError / n;
  var treeSize = tree.size();
  var complexityPenalty = treeSize > 20 ? (treeSize - 20) * 0.002 : 0;
  return 1 / (1 + mse) - complexityPenalty;
}
function tournamentSelect(population, fitnesses, k) {
  if (k === undefined) k = 5;
  var bestIdx = randInt(population.length);
  var bestFit = fitnesses[bestIdx];
  for (var i = 1; i < k; i++) {
    var idx = randInt(population.length);
    if (fitnesses[idx] > bestFit) {
      bestIdx = idx;
      bestFit = fitnesses[idx];
    }
  }
  return population[bestIdx];
}
function GeneForge(options) {
  if (!options) options = {};
  this.populationSize = options.populationSize || 150;
  this.maxDepth = options.maxDepth || 5;
  this.crossoverRate = options.crossoverRate || 0.7;
  this.mutationRate = options.mutationRate || 0.25;
  this.eliteCount = options.eliteCount || 2;
  this.tournamentSize = options.tournamentSize || 5;
  if (options.seed !== undefined) {
    _rng = mulberry32(options.seed);
  }
}
GeneForge.prototype.evolve = function(data, target, vars, generations) {
  if (!generations) generations = 50;
  var population = [];
  for (var i = 0; i < this.populationSize; i++) {
    var depth = 2 + randInt(this.maxDepth - 1);
    population.push(randomTree(vars, depth));
  }
  var bestEver = null;
  var bestFitnessEver = -Infinity;
  var history = [];
  for (var gen = 0; gen < generations; gen++) {
    var fitnesses = [];
    for (var fi = 0; fi < population.length; fi++) {
      fitnesses.push(fitness(population[fi], data, target, vars));
    }
    var genBestIdx = 0;
    var genBestFit = fitnesses[0];
    for (var bi = 1; bi < fitnesses.length; bi++) {
      if (fitnesses[bi] > genBestFit) {
        genBestIdx = bi;
        genBestFit = fitnesses[bi];
      }
    }
    if (genBestFit > bestFitnessEver) {
      bestFitnessEver = genBestFit;
      bestEver = population[genBestIdx].clone();
    }
    var avgFit = 0;
    for (var ai = 0; ai < fitnesses.length; ai++) avgFit += fitnesses[ai];
    avgFit /= fitnesses.length;
    history.push({
      generation: gen,
      bestFitness: Number(genBestFit.toFixed(6)),
      avgFitness: Number(avgFit.toFixed(6)),
      bestSize: population[genBestIdx].size(),
      bestExpression: population[genBestIdx].toString()
    });
    if (genBestFit > 0.9999) break;
    var newPop = [];
    var sortedIndices = [];
    for (var si = 0; si < population.length; si++) sortedIndices.push(si);
    sortedIndices.sort(function(a, b) { return fitnesses[b] - fitnesses[a]; });
    for (var ei = 0; ei < this.eliteCount && ei < sortedIndices.length; ei++) {
      newPop.push(population[sortedIndices[ei]].clone());
    }
    while (newPop.length < this.populationSize) {
      var r = rand();
      if (r < this.crossoverRate && newPop.length < this.populationSize - 1) {
        var p1 = tournamentSelect(population, fitnesses, this.tournamentSize);
        var p2 = tournamentSelect(population, fitnesses, this.tournamentSize);
        var offspring = crossover(p1, p2);
        if (offspring[0].size() <= 50) newPop.push(offspring[0]);
        else newPop.push(randomTree(vars, 3));
        if (newPop.length < this.populationSize) {
          if (offspring[1].size() <= 50) newPop.push(offspring[1]);
          else newPop.push(randomTree(vars, 3));
        }
      } else if (r < this.crossoverRate + this.mutationRate) {
        var parent = tournamentSelect(population, fitnesses, this.tournamentSize);
        var mutant = mutate(parent, vars, this.maxDepth);
        if (mutant.size() <= 50) newPop.push(mutant);
        else newPop.push(randomTree(vars, 3));
      } else {
        var selected = tournamentSelect(population, fitnesses, this.tournamentSize);
        newPop.push(selected.clone());
      }
    }
    population = newPop;
  }
  return {
    expression: bestEver.toString(),
    fitness: Number(bestFitnessEver.toFixed(6)),
    size: bestEver.size(),
    generations: history.length,
    converged: bestFitnessEver > 0.9999,
    history: history,
    ast: bestEver,
    predict: function(input) { return bestEver.evaluate(input); }
  };
};
function quickEvolve(data, target, vars) {
  var gf = new GeneForge({ populationSize: 200, maxDepth: 5, seed: 42 });
  return gf.evolve(data, target, vars, 60);
}
function demo() {
console.log('=== GeneForge: Programs That Evolve Programs ===');
var d1 = [];
for (var i = -5; i <= 5; i++) d1.push({x:i, y:i*i+1});
var r1 = quickEvolve(d1, 'y', ['x']);
console.log('Target: x^2+1 | Found: ' + r1.expression + ' | Fitness: ' + r1.fitness + ' | Gens: ' + r1.generations);
var d2 = [];
for (var j = -3; j <= 3; j++) for (var k = -3; k <= 3; k++) d2.push({x:j, y:k, z:j+2*k});
var gf2 = new GeneForge({populationSize:200, maxDepth:4, seed:99});
var r2 = gf2.evolve(d2, 'z', ['x','y'], 50);
console.log('Target: x+2y | Found: ' + r2.expression + ' | Fitness: ' + r2.fitness);
console.log('Prediction test: x=3 -> ' + r1.predict({x:3}) + ' (expected 10)');
return {results: [r1, r2]};
}
demo();
if (typeof module !== 'undefined') {
module.exports = { GeneForge:GeneForge, quickEvolve:quickEvolve, demo:demo, randomTree:randomTree, crossover:crossover, mutate:mutate, fitness:fitness };
}

module.exports = {x:x};