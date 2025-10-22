const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const ServerAIConfig = require('../../models/ServerAIConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage_ai')
    .setDescription('Admin: Interactively manage AI persona, bio, lore, and hierarchy')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply({ content: 'You must be an admin to use this command.' });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id;
    let config = await ServerAIConfig.findOne({ guildId });
    if (!config) {
      config = new ServerAIConfig({ guildId });
      await config.save();
    }
    // Show current config and buttons to edit
    const content = `**AI Persona:**\n${config.persona || '_Not set_'}\n\n**Bio:**\n${config.bio || '_Not set_'}\n\n**Lore:**\n${config.lore || '_Not set_'}\n\n**Hierarchy:**\n${config.hierarchy || '_Not set_'}\n`;
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('edit_persona').setLabel('Edit Persona').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('edit_bio').setLabel('Edit Bio').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('edit_lore').setLabel('Edit Lore').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('edit_hierarchy').setLabel('Edit Hierarchy').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('reset_ai').setLabel('Reset All').setStyle(ButtonStyle.Danger)
    );
    await interaction.editReply({ content, components: [buttons] });
    // The rest of the interaction logic (modals for editing) should be handled in interactionCreate.js
  },
};
