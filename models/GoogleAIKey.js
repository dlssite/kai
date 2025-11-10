const mongoose = require('mongoose');

const GoogleAIKeySchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  apiKey: { type: String, required: true },
});

module.exports = mongoose.model('GoogleAIKey', GoogleAIKeySchema);
