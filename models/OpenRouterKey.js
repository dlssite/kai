const mongoose = require('mongoose');

const OpenRouterKeySchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  apiKey: { type: String, required: true },
});

module.exports = mongoose.model('OpenRouterKey', OpenRouterKeySchema);
