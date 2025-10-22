const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ServerLogConfig = require('../../models/ServerLogConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_log_channel')
    .setDescription('Set the channel for bot activity logs (admin only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send bot activity logs to')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: 'Only administrators can set the log channel.',
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel('channel');

    // Check if it's a text channel
    if (channel.type !== 0) { // 0 is GUILD_TEXT
      return interaction.reply({
        content: 'Please select a text channel.',
        ephemeral: true
      });
    }

    // Check bot permissions in the channel
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
      return interaction.reply({
        content: 'I need View Channel, Send Messages, and Embed Links permissions in that channel.',
        ephemeral: true
      });
    }

    let config = await ServerLogConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      config = new ServerLogConfig({ guildId: interaction.guild.id });
    }

    config.logChannelId = channel.id;
    config.updatedAt = new Date();
    await config.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Log Channel Set')
      .setDescription(`Bot activity logs will now be sent to ${channel}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Log the log channel setup (non-blocking)
    const { logActivity } = require('../../utils/logger');
    logActivity(interaction.client, interaction.guild.id, 'Log Channel Set', {
      user: interaction.user.id,
      channel: channel.id,
    }, 0x0000ff).catch(err => console.error('Logging error:', err)); // Blue for setup
  }
};
