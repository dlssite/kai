const { EmbedBuilder } = require('discord.js');
const ServerLogConfig = require('../models/ServerLogConfig');

/**
 * Logs bot activity to the configured log channel for the guild.
 * @param {Object} client - The Discord client
 * @param {string} guildId - The guild ID
 * @param {string} action - The action type (e.g., 'Command Executed', 'AI Response', 'Message Edited')
 * @param {Object} details - Details object with user, timestamp, and other relevant data
 * @param {string} color - Embed color (default: blue)
 */
async function logActivity(client, guildId, action, details, color = 0x0099ff) {
  try {
    const config = await ServerLogConfig.findOne({ guildId });
    if (!config || !config.logChannelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const logChannel = guild.channels.cache.get(config.logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(action)
      .setTimestamp();

    // Add fields based on details
    if (details.user) {
      embed.addFields({ name: 'User', value: `<@${details.user}>`, inline: true });
    }
    if (details.channel) {
      embed.addFields({ name: 'Channel', value: `<#${details.channel}>`, inline: true });
    }
    if (details.command) {
      embed.addFields({ name: 'Command', value: `/${details.command}`, inline: true });
    }
    if (details.message) {
      embed.addFields({ name: 'Message', value: details.message.length > 1024 ? details.message.substring(0, 1021) + '...' : details.message, inline: false });
    }
    if (details.oldMessage) {
      embed.addFields({ name: 'Old Message', value: details.oldMessage.length > 1024 ? details.oldMessage.substring(0, 1021) + '...' : details.oldMessage, inline: false });
    }
    if (details.newMessage) {
      embed.addFields({ name: 'New Message', value: details.newMessage.length > 1024 ? details.newMessage.substring(0, 1021) + '...' : details.newMessage, inline: false });
    }
    if (details.reaction) {
      embed.addFields({ name: 'Reaction', value: details.reaction, inline: true });
    }
    if (details.voiceChannel) {
      embed.addFields({ name: 'Voice Channel', value: `<#${details.voiceChannel}>`, inline: true });
    }
    if (details.duration) {
      embed.addFields({ name: 'Duration', value: `${details.duration} minutes`, inline: true });
    }

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

module.exports = { logActivity };
