const mongoose = require('mongoose');

const ServerRealmWarConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  winnerRoleId: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServerRealmWarConfig', ServerRealmWarConfigSchema);
