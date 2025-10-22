const { Events } = require('discord.js');
const { ActivityData } = require('../models/Activity');

module.exports = {
  name: Events.MessageReactionAdd,

  async execute(reaction, user) {
    if (user.bot || !reaction.message.guild) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activityData = await ActivityData.findOne({
      guildId: reaction.message.guild.id,
      userId: user.id,
      date: { $gte: today },
    });

    if (!activityData) {
      activityData = new ActivityData({
        guildId: reaction.message.guild.id,
        userId: user.id,
        date: today,
        dailyCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        streak: 0,
        lastActive: new Date(),
      });
    }

    activityData.reactionsGiven += 1;
    await activityData.save();

    // Log reaction given (non-blocking)
    const { logActivity } = require('../utils/logger');
    logActivity(reaction.message.client, reaction.message.guild.id, 'Reaction Given', {
      user: user.id,
      channel: reaction.message.channel.id,
      reaction: `${reaction.emoji.name}${reaction.emoji.id ? `:${reaction.emoji.id}` : ''}`,
    }, 0xffff00).catch(err => console.error('Logging error:', err)); // Yellow for reactions

    // Track reaction received for the message author
    if (reaction.message.author && !reaction.message.author.bot) {
      let receiverActivity = await ActivityData.findOne({
        guildId: reaction.message.guild.id,
        userId: reaction.message.author.id,
        date: { $gte: today },
      });

      if (!receiverActivity) {
        receiverActivity = new ActivityData({
          guildId: reaction.message.guild.id,
          userId: reaction.message.author.id,
          date: today,
          dailyCount: 0,
          weeklyCount: 0,
          monthlyCount: 0,
          streak: 0,
          lastActive: new Date(),
        });
      }

      receiverActivity.reactionsReceived += 1;
      await receiverActivity.save();
    }
  },
};
