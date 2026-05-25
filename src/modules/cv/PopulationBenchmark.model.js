const mongoose = require('mongoose');

const populationBenchmarkSchema = new mongoose.Schema({
    archetype_id: { type: String, required: true, unique: true },
    archetype_name: { type: String },
    cluster_id: { type: String },
    population_pct: { type: Number, default: null },
    seniority_band_pct: { type: Number, default: null },
    benchmark_source: { type: String, default: 'pending' },
    sample_size: { type: Number, default: null },
    last_updated: { type: Date, default: null }
}, { collection: 'population_benchmarks' });

module.exports = mongoose.model('PopulationBenchmark', populationBenchmarkSchema);
