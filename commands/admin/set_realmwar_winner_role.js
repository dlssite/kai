const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ServerRealmWarConfig = require('../../models/ServerRealmWarConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_realmwar_winner_role')
    .setDescription('Set the role to be given to the RealmWar winner (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set the RealmWar winner role')
        .addRoleOption((option) =>
          option
            .setName('winner-role')
            .setDescription('The role to assign to the RealmWar winner')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View the currently set RealmWar winner role')
    ),
  async execute(interaction) {
    // Only admins
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can manage the winner role.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const winnerRole = interaction.options.getRole('winner-role');

      await ServerRealmWarConfig.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { winnerRoleId: winnerRole.id, updatedAt: new Date() },
        { upsert: true }
      );

      await interaction.reply({
        content: `✅ RealmWar winner role set to <@&${winnerRole.id}>.`,
        ephemeral: true
      });
    } else if (subcommand === 'view') {
      const config = await ServerRealmWarConfig.findOne({ guildId: interaction.guild.id });

      const embed = new EmbedBuilder()
        .setTitle('RealmWar Winner Role Configuration')
        .setColor('#FFA500')
        .setTimestamp();

      if (config && config.winnerRoleId) {
        const role = interaction.guild.roles.cache.get(config.winnerRoleId);
        embed.setDescription(`The current RealmWar winner role is: ${role ? `<@&${role.id}>` : `Unknown Role (ID: ${config.winnerRoleId})`}`);
      } else {
        embed.setDescription('No RealmWar winner role has been set for this server.');
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
};
