const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  guildId: String,
  channelId: String,
  messageId: String,
  prize: String,
  endTime: Date,
  winners: Number,
  participants: [String],
  ongoing: Boolean,
  requiredRole: String,
  hostId: String,
  image: String,
});

module.exports = mongoose.model('Giveaway', giveawaySchema);
