const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const UserProfile = require('../../models/UserProfile');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage_memory')
    .setDescription('Admin: Interactively manage a user\'s memory')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to manage memory for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.reply({ content: 'You must be an admin to use this command.', ephemeral: true });
      return;
    }
    const user = interaction.options.getUser('user');
    let profile = await UserProfile.findOne({ userId: user.id });
    if (!profile || !profile.memory.length) {
      await interaction.reply({ content: `${user.username} has no memory entries.`, ephemeral: true });
      return;
    }
    // Build select menu for memory entries
    const select = new StringSelectMenuBuilder()
      .setCustomId(`memory_select_${user.id}`)
      .setPlaceholder('Select a memory to remove or modify')
      .addOptions(profile.memory.map((fact, i) => ({
        label: fact.length > 100 ? fact.slice(0, 97) + '...' : fact,
        value: String(i),
      })));
    const row = new ActionRowBuilder().addComponents(select);
    // Add buttons for add/remove
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`memory_add_${user.id}`).setLabel('Add').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`memory_remove_${user.id}`).setLabel('Remove').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`memory_modify_${user.id}`).setLabel('Modify').setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({
      content: `Managing memory for ${user.username}:\n` + profile.memory.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      components: [row, buttons],
      ephemeral: true
    });
    // The rest of the interaction logic (collectors for select/buttons) should be handled in a component interaction handler.
  },
};
