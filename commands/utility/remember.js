const { SlashCommandBuilder } = require('discord.js');
const UserProfile = require('../../models/UserProfile');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remember')
    .setDescription('Add a fact or note to your memory')
    .addStringOption(option =>
      option.setName('fact')
        .setDescription('What should I remember about you?')
        .setRequired(true)),
  async execute(interaction) {
    const userId = interaction.user.id;
    const fact = interaction.options.getString('fact');
    try {
      let profile = await UserProfile.findOne({ userId });
      if (!profile) {
        profile = new UserProfile({ userId, memory: [fact] });
      } else {
        profile.memory.push(fact);
        profile.updatedAt = new Date();
      }
      await profile.save();
      await interaction.reply({ content: `I will remember: "${fact}"`, ephemeral: true });
    } catch (err) {
      console.error('Error saving user memory:', err);
      await interaction.reply({ content: 'Failed to save your memory.', ephemeral: true });
    }
  },
};
