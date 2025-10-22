const { Events } = require('discord.js');
const { ActivityData } = require('../models/Activity');

const voiceSessions = new Map(); // userId -> { channelId, joinTime }

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(oldState, newState) {
    const user = newState.member?.user || oldState.member?.user;
    if (!user || user.bot) return;

    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const userId = user.id;
    const now = Date.now();

    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      voiceSessions.set(userId, {
        channelId: newState.channel.id,
        joinTime: now,
      });

      // Log voice join (non-blocking)
      const { logActivity } = require('../utils/logger');
      logActivity(newState.client, guild.id, 'Voice Channel Joined', {
        user: userId,
        voiceChannel: newState.channel.id,
      }, 0x00ff00).catch(err => console.error('Logging error:', err)); // Green for join
    }
    // User left a voice channel
    else if (oldState.channel && !newState.channel) {
      const session = voiceSessions.get(userId);
      if (session && session.channelId === oldState.channel.id) {
        const duration = Math.floor((now - session.joinTime) / 60000); // Convert to minutes

        if (duration > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let activityData = await ActivityData.findOne({
            guildId: guild.id,
            userId: userId,
            date: { $gte: today },
          });

          if (!activityData) {
            activityData = new ActivityData({
              guildId: guild.id,
              userId: userId,
              date: today,
              dailyCount: 0,
              weeklyCount: 0,
              monthlyCount: 0,
              streak: 0,
              lastActive: new Date(),
            });
          }

          activityData.voiceTime += duration;
          await activityData.save();
        }

        voiceSessions.delete(userId);

        // Log voice leave (non-blocking)
        const { logActivity } = require('../utils/logger');
        logActivity(oldState.client, guild.id, 'Voice Channel Left', {
          user: userId,
          voiceChannel: oldState.channel.id,
          duration: duration,
        }, 0xff0000).catch(err => console.error('Logging error:', err)); // Red for leave
      }
    }
    // User switched channels
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      // End old session
      const session = voiceSessions.get(userId);
      if (session && session.channelId === oldState.channel.id) {
        const duration = Math.floor((now - session.joinTime) / 60000);

        if (duration > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let activityData = await ActivityData.findOne({
            guildId: guild.id,
            userId: userId,
            date: { $gte: today },
          });

          if (!activityData) {
            activityData = new ActivityData({
              guildId: guild.id,
              userId: userId,
              date: today,
              dailyCount: 0,
              weeklyCount: 0,
              monthlyCount: 0,
              streak: 0,
              lastActive: new Date(),
            });
          }

          activityData.voiceTime += duration;
          await activityData.save();
        }

        voiceSessions.delete(userId);
      }

      // Start new session
      voiceSessions.set(userId, {
        channelId: newState.channel.id,
        joinTime: now,
      });
    }
  },
};
