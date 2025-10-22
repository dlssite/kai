const { SlashCommandBuilder } = require('discord.js');
const ServerAIConfig = require('../../models/ServerAIConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage_access')
    .setDescription('Manage which roles can use the bot (admin only)'),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only administrators can manage bot access.', ephemeral: true });
    }
    // Fetch server config
    let config = await ServerAIConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      config = new ServerAIConfig({ guildId: interaction.guild.id, allowedRoles: [] });
      await config.save();
    }
    // Build select menu for roles
    const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
    const options = roles.map(role => ({
      label: role.name,
      value: role.id,
      default: config.allowedRoles.includes(role.id)
    })).slice(0, 25); // Discord max 25 options
    const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('access_roles')
      .setPlaceholder('Select allowed roles')
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options);
    const saveButton = new ButtonBuilder()
      .setCustomId('save_access_roles')
      .setLabel('Save')
      .setStyle(ButtonStyle.Success);
    await interaction.reply({
      content: 'Select which roles can use the bot:',
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(saveButton)
      ],
      ephemeral: true
    });
  }
};
