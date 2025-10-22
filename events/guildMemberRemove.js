const { Events, EmbedBuilder } = require('discord.js');
const Welcome = require('../models/welcome');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      const welcomeData = await Welcome.findOne({ serverId: member.guild.id });

      if (!welcomeData || !welcomeData.leaveEnabled || !welcomeData.leaveChannelId)
        return;

      const leaveChannel = member.guild.channels.cache.get(welcomeData.leaveChannelId);
      if (!leaveChannel) return;

      let description = welcomeData.leaveDescription || '{member} has left {server}';
      description = description
        .replace(/{member}/g, member.user)
        .replace(/{server}/g, member.guild.name)
        .replace(/{serverid}/g, member.guild.id)
        .replace(/{userid}/g, member.user.id)
        .replace(/{joindate}/g, `<t:${Math.floor((member.joinedAt || Date.now()) / 1000)}:F>`)
        .replace(/{accountage}/g, `<t:${Math.floor(member.user.createdAt / 1000)}:R>`)
        .replace(/{membercount}/g, member.guild.memberCount)
        .replace(/{serverage}/g, `<t:${Math.floor(member.guild.createdAt / 1000)}:R>`);

      const leaveEmbed = new EmbedBuilder()
        .setColor(welcomeData.leaveEmbedColor || '#FF5733')
        .setTitle('Member Left')
        .setDescription(description)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setFooter({ text: `User ID: ${member.user.id}` })
        .setTimestamp();

      leaveChannel.send({ embeds: [leaveEmbed] });
    } catch (error) {
      console.error('Error handling guildMemberRemove:', error);
    }
  },
};
