const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  description: { type: String, default: 'Welcome {member} to {server}' },
  channelId: { type: String, default: null },
  embedColor: { type: String, default: '#00BFFF' },
  leaveEnabled: { type: Boolean, default: false },
  leaveDescription: { type: String, default: '{member} has left {server}' },
  leaveChannelId: { type: String, default: null },
  leaveEmbedColor: { type: String, default: '#FF5733' },
});

const Welcome = mongoose.model('Welcome', welcomeSchema);

module.exports = Welcome;
