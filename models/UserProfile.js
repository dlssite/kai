const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  memory: { type: [String], default: [] }, // List of facts, preferences, notes
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);
