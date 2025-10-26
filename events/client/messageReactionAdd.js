const { Events } = require('discord.js');
const { ActivityData } = require('../../models/Activity');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // Only track in guilds
    if (!reaction.message.guild) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update reactionsGiven for the user who reacted
    let reactorActivity = await ActivityData.findOne({
      guildId: reaction.message.guild.id,
      userId: user.id,
      date: { $gte: today },
    });

    if (!reactorActivity) {
      reactorActivity = new ActivityData({
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

    reactorActivity.reactionsGiven += 1;
    await reactorActivity.save();

    // Update reactionsReceived for the message author (if not the same user)
    if (reaction.message.author.id !== user.id) {
      let authorActivity = await ActivityData.findOne({
        guildId: reaction.message.guild.id,
        userId: reaction.message.author.id,
        date: { $gte: today },
      });

      if (!authorActivity) {
        authorActivity = new ActivityData({
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

      authorActivity.reactionsReceived += 1;
      await authorActivity.save();
    }
  },
};
