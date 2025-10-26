const mongoose = require('mongoose');

const activityDataSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  dailyCount: { type: Number, default: 0 },
  weeklyCount: { type: Number, default: 0 },
  monthlyCount: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  // Additional activity tracking
  reactionsGiven: { type: Number, default: 0 },
  reactionsReceived: { type: Number, default: 0 },
  voiceTime: { type: Number, default: 0 }, // in minutes
  streamTime: { type: Number, default: 0 }, // in minutes
  commandsUsed: { type: Number, default: 0 },
  attachmentsSent: { type: Number, default: 0 },
  mentionsGiven: { type: Number, default: 0 },
  mentionsReceived: { type: Number, default: 0 },
  // Highest streaks
  highestStreak: { type: Number, default: 0 },
});

activityDataSchema.index({ guildId: 1, userId: 1, date: -1 }, { unique: true });

const ActivityData = mongoose.model('ActivityData', activityDataSchema);

module.exports = { ActivityData };
