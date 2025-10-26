const { Events } = require('discord.js');
const { ActivityData } = require('../../models/Activity');

const streamSessions = new Map(); // userId -> { startTime }

module.exports = {
  name: Events.PresenceUpdate,

  async execute(oldPresence, newPresence) {
    const user = newPresence.user;
    if (!user || user.bot) return;

    const guild = newPresence.guild;
    if (!guild) return;

    const userId = user.id;
    const now = Date.now();

    // Check if user started streaming
    const oldStreaming = oldPresence?.activities?.some(activity => activity.type === 1); // Streaming type
    const newStreaming = newPresence.activities?.some(activity => activity.type === 1);

    if (!oldStreaming && newStreaming) {
      // User started streaming
      streamSessions.set(userId, { startTime: now });

      // Log stream start (non-blocking)
      const { logActivity } = require('../../utils/logger');
      logActivity(newPresence.client, guild.id, 'Stream Started', {
        user: userId,
      }, 0x00ff00).catch(err => console.error('Logging error:', err)); // Green for start
    } else if (oldStreaming && !newStreaming) {
      // User stopped streaming
      const session = streamSessions.get(userId);
      if (session) {
        const duration = Math.floor((now - session.startTime) / 60000); // Convert to minutes

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

          activityData.streamTime += duration;
          await activityData.save();
        }

        streamSessions.delete(userId);

        // Log stream end (non-blocking)
        const { logActivity } = require('../../utils/logger');
        logActivity(oldPresence.client, guild.id, 'Stream Ended', {
          user: userId,
          duration: duration,
        }, 0xff0000).catch(err => console.error('Logging error:', err)); // Red for end
      }
    }
  },
};
