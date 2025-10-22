const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage, newMessage) {
    if (newMessage.author.bot) return;
    if (!newMessage.guild) return;
    if (oldMessage.content === newMessage.content) return; // Ignore if content didn't change

    // Log message edit (non-blocking)
    const { logActivity } = require('../../utils/logger');
    logActivity(newMessage.client, newMessage.guild.id, 'Message Edited', {
      user: newMessage.author.id,
      channel: newMessage.channel.id,
      oldMessage: oldMessage.content || 'No content',
      newMessage: newMessage.content || 'No content',
    }, 0xffa500).catch(err => console.error('Logging error:', err)); // Orange color for edits
  },
};
