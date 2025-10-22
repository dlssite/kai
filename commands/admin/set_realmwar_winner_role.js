const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const ServerRealmWarConfig = require('../../models/ServerRealmWarConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_realmwar_winner_role')
    .setDescription('Set the role to be given to the RealmWar winner (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // Only admins
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can set the winner role.', ephemeral: true });
    }
    // Get all roles except @everyone
    const roles = interaction.guild.roles.cache.filter(r => r.name !== '@everyone');
    const options = roles.map(role => ({ label: role.name, value: role.id })).slice(0, 25);
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('realmwar_winner_role_select')
      .setPlaceholder('Select winner role')
      .addOptions(options);
    await interaction.reply({
      content: 'Select the role to assign to the RealmWar winner:',
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true
    });
  }
};
