const mongoose = require('mongoose');

const ServerAIConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  persona: { type: String, default: '' },
  bio: { type: String, default: '' },
  lore: { type: String, default: '' },
  hierarchy: { type: String, default: '' },
  allowedRoles: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServerAIConfig', ServerAIConfigSchema);
