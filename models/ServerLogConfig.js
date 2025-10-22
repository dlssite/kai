const mongoose = require('mongoose');

const ServerLogConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  logChannelId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServerLogConfig', ServerLogConfigSchema);
